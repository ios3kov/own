import XCTest
import UIKit
import AVFAudio

@testable import Own

// MARK: - AppDelegate Background URL Session Tests

/// Verifies that AppDelegate correctly implements the background URL session
/// delegate method required by RNFS for background downloads to complete.
/// If the method signature were wrong (e.g., wrong RNFSManager method name),
/// the build itself would fail — making this test a compile-time guard.
final class AppDelegateBackgroundSessionTests: XCTestCase {

  func testAppDelegateRespondsToBackgroundURLSessionSelector() {
    let appDelegate = AppDelegate()
    let responds = appDelegate.responds(
      to: #selector(
        UIApplicationDelegate.application(_:handleEventsForBackgroundURLSession:completionHandler:)
      )
    )
    XCTAssertTrue(
      responds,
      "AppDelegate must implement handleEventsForBackgroundURLSession to properly finalise RNFS background downloads"
    )
  }

  func testAppDelegateIsUIApplicationDelegate() {
    let appDelegate = AppDelegate()
    XCTAssertTrue(
      appDelegate is UIApplicationDelegate,
      "AppDelegate must conform to UIApplicationDelegate"
    )
  }
}

final class ModelFileStorageTests: XCTestCase {
  func testAcceptsFullAndResumedHTTPDownloads() {
    for code in [200, 206] {
      let response = HTTPURLResponse(url: URL(string: "https://example.com/model.bin")!, statusCode: code, httpVersion: nil, headerFields: nil)
      XCTAssertTrue(DownloadManagerModule.isSuccessfulModelResponse(response))
    }
  }

  func testRejectsErrorPagesAndMissingHTTPResponse() {
    for code in [301, 403, 404, 429, 500] {
      let response = HTTPURLResponse(url: URL(string: "https://example.com/model.bin")!, statusCode: code, httpVersion: nil, headerFields: nil)
      XCTAssertFalse(DownloadManagerModule.isSuccessfulModelResponse(response))
    }
    XCTAssertFalse(DownloadManagerModule.isSuccessfulModelResponse(nil))
  }

  func testNestedModelPathStaysWithinDestination() throws {
    let root = try makeTempDirectory()
    defer { try? FileManager.default.removeItem(at: root) }
    let result = try DownloadManagerModule.modelFileDestination("Unet.mlmodelc/weights/weight.bin", in: root.path)
    XCTAssertEqual(result.path, root.appendingPathComponent("Unet.mlmodelc/weights/weight.bin").path)
  }

  func testRejectsAbsoluteAndTraversingModelPaths() {
    for path in ["../escape.bin", "/tmp/escape.bin", "weights/../../escape.bin", "", "weights\\escape.bin"] {
      XCTAssertThrowsError(try DownloadManagerModule.modelFileDestination(path, in: "/tmp/own-model-test"))
    }
  }

  func testRejectsSymlinkLeadingOutsideModelDirectory() throws {
    let root = try makeTempDirectory(), outside = try makeTempDirectory()
    defer { try? FileManager.default.removeItem(at: root); try? FileManager.default.removeItem(at: outside) }
    try FileManager.default.createSymbolicLink(at: root.appendingPathComponent("weights"), withDestinationURL: outside)
    XCTAssertThrowsError(try DownloadManagerModule.modelFileDestination("weights/escape.bin", in: root.path))
  }

  func testSaveFailureThrowsInsteadOfReportingCompletion() throws {
    let root = try makeTempDirectory()
    defer { try? FileManager.default.removeItem(at: root) }
    XCTAssertThrowsError(try DownloadManagerModule.saveModelFile(from: root.appendingPathComponent("missing"), relativePath: "weights/model.bin", destinationDir: root.path))
  }

  func testFailedReplacementPreservesExistingModelFile() throws {
    let root = try makeTempDirectory()
    defer { try? FileManager.default.removeItem(at: root) }
    let target = root.appendingPathComponent("model.bin")
    try Data("existing model".utf8).write(to: target)
    XCTAssertThrowsError(try DownloadManagerModule.saveModelFile(from: root.appendingPathComponent("missing"), relativePath: "model.bin", destinationDir: root.path))
    XCTAssertEqual(try String(contentsOf: target, encoding: .utf8), "existing model")
  }

