// swiftlint:disable file_length
import Foundation
import UIKit
import CoreML
import React
import StableDiffusion

/// Thread-safe invalidation ticket; never controls active inference cancellation.
final class OwnImageRetentionPolicy {
  private let lock = NSLock()
  private var epoch: UInt64 = 0
  private var active = false
  func ticket() -> UInt64 { lock.lock(); defer { lock.unlock() }; return epoch }
  func invalidate(active: Bool? = nil) {
    lock.lock(); defer { lock.unlock() }
    epoch &+= 1
    if let active = active { self.active = active }
  }
  func permits(ticket: UInt64, enabled: Bool, lowPower: Bool, thermal: ProcessInfo.ThermalState) -> Bool {
    lock.lock(); defer { lock.unlock() }
    return enabled && active && ticket == epoch && !lowPower && (thermal == .nominal || thermal == .fair)
  }
}

/// Serial-queue idle ownership, independent from environment/generation epoch.
struct OwnImageIdleLease {
  private(set) var revision: UInt64 = 0
  private var deadline: TimeInterval?
  mutating func admit(validRequest: Bool) -> Bool {
    guard validRequest else { return false }
    revision &+= 1; deadline = nil
    return true
  }
  mutating func retain(now: TimeInterval) -> UInt64 {
    revision &+= 1; deadline = now + 60
    return revision
  }
  mutating func release() { revision &+= 1; deadline = nil }
  func expires(revision: UInt64, now: TimeInterval) -> Bool {
    guard revision == self.revision, let deadline = deadline else { return false }
    return now >= deadline
  }
}

/// React Native bridge for Apple's ml-stable-diffusion pipeline.
/// Provides the native Core ML image generation interface.
/// can use a single abstraction via Platform.select().
@objc(CoreMLDiffusionModule)
class CoreMLDiffusionModule: RCTEventEmitter {

  // MARK: - State

  /// Both StableDiffusionPipeline and StableDiffusionXLPipeline conform to
  /// StableDiffusionPipelineProtocol, so we store whichever one was created.
  private var pipeline: StableDiffusionPipelineProtocol?
  private var loadedModelPath: String? {
    didSet { reportResidency() }
  }
  private let retention = OwnImageRetentionPolicy()
  private var idleExpiry: DispatchWorkItem?
  private var idleLease = OwnImageIdleLease()
  private var residencyRevision = 0
  private var generatingFlag = false
  private var generating: Bool {
    get { cancellationLock.lock(); defer { cancellationLock.unlock() }; return generatingFlag }
    set { cancellationLock.lock(); generatingFlag = newValue; cancellationLock.unlock() }
  }
  private let cancellationLock = NSLock()
  private var cancellationFlag = false
  private var cancelRequested: Bool {
    get {
      cancellationLock.lock()
      defer { cancellationLock.unlock() }
      return cancellationFlag
    }
    set {
      cancellationLock.lock()
      cancellationFlag = newValue
      cancellationLock.unlock()
    }
  }

  // Serial queue for all pipeline operations
  private let pipelineQueue = DispatchQueue(label: "io.github.ios3kov.own.coreml.diffusion", qos: .userInitiated)

  override init() {
    super.init()
    _ = ProcessInfo.processInfo.thermalState
    for name in [UIApplication.didReceiveMemoryWarningNotification, UIApplication.didEnterBackgroundNotification,
                 ProcessInfo.thermalStateDidChangeNotification, Notification.Name.NSProcessInfoPowerStateDidChange] {
      NotificationCenter.default.addObserver(self, selector: #selector(environmentChanged), name: name, object: nil)
    }
    NotificationCenter.default.addObserver(self, selector: #selector(becameActive),
      name: UIApplication.didBecomeActiveNotification, object: nil)
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      self.retention.invalidate(active: self.applicationIsActive())
    }
  }

  deinit { NotificationCenter.default.removeObserver(self); idleExpiry?.cancel() }

  @objc func releaseIdlePipeline(_ resolve: @escaping RCTPromiseResolveBlock,
                                rejecter _: @escaping RCTPromiseRejectBlock) {
    retention.invalidate()
    pipelineQueue.async { [weak self] in self?.releasePipeline(); resolve(true) }
  }

