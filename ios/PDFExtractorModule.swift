import Foundation
import PDFKit
import Vision
import UIKit
import ImageIO

// Do not even evaluate private diagnostic payloads in a Release build.
func pdfDebugLog(_ message: @autoclosure () -> String) {
#if DEBUG
  print(message())
#endif
}

@objc(PDFExtractorModule)
class PDFExtractorModule: NSObject {

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc
  // swiftlint:disable:next cyclomatic_complexity
  func extractText(_ filePath: String, maxChars: Double, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.global(qos: .userInitiated).async {
      pdfDebugLog("[PDFExtractor] Received filePath: \(filePath)")

      // Parse the file path as a URL
      var url: URL?
      if filePath.hasPrefix("file://") {
        url = URL(string: filePath)
      } else {
        url = URL(fileURLWithPath: filePath)
      }

      guard let url = url else {
        reject("PDF_ERROR", "Invalid file path: \(filePath)", nil as NSError?)
        return
      }

      pdfDebugLog("[PDFExtractor] Parsed URL: \(url.path)")
      pdfDebugLog("[PDFExtractor] URL scheme: \(url.scheme ?? "none")")

      // For security-scoped resources (files from document picker), we need to request access
      let didStartAccessing = url.startAccessingSecurityScopedResource()
      pdfDebugLog("[PDFExtractor] Security-scoped access: \(didStartAccessing)")

      // Check if file exists
      let fileManager = FileManager.default
      var isDirectory: ObjCBool = false
      let exists = fileManager.fileExists(atPath: url.path, isDirectory: &isDirectory)
      pdfDebugLog("[PDFExtractor] File exists: \(exists), isDirectory: \(isDirectory.boolValue)")

      if !exists {
        // Try alternate path without file:// prefix components
        let alternatePath = url.path
        let alternateExists = fileManager.fileExists(atPath: alternatePath, isDirectory: &isDirectory)
        pdfDebugLog("[PDFExtractor] Alternate path exists: \(alternateExists)")
      }

      defer {
        if didStartAccessing {
          url.stopAccessingSecurityScopedResource()
        }
      }

      // Check if file is readable
      let isReadable = fileManager.isReadableFile(atPath: url.path)
      pdfDebugLog("[PDFExtractor] File is readable: \(isReadable)")

      // Attempt to open the PDF document
      guard let document = PDFDocument(url: url) else {
        // Try to get more specific error info
        let pathExtension = url.pathExtension.lowercased()
        var errorMessage = "Could not open PDF file"

        if !exists {
          errorMessage = "File does not exist at path: \(url.path)"
        } else if !isReadable {
          errorMessage = "File is not readable (permission denied): \(url.path)"
        } else if pathExtension != "pdf" {
          errorMessage = "File extension '\(pathExtension)' is not PDF"
        } else {
          // File exists and is readable but PDFKit couldn't open it
          // Try to read first few bytes to verify it's a PDF
          do {
            let data = try Data(contentsOf: url, options: .mappedIfSafe)
            let firstBytes = data.prefix(8)
            let header = firstBytes.map { String(format: "%02X", $0) }.joined(separator: " ")
            pdfDebugLog("[PDFExtractor] File header (hex): \(header)")

            if data.count < 5 {
              errorMessage = "File is too small to be a valid PDF: \(data.count) bytes"
            } else if let asciiData = "%PDF-".data(using: .ascii), !data.prefix(5).elementsEqual(asciiData) {
              errorMessage = "File does not have valid PDF header. Got: \(header)"
            } else {
              errorMessage = "PDFKit could not parse the PDF file. File size: \(data.count) bytes"
            }
          } catch {
            errorMessage = "Could not read file data: \(error.localizedDescription)"
          }
        }

        pdfDebugLog("[PDFExtractor] Error: \(errorMessage)")
        reject("PDF_ERROR", errorMessage, nil as NSError?)
        return
      }

      pdfDebugLog("[PDFExtractor] Successfully opened PDF with \(document.pageCount) pages")

      let limit = max(1, min(200_000, Int(maxChars)))
      var fullText = ""
      guard document.pageCount <= 200 else {
        reject("PDF_ERROR", "Choose a PDF with no more than 200 pages.", nil)
        return
      }
      for pageIndex in 0..<document.pageCount {
        if let page = document.page(at: pageIndex) {
          var pageText = page.string ?? ""
          if pageText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let image = page.thumbnail(of: CGSize(width: 1600, height: 1600), for: .mediaBox)
            if let cgImage = image.cgImage {
              do { pageText = try Self.recognize(cgImage) }
              catch { reject("OCR_ERROR", "Could not read scanned PDF page \(pageIndex + 1).", error); return }
            }
          }
          fullText += pageText + "\n\n"
        }

        if fullText.count >= limit {
          fullText = String(fullText.prefix(limit))
          fullText += "\n\n... [Extracted \(pageIndex + 1) of \(document.pageCount) pages]"
          break
        }
      }

      pdfDebugLog("[PDFExtractor] Extracted \(fullText.count) characters")
      resolve(fullText)
    }
  }
  static func recognize(_ image: CGImage) throws -> String {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.automaticallyDetectsLanguage = true
    try VNImageRequestHandler(cgImage: image).perform([request])
    return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
  }

  @objc func extractImageText(_ filePath: String, maxChars: Double,
                              resolver resolve: @escaping RCTPromiseResolveBlock,
                              rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.global(qos: .userInitiated).async {
      let url = filePath.hasPrefix("file://") ? URL(string: filePath) : URL(fileURLWithPath: filePath)
      guard let url = url, url.isFileURL else { reject("OCR_ERROR", "Invalid image file.", nil); return }
      let scoped = url.startAccessingSecurityScopedResource()
      defer { if scoped { url.stopAccessingSecurityScopedResource() } }
      do {
        // Thumbnail decoding bounds memory for large camera images and respects EXIF orientation.
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: 3000
              ] as CFDictionary) else { throw NSError(domain: "OwnOCR", code: 1) }
        let text = try Self.recognize(image)
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
          reject("OCR_ERROR", "No readable text found in this image.", nil); return
        }
        resolve(String(text.prefix(max(1, min(200_000, Int(maxChars))))))
      } catch { reject("OCR_ERROR", "Could not read text from this image.", error) }
    }
  }

}