  func testMultiFileEntryRejectsTraversalBeforeCreatingDestination() {
    let module = DownloadManagerModule()
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    let result = expectation(description: "reject unsafe path")
    module.startMultiFileDownload([
      "fileName": "model", "modelId": "test/model", "destinationDir": root.path,
      "files": [["url": "https://example.com/weights.bin", "relativePath": "../escape.bin"]]
    ], resolver: { _ in XCTFail("must reject unsafe path"); result.fulfill() }, rejecter: { code, _, _ in
      XCTAssertEqual(code, "INVALID_PARAMS"); result.fulfill()
    })
    waitForExpectations(timeout: 2)
    XCTAssertFalse(FileManager.default.fileExists(atPath: root.path))
  }
}


final class OwnReplySpeechPolicyTests: XCTestCase {
  func testBasicVoicePlaybackAndImmediateCancellation() throws {
    guard AVSpeechSynthesisVoice.speechVoices().contains(where: { OwnReplySpeech.eligible($0, language: "en") }) else {
      throw XCTSkip("No installed basic English voice in this simulator")
    }
    let module = OwnReplySpeech()
    let finished = expectation(description: "Local voice completes a real utterance")
    module.begin("qa-play", resolver: { _ in
      module.speak("This is a local spoken reply from Own.", session: "qa-play", resolver: { _ in
        finished.fulfill()
      }, rejecter: { code, message, _ in
        XCTFail("Local playback failed: \(code ?? "unknown") \(message ?? "")")
        finished.fulfill()
      })
    }, rejecter: { _, _, _ in XCTFail("Cannot begin playback") })
    wait(for: [finished], timeout: 30)
    let cancelled = expectation(description: "Stop cancels the in-flight utterance")
    module.begin("qa-cancel", resolver: { _ in
      module.speak("This sentence should stop immediately.", session: "qa-cancel", resolver: { _ in
        XCTFail("Cancelled speech must not report successful completion")
        cancelled.fulfill()
      }, rejecter: { code, _, _ in
        XCTAssertEqual(code, "speech_stopped")
        cancelled.fulfill()
      })
      module.stop({ _ in }, rejecter: { _, _, _ in XCTFail("Cannot stop playback") })
    }, rejecter: { _, _, _ in XCTFail("Cannot begin cancellation check") })
    wait(for: [cancelled], timeout: 5)
  }
  func testVoiceListExcludesThirdPartyProviderIdentifiers() {
    XCTAssertTrue(OwnReplySpeech.isSystemVoiceIdentifier("com.apple.voice.en-US.Ava"))
    XCTAssertFalse(OwnReplySpeech.isSystemVoiceIdentifier("com.example.networkvoice"))
    XCTAssertFalse(OwnReplySpeech.isSystemVoiceIdentifier("com.appleevil.voice"))
  }
  func testInstalledVoiceQualitiesCanBeSelected() {
    XCTAssertTrue(OwnReplySpeech.basicVoiceMatches(quality: .default, locale: "en-US", language: "en"))
    XCTAssertTrue(OwnReplySpeech.basicVoiceMatches(quality: .enhanced, locale: "en-US", language: "en"))
    XCTAssertTrue(OwnReplySpeech.basicVoiceMatches(quality: .premium, locale: "en-US", language: "en"))
  }
  func testLanguageMatchingDoesNotSilentlyFallback() {
    XCTAssertTrue(OwnReplySpeech.basicVoiceMatches(quality: .default, locale: "ru-RU", language: "ru"))
    XCTAssertFalse(OwnReplySpeech.basicVoiceMatches(quality: .default, locale: "en-US", language: "ru"))
    XCTAssertFalse(OwnReplySpeech.basicVoiceMatches(quality: .default, locale: "en-US", language: ""))
  }
}

