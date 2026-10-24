import Foundation
import AVFoundation

@objc(AudioImport)
class AudioImport: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc func prepare(_ filePath: String, resolver resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.global(qos: .userInitiated).async {
      let url = filePath.hasPrefix("file://") ? URL(string: filePath) : URL(fileURLWithPath: filePath)
      guard let url = url, url.isFileURL else { reject("AUDIO_ERROR", "Invalid audio file.", nil); return }
      let scoped = url.startAccessingSecurityScopedResource()
      defer { if scoped { url.stopAccessingSecurityScopedResource() } }
      let output = FileManager.default.temporaryDirectory.appendingPathComponent("own-audio-\(UUID().uuidString).wav")
      do {
        let asset = AVURLAsset(url: url)
        let duration = CMTimeGetSeconds(asset.duration)
        guard duration.isFinite, duration > 0, duration <= 1200,
              let track = asset.tracks(withMediaType: .audio).first else {
          reject("AUDIO_ERROR", "Choose an audio recording of no more than 20 minutes.", nil); return
        }
        let reader = try AVAssetReader(asset: asset)
        let settings: [String: Any] = [AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: 16000,
          AVNumberOfChannelsKey: 1, AVLinearPCMBitDepthKey: 16, AVLinearPCMIsFloatKey: false,
          AVLinearPCMIsBigEndianKey: false, AVLinearPCMIsNonInterleaved: false]
        let trackOutput = AVAssetReaderTrackOutput(track: track, outputSettings: settings)
        guard reader.canAdd(trackOutput) else { throw NSError(domain: "OwnAudio", code: 1) }
        reader.add(trackOutput)
        guard reader.startReading() else { throw reader.error ?? NSError(domain: "OwnAudio", code: 2) }
        var pcm = Data()
        while let sample = trackOutput.copyNextSampleBuffer() {
          guard let block = CMSampleBufferGetDataBuffer(sample) else { continue }
          let length = CMBlockBufferGetDataLength(block)
          guard pcm.count + length <= 38_400_000 else { reader.cancelReading(); throw NSError(domain: "OwnAudio", code: 3) }
          var bytes = [UInt8](repeating: 0, count: length)
          guard CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: length, destination: &bytes) == kCMBlockBufferNoErr else {
            reader.cancelReading(); throw NSError(domain: "OwnAudio", code: 4)
          }
          pcm.append(contentsOf: bytes)
        }
        guard reader.status == .completed, !pcm.isEmpty else { throw reader.error ?? NSError(domain: "OwnAudio", code: 5) }
        var wav = Data()
        func ascii(_ text: String) { wav.append(contentsOf: text.utf8) }
        func integer<T: FixedWidthInteger>(_ value: T) { var little = value.littleEndian; withUnsafeBytes(of: &little) { wav.append(contentsOf: $0) } }
        ascii("RIFF"); integer(UInt32(pcm.count + 36)); ascii("WAVEfmt "); integer(UInt32(16))
        integer(UInt16(1)); integer(UInt16(1)); integer(UInt32(16000)); integer(UInt32(32000))
        integer(UInt16(2)); integer(UInt16(16)); ascii("data"); integer(UInt32(pcm.count)); wav.append(pcm)
        try wav.write(to: output, options: .atomic)
        resolve(output.path)
      } catch {
        try? FileManager.default.removeItem(at: output)
        reject("AUDIO_ERROR", "Could not decode this recording. Try WAV, M4A or MP3.", error)
      }
    }
  }
}