  // MARK: - RCTEventEmitter

  override static func requiresMainQueueSetup() -> Bool { false }

  override func supportedEvents() -> [String]! {
    ["OwnImageProgress", "OwnImageError", "OwnImageLoadProgress", "OwnImageResidency"]
  }

  // Narrow native boundaries allow lifecycle tests without allocating model weights.
  func validatePipelineDirectory(_ url: URL) -> String? { Self.validateModelDirectory(at: url) }
  func makePipeline(at url: URL, configuration: MLModelConfiguration, isXL: Bool) throws -> StableDiffusionPipelineProtocol {
    try Self.createPipeline(at: url, configuration: configuration, isXL: isXL)
  }
  func applicationIsActive() -> Bool { UIApplication.shared.applicationState == .active }
  func retentionConditions() -> (lowPower: Bool, thermal: ProcessInfo.ThermalState) {
    (ProcessInfo.processInfo.isLowPowerModeEnabled, ProcessInfo.processInfo.thermalState)
  }
  func monotonicNow() -> TimeInterval { ProcessInfo.processInfo.systemUptime }
  func scheduleIdleExpiry(_ item: DispatchWorkItem) { pipelineQueue.asyncAfter(deadline: .now() + 60, execute: item) }
  func enqueuePipeline(_ work: @escaping () -> Void) { pipelineQueue.async(execute: work) }

  // MARK: - loadModel

  @objc func loadModel(_ params: NSDictionary,
                       resolver resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let modelPath = params["modelPath"] as? String else {
      reject("ERR_INVALID_PARAMS", "modelPath is required", nil)
      return
    }

    pipelineQueue.async { [weak self] in
      guard let self = self else { return }

      self.retention.invalidate()
      let loadTicket = self.retention.ticket()
      self.idleExpiry?.cancel(); self.idleExpiry = nil
      // Unload previous if different path
      if self.loadedModelPath != nil && self.loadedModelPath != modelPath {
        self.releasePipeline()
      }

      do {
        let url = URL(fileURLWithPath: modelPath)

        self.sendEvent(withName: "OwnImageLoadProgress", body: ["modelPath": modelPath, "phase": "Checking model files"])
        // Validate model files exist before attempting to load
        let isXL = Self.isXLModelDirectory(at: url)
        if let validationError = self.validatePipelineDirectory(url) {
          self.releasePipeline()
          reject("ERR_INVALID_MODEL", validationError, nil)
          return
        }

        let cpuOnly = params["cpuOnly"] as? Bool ?? false
        let config = MLModelConfiguration()
        let attentionVariant = params["attentionVariant"] as? String ?? "split_einsum"
        // ANE is required — palettized weights produce gray images on pure CPU.
        // cpuAndGPU fallback lets low-memory devices avoid ANE compilation overhead.
        config.computeUnits = cpuOnly ? .cpuAndGPU : .cpuAndNeuralEngine

        self.sendEvent(withName: "OwnImageLoadProgress", body: ["modelPath": modelPath, "phase": "Preparing CoreML pipeline"])
        let pipe = try self.makePipeline(at: url, configuration: config, isXL: isXL)

        // Skip prewarm for 'original' variant (low-memory devices): prewarm
        // loads the full Unet into memory just to unload it, causing an OOM spike.
        // With reduceMemory=true the pipeline lazily loads each submodel during
        // generateImages(), so prewarming is unnecessary.
        if attentionVariant != "original" {
          self.sendEvent(withName: "OwnImageLoadProgress", body: ["modelPath": modelPath, "phase": "Preparing CoreML components"])
          try pipe.loadResources()
        }

        guard self.retention.ticket() == loadTicket else {
          self.releasePipeline()
          reject("ERR_LOAD_CANCELLED", "Image model loading was cancelled by resource cleanup.", nil)
          return
        }
        self.pipeline = pipe
        self.loadedModelPath = modelPath
        resolve(true)
      } catch {
        self.releasePipeline()
        reject("ERR_LOAD_FAILED", "Failed to load Core ML model: \(error.localizedDescription)", error)
      }
    }
  }