final class ScenePrivacyCoverTests: XCTestCase {
  @MainActor func testCoverIsOpaqueFullWindowAndIdempotent() {
    let delegate = SceneDelegate()
    let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 390, height: 844))
    delegate.window = window
    delegate.showPrivacyCover()
    delegate.showPrivacyCover()
    let covers = window.subviews.filter { $0.accessibilityIdentifier == "own-privacy-cover" }
    XCTAssertEqual(covers.count, 1)
    XCTAssertEqual(covers.first?.frame, window.bounds)
    XCTAssertEqual(covers.first?.alpha, 1)
    XCTAssertEqual(covers.first?.backgroundColor, .systemBackground)
    delegate.hidePrivacyCover()
    XCTAssertFalse(window.subviews.contains { $0.accessibilityIdentifier == "own-privacy-cover" })
    delegate.hidePrivacyCover()
  }
  @MainActor func testNoWindowIsSafe() {
    let delegate = SceneDelegate()
    delegate.showPrivacyCover()
    delegate.hidePrivacyCover()
    XCTAssertNil(delegate.window)
  }
}

final class OwnLocalImportAndURLTests: XCTestCase {
  func testRejectsNonPublicAddresses() throws {
    XCTAssertFalse(PublicWebAddress.isPublicIPv4([127, 0, 0, 1]))
    XCTAssertFalse(PublicWebAddress.isPublicIPv4([169, 254, 169, 254]))
    XCTAssertFalse(PublicWebAddress.isPublicIPv4([192, 168, 1, 1]))
    XCTAssertFalse(PublicWebAddress.isPublicIPv4([100, 64, 0, 1]))
    XCTAssertTrue(PublicWebAddress.isPublicIPv4([93, 184, 216, 34]))
    let blockedPrefixes: [[UInt8]] = [[192, 0, 2, 1], [198, 51, 100, 1], [203, 0, 113, 1], [192, 88, 99, 2]]
    for address in blockedPrefixes {
      XCTAssertFalse(PublicWebAddress.isPublicIPv4(address))
    }
    let publicNeighbors: [[UInt8]] = [[192, 0, 1, 7], [198, 51, 99, 7], [198, 51, 101, 7], [203, 0, 112, 7], [203, 0, 114, 7]]
    for address in publicNeighbors {
      XCTAssertTrue(PublicWebAddress.isPublicIPv4(address), "Do not block the public neighbors of reserved /24 prefixes")
    }
    XCTAssertFalse(PublicWebAddress.isPublicIPv6([UInt8](repeating: 0, count: 16)))
    XCTAssertFalse(PublicWebAddress.isPublicIPv6([0x20, 0x02] + [UInt8](repeating: 0, count: 14)))
    XCTAssertThrowsError(try PublicWebAddress.resolve("127.0.0.1"))
    XCTAssertThrowsError(try PublicWebAddress.resolve("::1"))
    XCTAssertThrowsError(try PublicWebAddress.resolve("2130706433"))
  }

  func testPublicWebsiteFetchAndPrivateRejection() {
    let done = expectation(description: "public website")
    PublicWebFetcher().fetch("https://example.com", resolver: { value in
      XCTAssertTrue((value as? String ?? "").contains("Example Domain")); done.fulfill()
    }, rejecter: { _, message, _ in XCTFail(message ?? "Public website failed"); done.fulfill() })
    let blocked = expectation(description: "private website")
    PublicWebFetcher().fetch("http://2130706433", resolver: { _ in
      XCTFail("Private address must be rejected"); blocked.fulfill()
    }, rejecter: { _, _, _ in blocked.fulfill() })
    wait(for: [done, blocked], timeout: 45)
  }

