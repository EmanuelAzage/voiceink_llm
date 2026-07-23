import AVFoundation
import React
import Speech

// Conformance to the Codegen-generated `NativeTranscriptionSpec` protocol is declared
// in TranscriptionBridge.mm, not here: that protocol lives in a header
// (VoiceInkSpecs.h) that's gated behind `#ifndef __cplusplus #error ...`, so it can
// only be imported from Objective-C++ (.mm), never from Swift directly. This class
// implements every method the protocol requires (matching selectors); the .mm file
// just declares the conformance on top of an already-complete implementation.
@objc(Transcription)
class Transcription: RCTEventEmitter {

  private let audioEngine = AVAudioEngine()
  private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var recognitionTask: SFSpeechRecognitionTask?
  private var speechRecognizer: SFSpeechRecognizer?
  private var capTimer: Timer?
  private var pendingStopResolve: RCTPromiseResolveBlock?
  private var pendingStopReject: RCTPromiseRejectBlock?
  private var isActive = false
  private var hasFinalResult = false
  private var cachedFinalTranscript = ""
  private var lastAudioLevelEmit: TimeInterval = 0
  private var hasListeners = false

  private static let maxDuration: TimeInterval = 60

  override static func requiresMainQueueSetup() -> Bool { true }

  override func supportedEvents() -> [String]! {
    ["onPartialTranscript", "onError", "onAudioLevel"]
  }

  // RCTEventEmitter calls these when the first JS listener is added / the last is
  // removed. sendEvent(withName:) logs a warning (harmless, but noisy) if called
  // while nothing is listening yet — the audio tap can fire its first buffer before
  // NativeEventEmitter's addListener() call has round-tripped to native, so this
  // guard is necessary, not just tidy.
  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  // MARK: - isAvailable / requestPermissions

  @objc(isAvailable:reject:)
  func isAvailable(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(SFSpeechRecognizer()?.isAvailable ?? false)
  }

  @objc(requestPermissions:reject:)
  func requestPermissions(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    SFSpeechRecognizer.requestAuthorization { speechStatus in
      DispatchQueue.main.async {
        guard speechStatus == .authorized else {
          resolve(speechStatus == .restricted ? "restricted" : "denied")
          return
        }
        AVAudioSession.sharedInstance().requestRecordPermission { granted in
          DispatchQueue.main.async {
            resolve(granted ? "granted" : "denied")
          }
        }
      }
    }
  }

  // MARK: - start

  @objc(start:resolve:reject:)
  func start(_ language: NSString, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async { [weak self] in
      guard let self else {
        resolve(nil)
        return
      }

      guard !self.isActive else {
        self.emitError(code: "busy", message: "start() called while a session is already active")
        resolve(nil)
        return
      }

      guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: language as String)),
            recognizer.isAvailable else {
        self.emitError(code: "recognizer_unavailable", message: "No recognizer available for \(language)")
        resolve(nil)
        return
      }

      let audioSession = AVAudioSession.sharedInstance()
      do {
        try audioSession.setCategory(.record, mode: .measurement, options: [])
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
      } catch {
        self.emitError(code: "native_error", message: error.localizedDescription)
        resolve(nil)
        return
      }

      let request = SFSpeechAudioBufferRecognitionRequest()
      request.shouldReportPartialResults = true
      if recognizer.supportsOnDeviceRecognition {
        request.requiresOnDeviceRecognition = true
      }

      self.speechRecognizer = recognizer
      self.recognitionRequest = request
      self.isActive = true
      self.hasFinalResult = false
      self.cachedFinalTranscript = ""