  // MARK: - unloadModel

  @objc func unloadModel(_ resolve: @escaping RCTPromiseResolveBlock,
                         rejecter _: @escaping RCTPromiseRejectBlock) {
    retention.invalidate()
    pipelineQueue.async { [weak self] in
      self?.releasePipeline()
      resolve(true)
    }
  }

  // MARK: - isModelLoaded

  @objc func isModelLoaded(_ resolve: @escaping RCTPromiseResolveBlock,
                           rejecter _: @escaping RCTPromiseRejectBlock) {
    pipelineQueue.async { [weak self] in resolve(self?.pipeline != nil) }
  }

  // MARK: - getLoadedModelPath

  @objc func getLoadedModelPath(_ resolve: @escaping RCTPromiseResolveBlock,
                                rejecter _: @escaping RCTPromiseRejectBlock) {
    pipelineQueue.async { [weak self] in resolve(self?.loadedModelPath as Any) }
  }

  // MARK: - generateImage

  static func fittedImageRect(source: CGSize, target: CGSize) -> CGRect {
    let scale = min(target.width / source.width, target.height / source.height)
    let size = CGSize(width: source.width * scale, height: source.height * scale)
    return CGRect(x: (target.width - size.width) / 2, y: (target.height - size.height) / 2,
                  width: size.width, height: size.height)
  }

  static func exportImage(_ image: CGImage, size: CGSize) -> UIImage {
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    let source = CGSize(width: image.width, height: image.height)
    return UIGraphicsImageRenderer(size: size, format: format).image { _ in
      UIImage(cgImage: image).draw(in: fittedImageRect(source: source, target: size))
    }
  }

  static func generationConfiguration(prompt: String, isXL: Bool) -> PipelineConfiguration {
    var config = PipelineConfiguration(prompt: prompt)
    // Match Apple's StableDiffusionCLI: SDXL uses a different VAE latent scale.
    let scale: Float32 = isXL ? 0.13025 : 0.18215
    config.encoderScaleFactor = scale
    config.decoderScaleFactor = scale
    return config
  }

  private struct GenerationOptions {
    let negativePrompt: String
    let steps: Int
    let guidanceScale: Double
    let seed: UInt32
    let requestId: String
    let previewInterval: Int

    init(_ params: NSDictionary) {
      negativePrompt = params["negativePrompt"] as? String ?? ""
      steps = params["steps"] as? Int ?? 20
      guidanceScale = params["guidanceScale"] as? Double ?? 7.5
      seed = params["seed"] as? UInt32 ?? UInt32.random(in: 0..<UInt32.max)
      requestId = params["requestId"] as? String ?? UUID().uuidString
      previewInterval = params["previewInterval"] as? Int ?? 0
    }
  }

  private static func generationConfiguration(prompt: String, isXL: Bool, options: GenerationOptions, previews: Bool) -> PipelineConfiguration {
    var config = generationConfiguration(prompt: prompt, isXL: isXL)
    config.negativePrompt = options.negativePrompt
    config.stepCount = max(1, options.steps)
    config.guidanceScale = Float(options.guidanceScale)
    config.seed = options.seed
    config.useDenoisedIntermediates = previews
    return config
  }

