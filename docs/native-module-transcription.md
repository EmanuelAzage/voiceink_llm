---
type: module-spec
title: TranscriptionProvider Turbo Module Spec
description: TypeScript contract, Swift and Kotlin implementation notes, permissions, and error codes for the native speech-recognition module
status: living
tags: [native-module, turbo-module, speech, ios, android]
timestamp: 2026-07-29T17:00:00Z
related: [architecture.md, build-plan.md]
---

# TranscriptionProvider — Turbo Module Spec

The architectural centerpiece of the repo: one TypeScript contract, native speech recognition behind it on each platform. New Architecture (TurboModules + codegen), no third-party speech packages.

## TypeScript contract

```ts
// modules/transcription/NativeTranscription.ts (codegen spec)
import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  isAvailable(): Promise<boolean>;                    // recognizer exists & permitted for language
  requestPermissions(): Promise<string>;              // 'granted' | 'denied' | 'restricted'
  start(language: string): Promise<void>;             // e.g. 'en-US' — explicit, no auto-detect
  stop(): Promise<string>;                            // resolves with FINAL transcript
  cancel(): Promise<void>;                            // discard session
  addListener(eventName: string): void;               // RN event emitter plumbing
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('Transcription');
```

Events emitted (via `NativeEventEmitter`): `onPartialTranscript { text }`, `onError { code, message }`, `onAudioLevel { level }` (0–1, drives the mic button animation; throttle to ≤10 Hz native-side).

`modules/transcription/index.ts` wraps the raw module in a friendly API (`useTranscription()` hook) so screens never touch the TurboModule directly.

## iOS implementation (Swift)

- `SFSpeechRecognizer(locale:)` + `SFSpeechAudioBufferRecognitionRequest` fed by an `AVAudioEngine` input tap; `shouldReportPartialResults = true`; prefer `requiresOnDeviceRecognition = true` when `supportsOnDeviceRecognition` (fall back to server recognition silently).
- Audio session: `.record`, mode `.measurement`, deactivate on stop/cancel.
- Permissions: both `NSMicrophoneUsageDescription` and `NSSpeechRecognitionUsageDescription` in Info.plist; `requestPermissions()` chains mic + speech authorization.
- Partial results → `onPartialTranscript`; final result resolves the pending `stop()` promise. All recognizer callbacks hop to the main queue before touching the audio engine; promise resolution is thread-safe.
- 60s hard cap via timer → auto-stop (matches Apple's practical per-utterance limits).

## Android implementation (Kotlin)

- `SpeechRecognizer.createSpeechRecognizer()` with `RecognizerIntent.ACTION_RECOGNIZE_SPEECH`, `EXTRA_PARTIAL_RESULTS = true`, `EXTRA_LANGUAGE` from the `language` arg; prefer `createOnDeviceSpeechRecognizer` on API 31+ when available.
- `RECORD_AUDIO` runtime permission; manifest also declares `<queries>` for the recognition service (API 30+ package visibility).
- `RecognitionListener` mapping: `onPartialResults` → `onPartialTranscript`, `onResults` → resolve `stop()`, `onError` → mapped error codes. Recognizer must be created and driven on the main thread; destroy on stop/cancel to release the mic.
- Quirk to handle: some OEM recognizers auto-end on silence — if `onResults` fires before JS calls `stop()`, cache the final text and resolve the subsequent `stop()` from cache.

## Error contract (shared)

| Code | Meaning | UI behavior |
|---|---|---|
| `permission_denied` | Mic or speech permission refused | Explainer + link to system settings |
| `recognizer_unavailable` | No recognizer for language/device | Suggest language change in Settings |
| `busy` | start() while active session | Ignore; log |
| `no_speech` | Session ended with empty transcript | Gentle "didn't catch that" retry state |
| `native_error` | Anything else (message passthrough) | Inline error + retry |

## Parity checklist (used in M3)

Same script spoken on both platforms must produce: partial events streaming, final transcript on stop, correct error codes for denied permission and airplane-mode server-recognizer failure, no mic left open after cancel (verify with OS mic indicator).

Status as of 2026-07-29:
- [x] Partial events streaming — iOS simulator + Android device (Samsung SM-X230).
- [x] Final transcript on stop — iOS simulator + Android device.
- [x] Correct error code, denied permission — iOS (both mic and speech-recognition denial verified). Android not yet exercised (only the grant path has been tested).
- [ ] Correct error code, airplane-mode server-recognizer failure — not yet tested on either platform.
- [ ] No mic left open after `cancel()` — not yet tested on either platform; `cancel()` also isn't wired to a `CaptureScreen` UI affordance yet (only `start`/`stop` are, via press-in/press-out).