  func testDecodesAudioToLocalMonoWAV() throws {
    let folder = try makeTempDirectory()
    defer { try? FileManager.default.removeItem(at: folder) }
    let source = folder.appendingPathComponent("source.wav")
    let format = try XCTUnwrap(AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 2))
    let buffer = try XCTUnwrap(AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 4410))
    buffer.frameLength = 4410
    for channel in 0..<2 {
      for frame in 0..<4410 { buffer.floatChannelData?[channel][frame] = Float(sin(Double(frame) * 0.03) * 0.1) }
    }
    do {
      let file = try AVAudioFile(forWriting: source, settings: format.settings)
      try file.write(from: buffer)
    }
    let done = expectation(description: "audio conversion")
    AudioImport().prepare(source.path, resolver: { value in
      guard let path = value as? String else { XCTFail("No WAV path"); done.fulfill(); return }
      defer { try? FileManager.default.removeItem(atPath: path) }
      do {
        let wav = try Data(contentsOf: URL(fileURLWithPath: path))
        XCTAssertEqual(String(data: wav.prefix(4), encoding: .ascii), "RIFF")
        XCTAssertEqual(Array(wav[22..<24]), [1, 0])
        XCTAssertEqual(Array(wav[24..<28]), [128, 62, 0, 0])
        XCTAssertGreaterThan(wav.count, 44)
      } catch { XCTFail("Could not inspect converted WAV") }
      done.fulfill()
    }, rejecter: { _, message, _ in XCTFail(message ?? "Audio failed"); done.fulfill() })
    wait(for: [done], timeout: 20)
  }

  func testRecognizesPhotoAndScannedPDFLocally() throws {
    let folder = try makeTempDirectory()
    defer { try? FileManager.default.removeItem(at: folder) }
    let image = UIGraphicsImageRenderer(size: CGSize(width: 800, height: 200)).image { context in
      UIColor.white.setFill(); context.fill(CGRect(x: 0, y: 0, width: 800, height: 200))
      ("ORCHID 123" as NSString).draw(at: CGPoint(x: 40, y: 50), withAttributes: [.font: UIFont.systemFont(ofSize: 60), .foregroundColor: UIColor.black])
    }
    let photo = folder.appendingPathComponent("scan.png")
    try XCTUnwrap(image.pngData()).write(to: photo)
    let pdf = folder.appendingPathComponent("scan.pdf")
    try UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 800, height: 200)).writePDF(to: pdf) { context in
      context.beginPage(); image.draw(at: .zero)
    }
    let photoDone = expectation(description: "photo OCR")
    let pdfDone = expectation(description: "scanned PDF OCR")
    PDFExtractorModule().extractImageText(photo.path, maxChars: 1000, resolver: { value in
      XCTAssertTrue((value as? String ?? "").contains("ORCHID")); photoDone.fulfill()
    }, rejecter: { _, message, _ in XCTFail(message ?? "OCR failed"); photoDone.fulfill() })
    PDFExtractorModule().extractText(pdf.path, maxChars: 1000, resolver: { value in
      XCTAssertTrue((value as? String ?? "").contains("ORCHID")); pdfDone.fulfill()
    }, rejecter: { _, message, _ in XCTFail(message ?? "PDF OCR failed"); pdfDone.fulfill() })
    wait(for: [photoDone, pdfDone], timeout: 30)
  }
  func testImageExportPreservesAspectRatioAndRequestedCanvas() throws {
    let rect = CoreMLDiffusionModule.fittedImageRect(
      source: CGSize(width: 1024, height: 1024), target: CGSize(width: 512, height: 256))
    XCTAssertEqual(rect, CGRect(x: 128, y: 0, width: 256, height: 256))
    let tall = CoreMLDiffusionModule.fittedImageRect(
      source: CGSize(width: 1024, height: 512), target: CGSize(width: 256, height: 512))
    XCTAssertEqual(tall, CGRect(x: 0, y: 192, width: 256, height: 128))
    let input = UIGraphicsImageRenderer(size: CGSize(width: 8, height: 8)).image { context in
      UIColor.red.setFill()
      context.fill(CGRect(x: 0, y: 0, width: 8, height: 8))
    }
    let image = CoreMLDiffusionModule.exportImage(try XCTUnwrap(input.cgImage), size: CGSize(width: 32, height: 16))
    let decoded = try XCTUnwrap(UIImage(data: try XCTUnwrap(image.pngData())))
    XCTAssertEqual(decoded.size, CGSize(width: 32, height: 16))
  }

}