  // swiftlint:disable:next cyclomatic_complexity
  @objc func generateImage(_ params: NSDictionary,
                           resolver resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
    let ticket = retention.ticket()
    pipelineQueue.async { [weak self] in
      guard let self = self else { return }
      let pipeline = self.pipeline
      let generating = self.generating
    guard let pipe = pipeline else {
      reject("ERR_NO_MODEL", "No model loaded", nil)
      return
    }

    guard !generating else {
      reject("ERR_BUSY", "Image generation already in progress", nil)
      return
    }

    let prompt = (params["prompt"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    let options = GenerationOptions(params)
    guard !options.requestId.isEmpty, options.requestId.utf8.count <= 128 else {
      reject("ERR_INVALID_PARAMS", "Invalid image generation request identifier.", nil)
      return
    }

    // Validate prompt before sending to the pipeline — an empty prompt causes
    // TextEncoder.encode(ids:) to force-unwrap a nil value and crash.
    guard !prompt.isEmpty else {
      reject("ERR_INVALID_PROMPT", "Prompt cannot be empty", nil)
      return
    }

    let width = params["width"] as? Int ?? 512
    let height = params["height"] as? Int ?? 512
    guard (128...1024).contains(width), (128...1024).contains(height) else {
      reject("ERR_INVALID_SIZE", "Output dimensions must be between 128 and 1024 pixels.", nil)
      return
    }

    // Only a valid admitted request consumes the idle lease. Rejected input preserves TTL.
    self.admitGeneration()

      var completed = false
      let previews = CoreMLImagePreviewSession(interval: options.previewInterval, requestId: options.requestId)
      defer {
        previews.cleanup()
        self.generating = false
        if !completed { self.releasePipeline() }
      }

      // Re-check that pipeline hasn't been released (e.g. by a memory warning)
      guard self.pipeline != nil else {
        reject("ERR_NO_MODEL", "Model was unloaded (possibly due to low memory). Please reload and try again.", nil)
        return
      }

      do {
        let pipelineConfig = Self.generationConfiguration(prompt: prompt, isXL: pipe is StableDiffusionXLPipeline,
                                                         options: options, previews: previews.isEnabled)

        let images: [CGImage?]
        do {
          images = try pipe.generateImages(configuration: pipelineConfig) { progress in
            if self.cancelRequested { return false }

            return self.reportGenerationProgress(progress, previews: previews)
          }
        } catch {
          // Catch errors from the pipeline (including TextEncoder failures)
          // and convert them to a JS-visible rejection instead of crashing.
          let msg = "Pipeline failed during image generation: \(error.localizedDescription)"
          self.sendEvent(withName: "OwnImageError", body: ["error": msg])

          // If the error may indicate a corrupted model state, release it so
          // the next attempt triggers a fresh load.
          self.releasePipeline()

          reject("ERR_GENERATION", msg, error)
          return
        }

        if self.cancelRequested {
          reject("ERR_CANCELLED", "Generation was cancelled", nil)
          return
        }

        guard let cgImage = images.compactMap({ $0 }).first else {
          reject("ERR_NO_IMAGE", "Pipeline produced no image", nil)
          return
        }

        // Save to app's documents directory
        let imageId = UUID().uuidString
        guard let docsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
          reject("ERR_NO_DOCS_DIR", "Could not locate documents directory", nil)
          return
        }
        let generatedDir = docsDir.appendingPathComponent("generated_images")
        try FileManager.default.createDirectory(at: generatedDir, withIntermediateDirectories: true)

        let imagePath = generatedDir.appendingPathComponent("\(imageId).png")
        // CoreML model tensor sizes are fixed. Apply the selected export size
        // after native inference; settings must not promise faster inference.
        try CoreMLImageOutput.persist(to: imagePath, isCancelled: { self.cancelRequested }, encode: {
          Self.exportImage(cgImage, size: CGSize(width: width, height: height)).pngData()
        })

        completed = true
        self.finishPipeline(ticket: ticket, enabled: params["keepPipelineReady"] as? Bool == true)

        resolve([
          "id": imageId,
          "imagePath": imagePath.path,
          "width": width,
          "height": height,
          "seed": options.seed
        ] as [String: Any])

      } catch CoreMLImageOutput.Failure.encoding {
        reject("ERR_ENCODE", "Failed to encode image as PNG", nil)
      } catch {
        if !self.cancelRequested {
          self.sendEvent(withName: "OwnImageError", body: [
            "error": error.localizedDescription
          ])
          reject("ERR_GENERATION", "Image generation failed: \(error.localizedDescription)", error)
        } else {
          reject("ERR_CANCELLED", "Generation was cancelled", nil)
        }
      }
    }
  }

  private func reportGenerationProgress(_ progress: PipelineProgress, previews: CoreMLImagePreviewSession) -> Bool {
    let event = previews.progressEvent(rawStep: progress.step, totalSteps: progress.stepCount,
                                      isCancelled: { self.cancelRequested }, decode: {
      // currentImages uses try! inside the SDK. Use its throwing API instead.
      try progress.pipeline.decodeToImages(progress.currentLatentSamples, configuration: progress.configuration)
        .compactMap { $0 }.first
    })
    guard let event else { return false }
    sendEvent(withName: "OwnImageProgress", body: event)
    return !cancelRequested
  }

  // MARK: - cancelGeneration

  @objc func cancelGeneration(_ resolve: @escaping RCTPromiseResolveBlock,
                              rejecter _: @escaping RCTPromiseRejectBlock) {
    cancelRequested = true
    resolve(true)
  }

  // MARK: - isGenerating

  @objc func isGenerating(_ resolve: @escaping RCTPromiseResolveBlock,
                          rejecter _: @escaping RCTPromiseRejectBlock) {
    resolve(generating)
  }

  // MARK: - isNpuSupported (always true on Apple Silicon)

  @objc func isNpuSupported(_ resolve: @escaping RCTPromiseResolveBlock,
                            rejecter _: @escaping RCTPromiseRejectBlock) {
    resolve(true)
  }

  // MARK: - getGeneratedImages

  @objc func getGeneratedImages(_ resolve: @escaping RCTPromiseResolveBlock,
                                rejecter _: @escaping RCTPromiseRejectBlock) {
    guard let docsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
      resolve([])
      return
    }
    let generatedDir = docsDir.appendingPathComponent("generated_images")

    guard let files = try? FileManager.default.contentsOfDirectory(
      at: generatedDir, includingPropertiesForKeys: [.creationDateKey], options: .skipsHiddenFiles
    ) else {
      resolve([])
      return
    }

    let images: [[String: Any]] = files
      .filter { $0.pathExtension == "png" }
      .compactMap { url in
        let id = url.deletingPathExtension().lastPathComponent
        let attrs = try? FileManager.default.attributesOfItem(atPath: url.path)
        let createdAt = (attrs?[.creationDate] as? Date)?.iso8601String ?? ""

        return [
          "id": id,
          "prompt": "",
          "imagePath": url.path,
          "width": 512,
          "height": 512,
          "steps": 0,
          "seed": 0,
          "modelId": "",
          "createdAt": createdAt
        ] as [String: Any]
      }

    resolve(images)
  }

