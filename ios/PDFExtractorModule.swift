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
