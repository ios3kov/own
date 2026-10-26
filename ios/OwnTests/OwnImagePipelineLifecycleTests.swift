import XCTest
import UIKit
import CoreML
import StableDiffusion
import React
@testable import Own

private final class FixtureImagePipeline: StableDiffusionPipelineProtocol {
  let image: CGImage
  var generate: (() throws -> Void)?
  init(image: CGImage) { self.image = image }
  func loadResources() throws {}
  func unloadResources() {}
  func generateImages(configuration _: PipelineConfiguration, progressHandler _: (PipelineProgress) -> Bool) throws -> [CGImage?] {
    try generate?()
    return [image]
  }
  func decodeToImages(_ latents: [MLShapedArray<Float32>], configuration _: PipelineConfiguration) throws -> [CGImage?] {
    [image]
  }
}

private final class FixtureImageBridge: CoreMLDiffusionModule {
  var fixture: FixtureImagePipeline!
  var beforeCreate: (() -> Void)?
  var invalidDirectory = false
  var now: TimeInterval = 0
  private let timerLock = NSLock()
  private var timers: [DispatchWorkItem] = []
  override func validatePipelineDirectory(_ url: URL) -> String? { invalidDirectory ? "Fixture invalid model" : nil }
  override func makePipeline(at _: URL, configuration _: MLModelConfiguration, isXL _: Bool) throws -> StableDiffusionPipelineProtocol { beforeCreate?(); return fixture }
  override func applicationIsActive() -> Bool { true }
  override func retentionConditions() -> (lowPower: Bool, thermal: ProcessInfo.ThermalState) { (false, .nominal) }
  override func monotonicNow() -> TimeInterval { now }
  override func scheduleIdleExpiry(_ item: DispatchWorkItem) {
    timerLock.lock(); timers.append(item); timerLock.unlock()
  }
  override func sendEvent(withName name: String!, body: Any!) {}
  func fireTimers(at instant: TimeInterval) {
    timerLock.lock(); let items = timers; timerLock.unlock()
    enqueuePipeline { self.now = instant; items.forEach { $0.perform() } }
  }
}

@MainActor
final class OwnImagePipelineLifecycleTests: XCTestCase {
  private func makeBridge() async throws -> FixtureImageBridge {
    let bridge = FixtureImageBridge()
    let image = UIGraphicsImageRenderer(size: CGSize(width: 32, height: 16)).image {
      UIColor.red.setFill(); $0.fill(CGRect(x: 0, y: 0, width: 32, height: 16))
    }
    bridge.fixture = FixtureImagePipeline(image: try XCTUnwrap(image.cgImage))
    await withCheckedContinuation { continuation in DispatchQueue.main.async { continuation.resume() } }
    return bridge
  }
  private func call(_ invoke: (@escaping RCTPromiseResolveBlock, @escaping RCTPromiseRejectBlock) -> Void) async throws -> Any {
    try await withCheckedThrowingContinuation { continuation in
      invoke({ continuation.resume(returning: $0 ?? NSNull()) }, { code, message, _ in
        continuation.resume(throwing: NSError(domain: code ?? "Fixture", code: 1,
          userInfo: [NSLocalizedDescriptionKey: message ?? "Fixture bridge failure"]))
      })
    }
  }
  private func load(_ bridge: FixtureImageBridge) async throws {
    _ = try await call { bridge.loadModel(["modelPath": "/owned-fixture/model", "attentionVariant": "original"], resolver: $0, rejecter: $1) }
  }
  private func loaded(_ bridge: FixtureImageBridge) async throws -> Bool {
    try await call { bridge.isModelLoaded($0, rejecter: $1) } as? Bool ?? false
  }
  private func assertLoaded(_ expected: Bool, _ bridge: FixtureImageBridge,
                            file: StaticString = #filePath, line: UInt = #line) async throws {
    let actual = try await loaded(bridge)
    XCTAssertEqual(actual, expected, file: file, line: line)
  }
  private func draw(_ bridge: FixtureImageBridge, keep: Bool, id: String = UUID().uuidString) async throws {
    let result = try await call {
      bridge.generateImage(["prompt": "fixture", "requestId": id, "keepPipelineReady": keep,
        "width": 128, "height": 128], resolver: $0, rejecter: $1)
    }
    if let path = (result as? [String: Any])?["imagePath"] as? String {
      // Delete only this test's newly returned output.
      try FileManager.default.removeItem(atPath: path)
    } else { XCTFail("Expected an owned fixture output path") }
  }