  // MARK: - deleteGeneratedImage

  @objc func deleteGeneratedImage(_ imageId: String,
                                  resolver resolve: @escaping RCTPromiseResolveBlock,
                                  rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard imageId.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil else {
      reject("ERR_INVALID_IMAGE", "Invalid image identifier.", nil)
      return
    }
    guard let docsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
      reject("ERR_NO_DOCS_DIR", "Could not locate documents directory", nil)
      return
    }
    let imagePath = docsDir
      .appendingPathComponent("generated_images")
      .appendingPathComponent("\(imageId).png")

    // A missing file is already deleted; allow removal of its stale thumbnail.
    if !FileManager.default.fileExists(atPath: imagePath.path) { resolve(true); return }
    do {
      try FileManager.default.removeItem(at: imagePath)
      resolve(true)
    } catch {
      resolve(false)
    }
  }
}

/// Optional operation-owned drafts. This never writes to the user's image gallery.
final class CoreMLImagePreviewSession {
  let directory = FileManager.default.temporaryDirectory.appendingPathComponent("own-image-preview-" + UUID().uuidString, isDirectory: true)
  private let interval: Int
  private let requestId: String
  private var directoryCreated = false
  private var disabled = false
  var isEnabled: Bool { interval > 0 && !disabled }

  init(interval: Int, requestId: String) {
    self.interval = interval > 0 ? max(5, interval) : 0
    self.requestId = requestId
  }

  deinit { cleanup() }

  static func completedStep(_ rawStep: Int, totalSteps: Int) -> Int {
    guard rawStep >= 0, totalSteps > 0 else { return 0 }
    return rawStep >= totalSteps ? totalSteps : rawStep + 1
  }