extension PDFExtractorModule {
  @objc func prepareVisionImages(_ paths: [String], options: NSDictionary, request: String,
                                 resolver resolve: @escaping RCTPromiseResolveBlock,
                                 rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let identity = options["identity"] as? String, let maximumEdge = options["maximumEdge"] as? Double,
          maximumEdge.isFinite, maximumEdge >= 224, maximumEdge <= 2048 else {
      reject("VISION_PREPARATION", "Invalid image preparation size", nil); return
    }
    VisionPreparationCoordinator.shared.prepare(paths: paths, identity: identity, edge: Int(maximumEdge), request: request) {
      switch $0 {
      case .success(let prepared): resolve(prepared)
      case .failure(let error): reject("VISION_PREPARATION", "Could not prepare image for the model", error)
      }
    }
  }

  @objc func finishVisionPreparation(_ request: String, resolver resolve: RCTPromiseResolveBlock,
                                     rejecter _: RCTPromiseRejectBlock) {
    VisionPreparationCoordinator.shared.finish(request: request)
    resolve(true)
  }
}

import CryptoKit
import UniformTypeIdentifiers

/// Private derived files only. Serial callers own cache state; active requests pin their files.
final class VisionImagePreparationCache {
  struct Entry { let url: URL; let bytes: Int; var used: UInt64; var owners: Set<String> }
  enum Failure: Error { case invalidInput, unreadableImage, capacity, cancelled }
  private(set) var entries: [String: Entry] = [:]
  let directory: URL
  private var clock: UInt64 = 0
  private let maximumBytes: Int
  private let maximumEntries: Int
  static let processDirectory: URL = {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("OwnVisionDerived-v1", isDirectory: true)
    // Reclaim only this feature's private derived files left after process termination.
    try? FileManager.default.removeItem(at: root)
    return root
  }()

  init(directory: URL = VisionImagePreparationCache.processDirectory.appendingPathComponent(UUID().uuidString),
       maximumBytes: Int = 32 * 1024 * 1024, maximumEntries: Int = 8) {
    self.directory = directory
    self.maximumBytes = maximumBytes
    self.maximumEntries = maximumEntries
  }