  func testDefaultReleasesAndOptInExpiresAfterOneMinute() async throws {
    let bridge = try await makeBridge()
    try await load(bridge)
    try await draw(bridge, keep: false)
    try await assertLoaded(false, bridge)
    try await load(bridge)
    try await draw(bridge, keep: true)
    try await assertLoaded(true, bridge)
    bridge.fireTimers(at: 60)
    try await assertLoaded(false, bridge)
  }

  func testInvalidRequestKeepsOriginalExpiryAndInvalidLoadReleases() async throws {
    let bridge = try await makeBridge()
    try await load(bridge); try await draw(bridge, keep: true)
    do { try await draw(bridge, keep: true, id: ""); XCTFail("Invalid request accepted") } catch {}
    try await assertLoaded(true, bridge)
    bridge.fireTimers(at: 60)
    try await assertLoaded(false, bridge)
    try await load(bridge); try await draw(bridge, keep: true)
    bridge.invalidDirectory = true
    do { try await load(bridge); XCTFail("Invalid model accepted") } catch {}
    try await assertLoaded(false, bridge)
  }

  func testIdleEvictionWaitsForActiveGenerationWithoutCancellingIt() async throws {
    let bridge = try await makeBridge()
    try await load(bridge)
    let began = expectation(description: "Fixture inference entered")
    let gate = DispatchSemaphore(value: 0)
    bridge.fixture.generate = {
      began.fulfill()
      guard gate.wait(timeout: .now() + 5) == .success else { throw NSError(domain: "Fixture timeout", code: 1) }
    }
    let drawing = Task { try await self.draw(bridge, keep: true) }
    await fulfillment(of: [began], timeout: 2)
    let releaseBegan = expectation(description: "Idle release queued behind inference")
    let released = Task { _ = try await self.call { resolve, reject in
      bridge.releaseIdlePipeline(resolve, rejecter: reject)
      releaseBegan.fulfill()
    } }
    await fulfillment(of: [releaseBegan], timeout: 2)
    gate.signal()
    try await drawing.value
    try await released.value
    try await assertLoaded(false, bridge)
  }

  func testEvictionDuringLoadCannotPublishALatePipeline() async throws {
    let bridge = try await makeBridge()
    let began = expectation(description: "Fixture construction entered")
    let gate = DispatchSemaphore(value: 0)
    bridge.beforeCreate = { began.fulfill(); _ = gate.wait(timeout: .now() + 5) }
    let loading = Task { try await self.load(bridge) }
    await fulfillment(of: [began], timeout: 2)
    let releaseBegan = expectation(description: "Eviction invalidated loading ticket")
    let released = Task { _ = try await self.call { resolve, reject in
      bridge.releaseIdlePipeline(resolve, rejecter: reject); releaseBegan.fulfill()
    } }
    await fulfillment(of: [releaseBegan], timeout: 2)
    gate.signal()
    do { try await loading.value; XCTFail("Late load accepted after eviction") } catch {}
    try await released.value
    try await assertLoaded(false, bridge)
  }

  func testPipelineErrorReleasesInsteadOfRetaining() async throws {
    let bridge = try await makeBridge()
    try await load(bridge)
    bridge.fixture.generate = { throw NSError(domain: "Fixture generation failure", code: 1) }
    do { try await draw(bridge, keep: true); XCTFail("Fixture failure accepted") } catch {}
    try await assertLoaded(false, bridge)
  }
}