  static func shouldPreview(completedStep: Int, totalSteps: Int, interval: Int) -> Bool {
    guard interval > 0, completedStep > 0, completedStep < totalSteps else { return false }
    // Never keep more than seven intermediate PNGs, even for unusually long jobs.
    let boundedCadence = totalSteps / 8 + (totalSteps % 8 == 0 ? 0 : 1)
    return completedStep % max(5, max(interval, boundedCadence)) == 0
  }

  func progressEvent(rawStep: Int, totalSteps: Int, isCancelled: () -> Bool,
                     decode: () throws -> CGImage?) -> [String: Any]? {
    guard !isCancelled(), totalSteps > 0 else { return nil }
    let completed = Self.completedStep(rawStep, totalSteps: totalSteps)
    var event: [String: Any] = ["requestId": requestId, "step": completed,
                                "totalSteps": totalSteps, "progress": Double(completed) / Double(totalSteps)]
    if isEnabled && Self.shouldPreview(completedStep: completed, totalSteps: totalSteps, interval: interval) {
      do {
        let path: String? = try autoreleasepool {
          guard let image = try decode(), !isCancelled() else { return nil }
          return try writePreview(image, step: completed, isCancelled: isCancelled)
        }
        if let path { event["previewPath"] = path }
      } catch {
        // A draft is optional. Stop decoding drafts after one failure; generation continues.
        disabled = true
      }
    }
    return isCancelled() ? nil : event
  }

  private func writePreview(_ image: CGImage, step: Int, isCancelled: () -> Bool) throws -> String? {
    let scale = min(1, 256 / CGFloat(max(image.width, image.height)))
    let size = CGSize(width: max(1, floor(CGFloat(image.width) * scale)), height: max(1, floor(CGFloat(image.height) * scale)))
    guard let data = CoreMLDiffusionModule.exportImage(image, size: size).pngData(), !isCancelled() else { return nil }
    if !directoryCreated {
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false,
                                             attributes: [.protectionKey: FileProtectionType.complete])
      directoryCreated = true
    }
    let file = directory.appendingPathComponent("step-\(step).png")
    guard !isCancelled() else { return nil }
    try data.write(to: file, options: [.atomic, .completeFileProtection])
    if isCancelled() {
      try? FileManager.default.removeItem(at: file)
      return nil
    }
    return file.path
  }

  func cleanup() {
    guard directoryCreated else { return }
    do {
      try FileManager.default.removeItem(at: directory)
      directoryCreated = false
    } catch {
      // Temporary protected files remain excluded from backup; a later cleanup retries.
    }
  }
}

// MARK: - Date helper

private extension Date {
  var iso8601String: String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.string(from: self)
  }
}

/// Publishes only a new operation-owned output; an existing gallery file is never replaced.
enum CoreMLImageOutput {
  enum Failure: Error { case encoding }

  static func persist(
    to destination: URL,
    isCancelled: () -> Bool,
    encode: () throws -> Data?,
    write: (Data, URL) throws -> Void = { data, url in
      try data.write(to: url, options: [.atomic, .completeFileProtection])
    }
  ) throws {
    if isCancelled() { throw CancellationError() }
    guard let data = try encode() else { throw Failure.encoding }
    if isCancelled() { throw CancellationError() }
    let staging = destination.deletingLastPathComponent()
      .appendingPathComponent(".own-export-\(UUID().uuidString).tmp")
    defer { try? FileManager.default.removeItem(at: staging) }
    try write(data, staging)
    if isCancelled() { throw CancellationError() }
    // moveItem fails if destination already exists, unlike Data.write.
    try FileManager.default.moveItem(at: staging, to: destination)
    if isCancelled() {
      try? FileManager.default.removeItem(at: destination)
      throw CancellationError()
    }
  }
}

extension CoreMLDiffusionModule {
  // MARK: - SDXL detection

  /// Returns true if the model directory contains TextEncoder2.mlmodelc,
  /// which is the hallmark of an SDXL model.
  static func isXLModelDirectory(at url: URL) -> Bool {
    let te2 = url.appendingPathComponent("TextEncoder2.mlmodelc")
    return FileManager.default.fileExists(atPath: te2.path)
  }