      let inputNode = self.audioEngine.inputNode
      let recordingFormat = inputNode.outputFormat(forBus: 0)
      inputNode.removeTap(onBus: 0)
      inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
        self?.recognitionRequest?.append(buffer)
        self?.processAudioLevel(from: buffer)
      }

      self.audioEngine.prepare()
      do {
        try self.audioEngine.start()
      } catch {
        self.teardownSession()
        self.emitError(code: "native_error", message: error.localizedDescription)
        resolve(nil)
        return
      }

      self.recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
        guard let self else { return }
        DispatchQueue.main.async {
          if let result {
            self.cachedFinalTranscript = result.bestTranscription.formattedString
            if self.hasListeners {
              self.sendEvent(withName: "onPartialTranscript", body: ["text": result.bestTranscription.formattedString])
            }
            if result.isFinal {
              self.hasFinalResult = true
              if self.pendingStopResolve != nil {
                self.finishWithCurrentTranscript()
              }
            }
          }
          if let error {
            self.handleRecognitionError(error)
          }
        }
      }

      self.capTimer = Timer.scheduledTimer(withTimeInterval: Self.maxDuration, repeats: false) { [weak self] _ in
        self?.autoStopAfterCap()
      }

      resolve(nil)
    }
  }

  // MARK: - stop / cancel

  @objc(stop:reject:)
  func stop(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async { [weak self] in
      guard let self else {
        resolve("")
        return
      }
      guard self.isActive else {
        resolve(self.cachedFinalTranscript)
        return
      }
      self.pendingStopResolve = resolve
      self.pendingStopReject = reject
      if self.hasFinalResult {
        self.finishWithCurrentTranscript()
      } else {
        self.recognitionRequest?.endAudio()
      }
    }
  }

  @objc(cancel:reject:)
  func cancel(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async { [weak self] in
      guard let self else {
        resolve(nil)
        return
      }
      self.recognitionTask?.cancel()
      self.pendingStopResolve = nil
      self.pendingStopReject = nil
      self.teardownSession()
      resolve(nil)
    }
  }

  // MARK: - Private helpers

  private func finishWithCurrentTranscript() {
    let transcript = cachedFinalTranscript
    let resolve = pendingStopResolve
    pendingStopResolve = nil
    pendingStopReject = nil
    teardownSession()
    resolve?(transcript)
  }

  private func handleRecognitionError(_ error: Error) {
    guard isActive else { return }
    let nsError = error as NSError
    if cachedFinalTranscript.isEmpty {
      emitError(code: "no_speech", message: nsError.localizedDescription)
    } else {
      emitError(code: "native_error", message: nsError.localizedDescription)
    }
    finishWithCurrentTranscript()
  }

  private func autoStopAfterCap() {
    guard isActive else { return }
    if audioEngine.isRunning {
      audioEngine.stop()
      audioEngine.inputNode.removeTap(onBus: 0)
    }
    recognitionRequest?.endAudio()
  }

  private func teardownSession() {
    capTimer?.invalidate()
    capTimer = nil
    if audioEngine.isRunning {
      audioEngine.stop()
      audioEngine.inputNode.removeTap(onBus: 0)
    }
    recognitionRequest?.endAudio()
    recognitionRequest = nil
    recognitionTask = nil
    speechRecognizer = nil
    hasFinalResult = false
    cachedFinalTranscript = ""
    isActive = false
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }

  private func emitError(code: String, message: String) {
    guard hasListeners else { return }
    sendEvent(withName: "onError", body: ["code": code, "message": message])
  }

  private func processAudioLevel(from buffer: AVAudioPCMBuffer) {
    guard let channelData = buffer.floatChannelData else { return }
    let frameLength = Int(buffer.frameLength)
    guard frameLength > 0 else { return }

    let samples = channelData[0]
    var sum: Float = 0
    for index in 0..<frameLength {
      sum += samples[index] * samples[index]
    }
    let rms = sqrtf(sum / Float(frameLength))
    let level = min(max(rms * 4, 0), 1)

    let now = Date().timeIntervalSince1970
    guard now - lastAudioLevelEmit >= 0.1 else { return }
    lastAudioLevelEmit = now

    DispatchQueue.main.async { [weak self] in
      guard let self, self.hasListeners else { return }
      self.sendEvent(withName: "onAudioLevel", body: ["level": level])
    }
  }
}
