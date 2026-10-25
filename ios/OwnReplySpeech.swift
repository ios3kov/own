import AVFAudio
import Foundation
import NaturalLanguage
import React
import UIKit

@objc(OwnReplySpeech)
final class OwnReplySpeech: NSObject, AVSpeechSynthesizerDelegate {
  private let synthesizer = AVSpeechSynthesizer()
  private var preferredVoiceID = ""
  private var installedVoices: [AVSpeechSynthesisVoice] = []
  private var voiceCache: [String: AVSpeechSynthesisVoice] = [:]
  private var session: String?
  private var utterance: AVSpeechUtterance?
  private var resolveSpeech: RCTPromiseResolveBlock?
  private var rejectSpeech: RCTPromiseRejectBlock?

  override init() {
    super.init()
    synthesizer.delegate = self
    synthesizer.usesApplicationAudioSession = false
    NotificationCenter.default.addObserver(self, selector: #selector(interrupted),
      name: AVAudioSession.interruptionNotification, object: nil)
    NotificationCenter.default.addObserver(self, selector: #selector(interrupted),
      name: AVAudioSession.routeChangeNotification, object: nil)
    NotificationCenter.default.addObserver(self, selector: #selector(voicesChanged),
      name: AVSpeechSynthesizer.availableVoicesDidChangeNotification, object: nil)
  }
  deinit { NotificationCenter.default.removeObserver(self) }
  @objc static func requiresMainQueueSetup() -> Bool { true }

  static func isSystemVoiceIdentifier(_ identifier: String) -> Bool { identifier.hasPrefix("com.apple.") }
  static func eligible(_ voice: AVSpeechSynthesisVoice, language: String) -> Bool {
    guard isSystemVoiceIdentifier(voice.identifier) else { return false }
    if #available(iOS 17.0, *), !voice.voiceTraits.intersection([.isPersonalVoice, .isNoveltyVoice]).isEmpty { return false }
    return basicVoiceMatches(quality: voice.quality, locale: voice.language, language: language)
  }
  static func basicVoiceMatches(quality: AVSpeechSynthesisVoiceQuality, locale: String, language: String) -> Bool {
    let primary = language.lowercased().split(separator: "-").first.map(String.init) ?? ""
    return [.default, .enhanced, .premium].contains(quality) && !primary.isEmpty
      && locale.lowercased().hasPrefix(primary + "-")
  }
  @objc private func voicesChanged() {
    DispatchQueue.main.async { self.installedVoices = []; self.voiceCache = [:] }
  }
  private func availableVoices() -> [AVSpeechSynthesisVoice] {
    if installedVoices.isEmpty { installedVoices = AVSpeechSynthesisVoice.speechVoices() }
    return installedVoices
  }
  @objc(voices:rejecter:)
  func voices(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      let values = self.availableVoices().filter { Self.eligible($0, language: $0.language) }.map { voice in
        ["id": voice.identifier, "name": voice.name, "language": voice.language,
         "quality": voice.quality == .premium ? "Premium" : voice.quality == .enhanced ? "Enhanced" : "Standard"]
      }
      resolve(values)
    }
  }
  @objc(setVoice:resolver:rejecter:)
  func setVoice(_ identifier: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      self.preferredVoiceID = identifier
      self.voiceCache = [:]
      resolve(nil)
    }
  }
  private func voice(for language: String) -> AVSpeechSynthesisVoice? {
    let key = language + "|" + Locale.current.identifier + "|" + preferredVoiceID
    if let cached = voiceCache[key] { return cached }
    let candidates = availableVoices().filter { Self.eligible($0, language: language) }
    let chosen = candidates.first { $0.identifier == preferredVoiceID } ?? candidates.sorted {
      if $0.quality != $1.quality { return $0.quality.rawValue > $1.quality.rawValue }
      let local = Locale.current.identifier.replacingOccurrences(of: "_", with: "-")
      if ($0.language == local) != ($1.language == local) { return $0.language == local }
      return $0.identifier < $1.identifier
    }.first
    if let chosen { voiceCache[key] = chosen }
    return chosen
  }
  private func clear() {
    session = nil
    let pending = rejectSpeech
    resolveSpeech = nil; rejectSpeech = nil; utterance = nil
    synthesizer.stopSpeaking(at: .immediate)
    pending?("speech_stopped", "Playback stopped.", nil)
  }
  @objc private func interrupted() { DispatchQueue.main.async { self.clear() } }
  @objc(begin:resolver:rejecter:)
  func begin(_ identifier: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    DispatchQueue.main.async { self.clear(); self.session = identifier; resolve(nil) }
  }
  @objc(stop:rejecter:)
  func stop(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: RCTPromiseRejectBlock) {
    DispatchQueue.main.async { self.clear(); resolve(nil) }
  }
  @objc(speak:session:resolver:rejecter:)
  func speak(_ text: String, session identifier: String, resolver resolve: @escaping RCTPromiseResolveBlock,
             rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard UIApplication.shared.applicationState == .active, self.session == identifier, self.utterance == nil, !text.isEmpty, text.count <= 800 else {
        reject("speech_stopped", "Playback stopped.", nil); return
      }
      let recognizer = NLLanguageRecognizer()
      recognizer.processString(text)
      let language = recognizer.dominantLanguage?.rawValue ?? Locale.current.language.languageCode?.identifier ?? "en"
      guard let voice = self.voice(for: language) else {
        reject("voice_unavailable", "No suitable installed voice is available.", nil); return
      }
      let value = AVSpeechUtterance(string: text)
      value.voice = voice
      self.utterance = value; self.resolveSpeech = resolve; self.rejectSpeech = reject
      self.synthesizer.speak(value)
    }
  }
  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish value: AVSpeechUtterance) {
    DispatchQueue.main.async {
      guard self.utterance === value else { return }
      let completion = self.resolveSpeech
      self.utterance = nil; self.resolveSpeech = nil; self.rejectSpeech = nil
      completion?(nil)
    }
  }
  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel value: AVSpeechUtterance) {
    DispatchQueue.main.async {
      guard self.utterance === value else { return }
      self.clear()
    }
  }
}