  // MARK: - Model integrity validation

  /// SDXL iOS models may ship either a monolithic Unet.mlmodelc or split
  /// the UNet into two compiled chunks.
  static func hasValidUnetDirectory(at url: URL) -> Bool {
    let unet = url.appendingPathComponent("Unet.mlmodelc")
    if FileManager.default.fileExists(atPath: unet.path) {
      return true
    }

    let unetChunk1 = url.appendingPathComponent("UnetChunk1.mlmodelc")
    let unetChunk2 = url.appendingPathComponent("UnetChunk2.mlmodelc")
    return FileManager.default.fileExists(atPath: unetChunk1.path) &&
      FileManager.default.fileExists(atPath: unetChunk2.path)
  }

  /// Validates that the required model sub-components exist on disk before
  /// attempting to run the pipeline.  A missing TextEncoder.mlmodelc is the
  /// most common cause of the "Unexpectedly found nil" crash in
  /// TextEncoder.encode(ids:).
  static func validateModelDirectory(at url: URL) -> String? {
    let isXL = isXLModelDirectory(at: url)
    let requiredComponents = [
      "TextEncoder.mlmodelc",
      "VAEDecoder.mlmodelc"
    ]
    for component in requiredComponents {
      let path = url.appendingPathComponent(component)
      if !FileManager.default.fileExists(atPath: path.path) {
        return "Missing required model component: \(component)"
      }
    }
    if !hasValidUnetDirectory(at: url) {
      return isXL
        ? "Missing required model component: Unet.mlmodelc or UnetChunk1.mlmodelc + UnetChunk2.mlmodelc"
        : "Missing required model component: Unet.mlmodelc"
    }
    if isXL {
      let te2 = url.appendingPathComponent("TextEncoder2.mlmodelc")
      if !FileManager.default.fileExists(atPath: te2.path) {
        return "Missing required SDXL component: TextEncoder2.mlmodelc"
      }
    }
    return nil
  }

}

private extension CoreMLDiffusionModule {
  static func createPipeline(at url: URL, configuration: MLModelConfiguration, isXL: Bool) throws -> StableDiffusionPipelineProtocol {
    if isXL {
      return try StableDiffusionXLPipeline(resourcesAt: url, configuration: configuration, reduceMemory: true)
    }
    return try StableDiffusionPipeline(resourcesAt: url, controlNet: [], configuration: configuration, reduceMemory: true)
  }
  func admitGeneration() {
    _ = idleLease.admit(validRequest: true)
    idleExpiry?.cancel(); idleExpiry = nil
    generating = true
    cancelRequested = false
  }
  private func reportResidency() {
    residencyRevision += 1
    sendEvent(withName: "OwnImageResidency", body: ["resident": pipeline != nil,
      "modelPath": loadedModelPath.map { $0 as Any } ?? NSNull(), "revision": residencyRevision])
  }
  private func releasePipeline() {
    idleExpiry?.cancel(); idleExpiry = nil
    idleLease.release()
    pipeline = nil; loadedModelPath = nil
  }
  private func finishPipeline(ticket: UInt64, enabled: Bool) {
    let conditions = retentionConditions()
    guard retention.permits(ticket: ticket, enabled: enabled, lowPower: conditions.lowPower,
      thermal: conditions.thermal) else { releasePipeline(); return }
    let leaseRevision = idleLease.retain(now: monotonicNow())
    let expiry = DispatchWorkItem { [weak self] in
      guard let self = self,
        self.idleLease.expires(revision: leaseRevision, now: self.monotonicNow()) else { return }
      self.retention.invalidate(); self.releasePipeline()
    }
    idleExpiry = expiry
    scheduleIdleExpiry(expiry)
  }
  @objc private func becameActive() {
    retention.invalidate(active: true)
    pipelineQueue.async { [weak self] in self?.releasePipeline() }
  }
  @objc private func environmentChanged(_ note: Notification) {
    retention.invalidate(active: note.name == UIApplication.didEnterBackgroundNotification ? false : nil)
    pipelineQueue.async { [weak self] in self?.releasePipeline() }
  }

}
