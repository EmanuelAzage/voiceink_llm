package com.emanuelazage.voiceink

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.core.content.ContextCompat
import com.emanuelazage.voiceink.specs.NativeTranscriptionSpec
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener

private const val MAX_DURATION_MS = 60_000L
private const val RECORD_AUDIO_REQUEST_CODE = 6217
private const val AUDIO_LEVEL_THROTTLE_MS = 100L

class TranscriptionModule(reactContext: ReactApplicationContext) :
  NativeTranscriptionSpec(reactContext), RecognitionListener {

  private val mainHandler = Handler(Looper.getMainLooper())
  private var speechRecognizer: SpeechRecognizer? = null
  private var isActive = false
  private var hasFinalResult = false
  private var cachedFinalTranscript = ""
  private var lastPartialTranscript = ""
  private var pendingStopPromise: Promise? = null
  private var lastAudioLevelEmitAt = 0L
  private val capRunnable = Runnable { autoStopAfterCap() }

  // MARK: - isAvailable / requestPermissions

  override fun isAvailable(promise: Promise) {
    promise.resolve(SpeechRecognizer.isRecognitionAvailable(reactApplicationContext))
  }

  override fun requestPermissions(promise: Promise) {
    // Android has no separate "speech recognition" permission the way iOS does
    // (NSSpeechRecognitionUsageDescription) — RECORD_AUDIO is the only gate. The
    // recognizer itself (on-device or server) runs under a system service, not
    // this app's own permission scope.
    val alreadyGranted =
      ContextCompat.checkSelfPermission(reactApplicationContext, Manifest.permission.RECORD_AUDIO) ==
        PackageManager.PERMISSION_GRANTED
    if (alreadyGranted) {
      promise.resolve("granted")
      return
    }

    val activity = reactApplicationContext.currentActivity as? PermissionAwareActivity
    if (activity == null) {
      promise.resolve("denied")
      return
    }

    activity.requestPermissions(
      arrayOf(Manifest.permission.RECORD_AUDIO),
      RECORD_AUDIO_REQUEST_CODE,
      PermissionListener { requestCode, _, grantResults ->
        if (requestCode != RECORD_AUDIO_REQUEST_CODE) {
          return@PermissionListener false
        }
        val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
        promise.resolve(if (granted) "granted" else "denied")
        true
      },
    )
  }

  // MARK: - start

  override fun start(language: String, promise: Promise) {
    mainHandler.post {
      if (isActive) {
        emitError("busy", "start() called while a session is already active")
        promise.resolve(null)
        return@post
      }

      val recognizer = createBestAvailableRecognizer()
      if (recognizer == null) {
        emitError("recognizer_unavailable", "No speech recognizer available on this device")
        promise.resolve(null)
        return@post
      }

      speechRecognizer = recognizer
      recognizer.setRecognitionListener(this)

      val intent =
        android.content.Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
          putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
          putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
          putExtra(RecognizerIntent.EXTRA_LANGUAGE, language)
        }

      isActive = true
      hasFinalResult = false
      cachedFinalTranscript = ""
      lastPartialTranscript = ""

      recognizer.startListening(intent)
      mainHandler.postDelayed(capRunnable, MAX_DURATION_MS)

      promise.resolve(null)
    }
  }

  private fun createBestAvailableRecognizer(): SpeechRecognizer? {
    // Prefer on-device recognition (API 31+), matching the iOS preference for
    // requiresOnDeviceRecognition, and fall back to the server-backed recognizer
    // silently if it's not actually usable on this device.
    if (android.os.Build.VERSION.SDK_INT >= 31) {
      val onDeviceAvailable =
        if (android.os.Build.VERSION.SDK_INT >= 33) {
          SpeechRecognizer.isOnDeviceRecognitionAvailable(reactApplicationContext)
        } else {
          true // no availability check exists before API 33; attempt it and fall back below if it errors out.
        }
      if (onDeviceAvailable) {
        return SpeechRecognizer.createOnDeviceSpeechRecognizer(reactApplicationContext)
      }
    }
    return if (SpeechRecognizer.isRecognitionAvailable(reactApplicationContext)) {
      SpeechRecognizer.createSpeechRecognizer(reactApplicationContext)
    } else {
      null
    }
  }

  // MARK: - stop / cancel

  override fun stop(promise: Promise) {
    mainHandler.post {
      if (!isActive) {
        promise.resolve(cachedFinalTranscript)
        return@post
      }
      pendingStopPromise = promise
      if (hasFinalResult) {
        finishWithCurrentTranscript()
      } else {
        speechRecognizer?.stopListening()
      }
    }
  }

  override fun cancel(promise: Promise) {
    mainHandler.post {
      pendingStopPromise = null
      teardownSession()
      promise.resolve(null)
    }
  }

  // MARK: - RecognitionListener

  override fun onReadyForSpeech(params: Bundle?) {}

  override fun onBeginningOfSpeech() {}

  override fun onRmsChanged(rmsdB: Float) {
    val now = System.currentTimeMillis()
    if (now - lastAudioLevelEmitAt < AUDIO_LEVEL_THROTTLE_MS) return
    lastAudioLevelEmitAt = now
    // Android's RMS dB isn't a fixed 0..1 range (unlike the raw PCM RMS this app
    // computes manually on iOS) — this is a best-effort normalization, not a
    // precise level, since the platform API doesn't document exact bounds.
    val level = ((rmsdB + 2f) / 12f).coerceIn(0f, 1f)
    emitEvent("onAudioLevel", Arguments.createMap().apply { putDouble("level", level.toDouble()) })
  }

  override fun onBufferReceived(buffer: ByteArray?) {}

  override fun onEndOfSpeech() {}

  override fun onError(error: Int) {
    val code =
      when (error) {
        SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "no_speech"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "permission_denied"
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "busy"
        else -> "native_error"
      }
    emitError(code, "SpeechRecognizer error code $error")

    // The recognizer is done regardless of error type — if JS is waiting on stop(),
    // resolve it with whatever transcript we have (likely the last partial, or
    // empty) rather than leaving the promise hanging.
    if (pendingStopPromise != null) {
      if (cachedFinalTranscript.isEmpty()) {
        cachedFinalTranscript = lastPartialTranscript
      }
      finishWithCurrentTranscript()
    } else {
      teardownSession()
    }
  }

  override fun onResults(results: Bundle?) {
    val transcript =
      results
        ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        ?.firstOrNull() ?: lastPartialTranscript
    cachedFinalTranscript = transcript
    hasFinalResult = true

    // OEM auto-end quirk: some recognizers fire onResults before JS ever calls
    // stop() (e.g. after a silence timeout). Caching the final text here and
    // checking hasFinalResult in stop() means a later stop() call resolves
    // immediately from cache instead of waiting on a session that already ended.
    if (pendingStopPromise != null) {
      finishWithCurrentTranscript()
    }
  }

  override fun onPartialResults(partialResults: Bundle?) {
    val transcript =
      partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
    if (transcript != null) {
      lastPartialTranscript = transcript
      emitEvent("onPartialTranscript", Arguments.createMap().apply { putString("text", transcript) })
    }
  }

  override fun onEvent(eventType: Int, params: Bundle?) {}

  // MARK: - Private helpers

  private fun finishWithCurrentTranscript() {
    val transcript = cachedFinalTranscript
    val promise = pendingStopPromise
    pendingStopPromise = null
    teardownSession()
    promise?.resolve(transcript)
  }

  private fun autoStopAfterCap() {
    if (!isActive) return
    speechRecognizer?.stopListening()
  }

  private fun teardownSession() {
    mainHandler.removeCallbacks(capRunnable)
    speechRecognizer?.destroy()
    speechRecognizer = null
    isActive = false
    hasFinalResult = false
    cachedFinalTranscript = ""
    lastPartialTranscript = ""
  }

  private fun emitError(code: String, message: String) {
    emitEvent(
      "onError",
      Arguments.createMap().apply {
        putString("code", code)
        putString("message", message)
      },
    )
  }

  private fun emitEvent(name: String, params: com.facebook.react.bridge.WritableMap) {
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(name, params)
  }

  // addListener/removeListeners exist because the Codegen spec requires them (JS's
  // NativeEventEmitter calls them for bookkeeping on every platform) — but unlike
  // iOS's RCTEventEmitter, Android's event-emitter path has no listener-count
  // warning to guard against, so these are no-ops here.
  override fun addListener(eventName: String) {}

  override fun removeListeners(count: Double) {}
}