  func prepare(source: URL, identity: String, maximumEdge: Int, owner: String,
               isCancelled: () -> Bool) throws -> URL {
    guard source.isFileURL, !identity.isEmpty, identity.utf8.count <= 4096,
          maximumEdge >= 224, maximumEdge <= 2048 else { throw Failure.invalidInput }
    if isCancelled() { throw Failure.cancelled }
    let access = source.startAccessingSecurityScopedResource()
    defer { if access { source.stopAccessingSecurityScopedResource() } }
    let size = try source.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey])
    guard size.isRegularFile == true, let bytes = size.fileSize, bytes > 0, bytes <= 64 * 1024 * 1024 else {
      throw Failure.invalidInput
    }
    // Hash and decode the same immutable bytes, including changes at an unchanged path.
    let data = try Self.boundedSourceData(source, maximumBytes: 64 * 1024 * 1024, isCancelled: isCancelled)
    if isCancelled() { throw Failure.cancelled }
    let digest = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    let keyData = try JSONSerialization.data(withJSONObject: ["own-vision-v1", identity, String(maximumEdge), digest])
    let key = SHA256.hash(data: keyData).map { String(format: "%02x", $0) }.joined()
    if isCancelled() { throw Failure.cancelled }
    clock &+= 1
    if var entry = entries[key], FileManager.default.fileExists(atPath: entry.url.path) {
      entry.used = clock
      entry.owners.insert(owner)
      entries[key] = entry
      return entry.url
    }
    let png = try Self.thumbnailPNG(data: data, maximumEdge: maximumEdge)
    if isCancelled() { throw Failure.cancelled }
    try makeRoom(for: png.count)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true,
                                            attributes: [.protectionKey: FileProtectionType.complete])
    let output = directory.appendingPathComponent("\(key).png")
    try png.write(to: output, options: [.atomic, .completeFileProtection])
    if isCancelled() {
      try? FileManager.default.removeItem(at: output)
      throw Failure.cancelled
    }
    entries[key] = Entry(url: output, bytes: png.count, used: clock, owners: [owner])
    return output
  }

  static func boundedSourceData(_ source: URL, maximumBytes: Int, isCancelled: () -> Bool = { false }) throws -> Data {
    if isCancelled() { throw Failure.cancelled }
    let handle = try FileHandle(forReadingFrom: source)
    defer { try? handle.close() }
    // Do not rely on the earlier stat: the source may grow before/during this read.
    guard maximumBytes > 0, maximumBytes < Int.max else { throw Failure.invalidInput }
    var data = Data()
    while data.count <= maximumBytes {
      if isCancelled() { throw Failure.cancelled }
      let count = min(1024 * 1024, maximumBytes + 1 - data.count)
      guard let chunk = try handle.read(upToCount: count), !chunk.isEmpty else { break }
      if isCancelled() { throw Failure.cancelled }
      data.append(chunk)
    }
    guard !data.isEmpty, data.count <= maximumBytes else { throw Failure.invalidInput }
    return data
  }

  static func thumbnailPNG(data: Data, maximumEdge: Int) throws -> Data {
    guard let source = CGImageSourceCreateWithData(data as CFData, nil),
          let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
          let width = properties[kCGImagePropertyPixelWidth] as? Int,
          let height = properties[kCGImagePropertyPixelHeight] as? Int,
          width > 0, height > 0 else { throw Failure.unreadableImage }
    let boundedEdge = min(maximumEdge, max(width, height))
    guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: boundedEdge,
            kCGImageSourceShouldCacheImmediately: true
          ] as CFDictionary) else { throw Failure.unreadableImage }
    let output = NSMutableData()
    guard let destination = CGImageDestinationCreateWithData(output, UTType.png.identifier as CFString, 1, nil) else {
      throw Failure.unreadableImage
    }
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else { throw Failure.unreadableImage }
    return output as Data
  }

  func release(owner: String) {
    for key in Array(entries.keys) { entries[key]?.owners.remove(owner) }
  }

  private func makeRoom(for bytes: Int) throws {
    guard bytes <= maximumBytes else { throw Failure.capacity }
    while entries.count >= maximumEntries || entries.values.reduce(0, { $0 + $1.bytes }) + bytes > maximumBytes {
      guard let victim = entries.filter({ $0.value.owners.isEmpty }).min(by: { $0.value.used < $1.value.used }) else {
        throw Failure.capacity
      }
      try FileManager.default.removeItem(at: victim.value.url)
      entries.removeValue(forKey: victim.key)
    }
  }

  func cleanup() {
    entries.removeAll()
    try? FileManager.default.removeItem(at: directory)
  }
  deinit { cleanup() }
}

private final class VisionPreparationTicket {
  private let lock = NSLock()
  private var cancelled = false
  var isCancelled: Bool { lock.lock(); defer { lock.unlock() }; return cancelled }
  func cancel() { lock.lock(); cancelled = true; lock.unlock() }
}

/// Queue owns derived files; the lock only owns cancellation tickets, never image decoding.
final class VisionPreparationCoordinator {
  static let shared = VisionPreparationCoordinator()
  private let queue = DispatchQueue(label: "Own.visionPreparation")
  private let lock = NSLock()
  private var tickets: [String: VisionPreparationTicket] = [:]
  private let cache = VisionImagePreparationCache()

  func prepare(paths: [String], identity: String, edge: Int, request: String,
               completion: @escaping (Result<[String], Error>) -> Void) {
    guard !request.isEmpty, request.utf8.count <= 128, paths.count <= 8 else {
      completion(.failure(VisionImagePreparationCache.Failure.invalidInput)); return
    }
    let ticket = VisionPreparationTicket()
    lock.lock()
    guard tickets[request] == nil else {
      lock.unlock(); completion(.failure(VisionImagePreparationCache.Failure.invalidInput)); return
    }
    tickets[request] = ticket
    lock.unlock()
    queue.async {
      do {
        let urls = try paths.map { path -> String in
          let source = path.hasPrefix("file://") ? URL(string: path) : URL(fileURLWithPath: path)
          guard let source else { throw VisionImagePreparationCache.Failure.invalidInput }
          return try self.cache.prepare(source: source, identity: identity, maximumEdge: edge, owner: request,
                                        isCancelled: { ticket.isCancelled }).absoluteString
        }
        if ticket.isCancelled { throw VisionImagePreparationCache.Failure.cancelled }
        completion(.success(urls))
      } catch {
        self.cache.release(owner: request)
        self.finish(request: request)
        completion(.failure(error))
      }
    }
  }

  func finish(request: String) {
    lock.lock()
    let ticket = tickets.removeValue(forKey: request)
    ticket?.cancel()
    lock.unlock()
    queue.async { self.cache.release(owner: request) }
  }
}