@MainActor
final class CoreMLImagePreviewTests: XCTestCase {
  private func sourceImage() throws -> CGImage {
    let image = UIGraphicsImageRenderer(size: CGSize(width: 800, height: 400)).image { context in
      UIColor.red.setFill()
      context.fill(CGRect(x: 0, y: 0, width: 800, height: 400))
    }
    return try XCTUnwrap(image.cgImage)
  }

  func testDisabledPreviewDoesNotDecodeAndReportsCompletedStep() throws {
    let previews = CoreMLImagePreviewSession(interval: 0, requestId: "request-off")
    defer { previews.cleanup() }
    let event = try XCTUnwrap(previews.progressEvent(rawStep: 0, totalSteps: 20, isCancelled: { false }, decode: {
      XCTFail("A disabled preview must not load the image decoder")
      return nil
    }))
    XCTAssertEqual(event["requestId"] as? String, "request-off")
    XCTAssertEqual(event["step"] as? Int, 1)
    XCTAssertEqual(event["progress"] as? Double, 0.05)
    XCTAssertNil(event["previewPath"])
    XCTAssertFalse(FileManager.default.fileExists(atPath: previews.directory.path))
  }

  func testPreviewPolicyClampsCadenceAndBoundsStoredFrames() {
    XCTAssertEqual((1...20).filter { CoreMLImagePreviewSession.shouldPreview(completedStep: $0, totalSteps: 20, interval: 1) }, [5, 10, 15])
    for count in [1, 4, 8, 20, 1000] {
      let frames = (1...count).filter { CoreMLImagePreviewSession.shouldPreview(completedStep: $0, totalSteps: count, interval: 5) }
      XCTAssertLessThanOrEqual(frames.count, 7)
      XCTAssertFalse(frames.contains(count), "The final image is returned directly, not decoded again for preview")
    }
    XCTAssertFalse(CoreMLImagePreviewSession.shouldPreview(completedStep: 5, totalSteps: 20, interval: -1))
    XCTAssertEqual(CoreMLImagePreviewSession.completedStep(Int.max, totalSteps: 20), 20)
    XCTAssertEqual(CoreMLImagePreviewSession.completedStep(-1, totalSteps: 20), 0)
  }

  func testPreviewEncodesRealPNGAndCleansOnlyItsOwnedDirectory() throws {
    let originalFolder = try makeTempDirectory()
    defer { try? FileManager.default.removeItem(at: originalFolder) }
    let original = originalFolder.appendingPathComponent("original.png")
    try Data("existing user image".utf8).write(to: original)
    let previews = CoreMLImagePreviewSession(interval: 5, requestId: "request-preview")
    defer { previews.cleanup() }
    let source = try sourceImage()
    let event = try XCTUnwrap(previews.progressEvent(rawStep: 4, totalSteps: 20, isCancelled: { false }, decode: { source }))
    let path = try XCTUnwrap(event["previewPath"] as? String)
    XCTAssertTrue(path.hasPrefix(previews.directory.path + "/"))
    let decoded = try XCTUnwrap(UIImage(data: Data(contentsOf: URL(fileURLWithPath: path))))
    XCTAssertEqual(decoded.size, CGSize(width: 256, height: 128))
    previews.cleanup()
    previews.cleanup()
    XCTAssertFalse(FileManager.default.fileExists(atPath: previews.directory.path))
    XCTAssertEqual(try Data(contentsOf: original), Data("existing user image".utf8))
  }

  func testDecoderFailureOnlyDisablesOptionalDrafts() throws {
    let previews = CoreMLImagePreviewSession(interval: 5, requestId: "request-error")
    defer { previews.cleanup() }
    var decodes = 0
    let event = previews.progressEvent(rawStep: 4, totalSteps: 20, isCancelled: { false }, decode: {
      decodes += 1
      throw NSError(domain: "OwnPreviewFixture", code: 1)
    })
    XCTAssertNotNil(event)
    XCTAssertNil(event?["previewPath"])
    XCTAssertFalse(previews.isEnabled)
    let next = previews.progressEvent(rawStep: 9, totalSteps: 20, isCancelled: { false }, decode: { decodes += 1; return nil })
    XCTAssertEqual(next?["step"] as? Int, 10)
    XCTAssertEqual(decodes, 1)
    XCTAssertFalse(FileManager.default.fileExists(atPath: previews.directory.path))
  }

