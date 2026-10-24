import AVFAudio
import Foundation
import NaturalLanguage
import React
import UIKit

@objc(OwnReplySpeech)
final class OwnReplySpeech: NSObject, AVSpeechSynthesizerDelegate {
  private let synthesizer = AVSpeechSynthesizer()
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
  }
  deinit { NotificationCenter.default.removeObserver(self) }
  @objc static func requiresMainQueueSetup() -> Bool { true }

  static func eligible(_ voice: AVSpeechSynthesisVoice, language: String) -> Bool {
    if #available(iOS 17.0, *), !voice.voiceTraits.intersection([.isPersonalVoice, .isNoveltyVoice]).isEmpty { return false }
    return basicVoiceMatches(quality: voice.quality, locale: voice.language, language: language)
  }
  static func basicVoiceMatches(quality: AVSpeechSynthesisVoiceQuality, locale: String, language: String) -> Bool {
    quality == .default && !language.isEmpty && locale.lowercased().hasPrefix(language.lowercased() + "-")
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
      guard let voice = AVSpeechSynthesisVoice.speechVoices().first(where: { Self.eligible($0, language: language) }) else {
        reject("voice_unavailable", "No suitable basic local voice is available.", nil); return
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
