import XCTest
import UIKit
import ImageIO
import UniformTypeIdentifiers
@testable import Own

@MainActor
final class VisionImagePreparationTests: XCTestCase {
  private func fixture(color: UIColor = .red, orientation: Int = 1) throws -> Data {
    let image = UIGraphicsImageRenderer(size: CGSize(width: 800, height: 400)).image { context in
      color.setFill(); context.fill(CGRect(x: 0, y: 0, width: 800, height: 400))
    }
    let data = NSMutableData()
    let destination = try XCTUnwrap(CGImageDestinationCreateWithData(data, UTType.jpeg.identifier as CFString, 1, nil))
    CGImageDestinationAddImage(destination, try XCTUnwrap(image.cgImage), [kCGImagePropertyOrientation: orientation] as CFDictionary)
    XCTAssertTrue(CGImageDestinationFinalize(destination))
    return data as Data
  }

  func testContentAndModelIdentityInvalidationPreserveOriginal() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let original = root.appendingPathComponent("photo.jpg")
    let bytes = try fixture()
    try bytes.write(to: original)
    let cache = VisionImagePreparationCache(directory: root.appendingPathComponent("derived"))
    let first = try cache.prepare(source: original, identity: "model-A/vision-A", maximumEdge: 256, owner: "one", isCancelled: { false })
    let second = try cache.prepare(source: original, identity: "model-A/vision-A", maximumEdge: 256, owner: "two", isCancelled: { false })
    XCTAssertEqual(first, second)
    XCTAssertEqual(try Data(contentsOf: original), bytes)
    let changedModel = try cache.prepare(source: original, identity: "model-B/vision-B", maximumEdge: 256, owner: "three", isCancelled: { false })
    XCTAssertNotEqual(first, changedModel)
    try fixture(color: .blue).write(to: original)
    let changedContent = try cache.prepare(source: original, identity: "model-A/vision-A", maximumEdge: 256, owner: "four", isCancelled: { false })
    XCTAssertNotEqual(first, changedContent)
    cache.cleanup()
    XCTAssertTrue(FileManager.default.fileExists(atPath: original.path))
    XCTAssertFalse(FileManager.default.fileExists(atPath: cache.directory.path))
  }

  func testBoundedReadRejectsActualOversizeAndPreservesSource() throws {
    let source = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: source) }
    let bytes = Data(repeating: 7, count: 65)
    try bytes.write(to: source)
    XCTAssertThrowsError(try VisionImagePreparationCache.boundedSourceData(source, maximumBytes: 64))
    XCTAssertEqual(try VisionImagePreparationCache.boundedSourceData(source, maximumBytes: 65), bytes)
    XCTAssertEqual(try Data(contentsOf: source), bytes)
  }

  func testBoundedReadCancellationStopsBetweenChunksAndPreservesSource() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let source = root.appendingPathComponent("source.bin")
    let bytes = Data(repeating: 7, count: 2 * 1024 * 1024)
    try bytes.write(to: source)
    var checks = 0
    XCTAssertThrowsError(try VisionImagePreparationCache.boundedSourceData(source, maximumBytes: bytes.count,
      isCancelled: { checks += 1; return checks >= 3 })) { error in
      guard case VisionImagePreparationCache.Failure.cancelled = error else {
        XCTFail("Expected cancellation, got \(error)"); return
      }
    }
    XCTAssertEqual(checks, 3)
    XCTAssertEqual(try Data(contentsOf: source), bytes)
    XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: root.path), ["source.bin"])
  }

  func testOrientationAndAspectAreNormalizedToBoundedPNG() throws {
    let data = try VisionImagePreparationCache.thumbnailPNG(data: fixture(orientation: 6), maximumEdge: 256)
    let image = try XCTUnwrap(UIImage(data: data))
    XCTAssertEqual(image.size, CGSize(width: 128, height: 256))
    XCTAssertEqual(image.imageOrientation, .up)
    XCTAssertEqual(Array(data.prefix(8)), [137, 80, 78, 71, 13, 10, 26, 10])
  }

  func testPinnedFilesCannotBeEvictedAndCancelledOutputIsNotWritten() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let original = root.appendingPathComponent("photo.jpg")
    try fixture().write(to: original)
    let cache = VisionImagePreparationCache(directory: root.appendingPathComponent("derived"), maximumEntries: 1)
    let first = try cache.prepare(source: original, identity: "a", maximumEdge: 256, owner: "one", isCancelled: { false })
    XCTAssertThrowsError(try cache.prepare(source: original, identity: "b", maximumEdge: 256, owner: "two", isCancelled: { false }))
    XCTAssertTrue(FileManager.default.fileExists(atPath: first.path))
    cache.release(owner: "one")
    let second = try cache.prepare(source: original, identity: "b", maximumEdge: 256, owner: "two", isCancelled: { false })
    XCTAssertFalse(FileManager.default.fileExists(atPath: first.path))
    XCTAssertTrue(FileManager.default.fileExists(atPath: second.path))
    XCTAssertThrowsError(try cache.prepare(source: original, identity: "cancel", maximumEdge: 256, owner: "three", isCancelled: { true }))
    XCTAssertEqual(cache.entries.count, 1)
  }
}