  func testCancelDuringDecodeDoesNotWriteOrPublishDraft() throws {
    let previews = CoreMLImagePreviewSession(interval: 5, requestId: "request-cancel")
    defer { previews.cleanup() }
    let source = try sourceImage()
    let alreadyCancelled = previews.progressEvent(rawStep: 4, totalSteps: 20, isCancelled: { true }, decode: {
      XCTFail("Cancellation before decoding must not load the decoder")
      return source
    })
    XCTAssertNil(alreadyCancelled)
    var cancelled = false
    let event = previews.progressEvent(rawStep: 4, totalSteps: 20, isCancelled: { cancelled }, decode: {
      cancelled = true
      return source
    })
    XCTAssertNil(event)
    XCTAssertFalse(FileManager.default.fileExists(atPath: previews.directory.path))
  }

  func testNilSafetyImageDoesNotCreateADraftOrDisableGeneration() throws {
    let previews = CoreMLImagePreviewSession(interval: 5, requestId: "request-no-image")
    defer { previews.cleanup() }
    let event = previews.progressEvent(rawStep: 4, totalSteps: 20, isCancelled: { false }, decode: { nil })
    XCTAssertEqual(event?["step"] as? Int, 5)
    XCTAssertNil(event?["previewPath"])
    XCTAssertTrue(previews.isEnabled)
    XCTAssertFalse(FileManager.default.fileExists(atPath: previews.directory.path))
  }

  func testOwnedDraftDirectoryIsRemovedOnDeinit() throws {
    var previews: CoreMLImagePreviewSession? = CoreMLImagePreviewSession(interval: 5, requestId: "request-release")
    let source = try sourceImage()
    let directory = try XCTUnwrap(previews?.directory)
    _ = previews?.progressEvent(rawStep: 4, totalSteps: 20, isCancelled: { false }, decode: { source })
    XCTAssertTrue(FileManager.default.fileExists(atPath: directory.path))
    previews = nil
    XCTAssertFalse(FileManager.default.fileExists(atPath: directory.path))
  }
}

final class CoreMLImageOutputTests: XCTestCase {
  func testCancellationAfterEncodingLeavesNoOutput() throws {
    let folder = try makeTempDirectory()
    defer { try? FileManager.default.removeItem(at: folder) }
    var cancelled = false
    XCTAssertThrowsError(try CoreMLImageOutput.persist(
      to: folder.appendingPathComponent("new.png"), isCancelled: { cancelled }, encode: {
        cancelled = true
        return Data("encoded".utf8)
      })) { XCTAssertTrue($0 is CancellationError) }
    XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: folder.path), [])
  }

  func testCancellationDuringWriteCleansStagingAndPreservesExistingTarget() throws {
    let folder = try makeTempDirectory()
    defer { try? FileManager.default.removeItem(at: folder) }
    let target = folder.appendingPathComponent("existing.png")
    let original = Data("original user image".utf8)
    try original.write(to: target)
    var cancelled = false
    XCTAssertThrowsError(try CoreMLImageOutput.persist(
      to: target, isCancelled: { cancelled }, encode: { Data("new".utf8) }, write: { data, url in
        try data.write(to: url)
        cancelled = true
      })) { XCTAssertTrue($0 is CancellationError) }
    XCTAssertEqual(try Data(contentsOf: target), original)
    XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: folder.path), ["existing.png"])
    XCTAssertThrowsError(try CoreMLImageOutput.persist(
      to: target, isCancelled: { false }, encode: { Data("replacement".utf8) }))
    XCTAssertEqual(try Data(contentsOf: target), original)
  }

  func testCancellationAfterPublishingRemovesOnlyNewOutput() throws {
    let folder = try makeTempDirectory()
    defer { try? FileManager.default.removeItem(at: folder) }
    let target = folder.appendingPathComponent("new.png")
    XCTAssertThrowsError(try CoreMLImageOutput.persist(
      to: target, isCancelled: { FileManager.default.fileExists(atPath: target.path) },
      encode: { Data("new".utf8) })) { XCTAssertTrue($0 is CancellationError) }
    XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: folder.path), [])
  }
}

// MARK: - Optional image pipeline retention policy (no Core ML model allocation)
final class OwnImageRetentionPolicyTests: XCTestCase {
  func testOptInAndEnvironmentAdmission() {
    let policy = OwnImageRetentionPolicy()
    let initial = policy.ticket()
    XCTAssertFalse(policy.permits(ticket: initial, enabled: true, lowPower: false, thermal: .nominal))
    policy.invalidate(active: true)
    let ticket = policy.ticket()
    XCTAssertFalse(policy.permits(ticket: ticket, enabled: false, lowPower: false, thermal: .nominal))
    XCTAssertTrue(policy.permits(ticket: ticket, enabled: true, lowPower: false, thermal: .nominal))
    XCTAssertTrue(policy.permits(ticket: ticket, enabled: true, lowPower: false, thermal: .fair))
    XCTAssertFalse(policy.permits(ticket: ticket, enabled: true, lowPower: true, thermal: .nominal))
    XCTAssertFalse(policy.permits(ticket: ticket, enabled: true, lowPower: false, thermal: .serious))
    XCTAssertFalse(policy.permits(ticket: ticket, enabled: true, lowPower: false, thermal: .critical))
  }
  func testEvictionAndRecoveryCannotRefillFromOldCompletion() {
    let policy = OwnImageRetentionPolicy()
    policy.invalidate(active: true)
    let activeReply = policy.ticket()
    policy.invalidate(active: false)
    policy.invalidate(active: true)
    XCTAssertFalse(policy.permits(ticket: activeReply, enabled: true, lowPower: false, thermal: .nominal))
    XCTAssertTrue(policy.permits(ticket: policy.ticket(), enabled: true, lowPower: false, thermal: .nominal))
    let recovered = policy.ticket()
    policy.invalidate() // preference off, pressure, timer, or power/thermal notification
    XCTAssertFalse(policy.permits(ticket: recovered, enabled: true, lowPower: false, thermal: .nominal))
  }
}

final class OwnImageIdleLeaseTests: XCTestCase {
  func testRejectedRequestKeepsOriginalDeadline() {
    var lease = OwnImageIdleLease()
    let timer = lease.retain(now: 10)
    XCTAssertFalse(lease.admit(validRequest: false))
    XCTAssertFalse(lease.expires(revision: timer, now: 69.99))
    XCTAssertTrue(lease.expires(revision: timer, now: 70))
  }
  func testEnvironmentEpochChangeCannotDisableIdleExpiry() {
    let environment = OwnImageRetentionPolicy()
    var lease = OwnImageIdleLease()
    let timer = lease.retain(now: 20)
    environment.invalidate(active: true)
    XCTAssertTrue(lease.expires(revision: timer, now: 80))
    lease.release() // production foreground handler queues this RAM-only release
    XCTAssertFalse(lease.expires(revision: timer, now: 80))
  }
  func testValidAdmissionAndNewRetentionRejectOldTimer() {
    var lease = OwnImageIdleLease()
    let oldTimer = lease.retain(now: 10)
    XCTAssertTrue(lease.admit(validRequest: true))
    XCTAssertFalse(lease.expires(revision: oldTimer, now: 100))
    let newTimer = lease.retain(now: 100)
    XCTAssertFalse(lease.expires(revision: oldTimer, now: 200))
    XCTAssertFalse(lease.expires(revision: newTimer, now: 159))
    XCTAssertTrue(lease.expires(revision: newTimer, now: 160))
  }
}
