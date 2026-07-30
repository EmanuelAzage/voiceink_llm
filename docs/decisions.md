---
type: decision-log
title: VoiceInk Decisions
description: ADR-lite log of technical choices and their rationale
status: living
tags: [decisions, adr, dependencies]
timestamp: 2026-07-21T21:00:00Z
related: [architecture.md]
---

# Decisions

Add a dated entry for every non-obvious choice. Newest first.

## 2026-07-30 — `@react-native-community/datetimepicker` (v9.1.0) for action-item due dates
Product spec calls for "native date picker" on action-item rows in Review. This is the de facto standard RN date picker (wraps `UIDatePicker` on iOS, `DatePickerDialog`/`TimePickerDialog` on Android) — no real alternative evaluated, it's the obvious choice for a thin wrapper over each platform's native picker. Autolinked on both platforms; iOS needed `pod install`, Android needed nothing extra.

## 2026-07-30 — Google Gemini (free tier) as the M4 extraction provider
`decisions.md` had committed to "cloud LLM with schema-constrained tool use" but stayed provider-agnostic through M1–M3. For M4, picked Gemini over OpenRouter's free models and over Anthropic/OpenAI paid keys: OpenRouter's free-tier models are small/quantized and tool-calling reliability drops noticeably on them (real risk for a schema-constrained extraction call); Anthropic/OpenAI have strong tool-use support but no meaningful free tier for iterative dev. Gemini's free tier is generous enough to build against at $0, and its native function-calling (`tools` / `toolConfig.functionCallingConfig.mode: "ANY"`) covers the same "force a structured call" pattern. Implementation: plain `fetch` to `v1beta/models/{model}:generateContent` (no SDK dependency, matches [architecture.md](architecture.md)'s "plain async fetch" note) — key/model via `react-native-config` (`.env`, see `.env.example`), not yet an SDK. `GEMINI_MODEL` is left as a placeholder in `.env.example` rather than hardcoded with confidence: Gemini's model lineup has moved fast and the current free-tier model should be checked in AI Studio at setup time, not trusted from a past doc. `cardSchema.ts`'s own validator — not the wire-format schema — is the actual `additionalProperties: false` enforcement point: confirmed live that Gemini's Schema object rejects the field outright (HTTP 400, "Unknown name additionalProperties: Cannot find field"), so it's stripped from `cardJsonSchema` entirely rather than sent and ignored. `extraction.ts` stays provider-agnostic at the call-site (`extractCard(transcript)`) so swapping providers later only touches this one file. The exact request/response shape we depend on is documented as a minimal OpenAPI 3.0 spec at [`contracts/gemini-generatecontent.yaml`](../contracts/gemini-generatecontent.yaml) — not a full Gemini API spec, just the one operation, kept outside `docs/` since it's a machine-shaped contract file rather than an OKF concept. No codegen wired to it (single call site, hand-written types are still cheap); revisit if the app starts calling more Gemini endpoints.

## 2026-07-21 — `@/*` -> `src/*` absolute-import alias (single alias, not per-folder)
`babel-plugin-module-resolver` + matching `tsconfig.json` paths. Considered per-folder aliases (`@screens`, `@components`, `@state`, ...) vs. one `@/*` root alias. Picked the single alias: less config to keep in sync as `src/` grows, and the folder segment in the import path (`@/screens/HomeScreen`) already carries the same information a per-folder alias would. Also added `@modules/*` -> `modules/*` since the Turbo Module lives outside `src/` (see [architecture.md](architecture.md) project structure) — it'll matter once M2 screens import `useTranscription()`.

## 2026-07-21 — `react-native-mmkv` v4's Nitro Modules API, and mocking it for Jest
Installed `react-native-mmkv` per the existing MMKV decision below, but v4 replaced the old `new MMKV()` class with a `createMMKV()` factory built on **Nitro Modules** (margelo's own JSI codegen layer, distinct from RN's TurboModules — see [rn-learning-notes.md](rn-learning-notes.md)). Consequences: (1) `react-native-nitro-modules` is a peerDependency npm doesn't auto-install and CocoaPods autolinking needs present to find the `NitroModules` podspec — added it explicitly. (2) No native binding exists under Jest, so `src/services/storage.ts`'s `createMMKV()` call throws in tests; mocked via a root `__mocks__/react-native-mmkv.ts` that re-exports the library's own `createMockMMKV()` (an in-memory `Map`-backed stand-in it ships for exactly this purpose). Jest auto-applies root-level `__mocks__` overrides for node_modules packages with no per-test `jest.mock()` needed.

## 2026-07-21 — CocoaPods for iOS dependencies (for now)
Coming from native/Skip development, SPM would be the natural choice — but React Native's build orchestration and third-party autolinking are still built on CocoaPods, so the CLI template's Podfile is the paved road. Notable context: RN is actively migrating to SPM (RN 0.84 shipped precompiled iOS binaries by default to decouple the core from CocoaPods; an official RFC covers full SPM replacement including autolinking), and the CocoaPods trunk goes read-only on 2026-12-02. Decision: use CocoaPods for this build; the toolchain fight isn't the learning objective. Revisit if RN ships stable SPM autolinking.

## 2026-07-21 — RN CLI over Expo
Expo would hide exactly the layer this project exists to learn (native modules, iOS/Android project internals, codegen). Bare RN CLI with the New Architecture enabled. Tradeoff accepted: more build friction.

## 2026-07-21 — Hand-written Turbo Module over @react-native-voice/voice
A maintained community package exists and would be the pragmatic production choice. Rejected deliberately: writing the Swift/Kotlin implementations against a shared TS contract is the learning objective and the portfolio centerpiece.

## 2026-07-21 — Platform speech APIs over on-device ML models
`SFSpeechRecognizer` / Android `SpeechRecognizer` are free, mostly offline-capable, and require no model distribution. On-device LLM/ASR (whisper.cpp, llama.rn) is out of scope for a two-day build.

## 2026-07-21 — Cloud LLM with schema-constrained tool use
Structured extraction via a single tool definition with `additionalProperties: false`. Provider-agnostic service boundary (`extraction.ts`) so the provider can be swapped. On-device extraction: non-goal (see above).

## 2026-07-21 — Zustand over Redux/Context
Smallest idiomatic state solution; persist middleware pairs cleanly with MMKV. Redux is overkill at this scale; raw Context re-renders too broadly for the streaming partial-transcript case.

## 2026-07-21 — MMKV over AsyncStorage
Synchronous reads simplify launch hydration; faster; teaches a JSI-based library, which fits the New Architecture learning goal.

## 2026-07-21 — Notifee over react-native-push-notification
Actively maintained, first-class local scheduling + channels API, works without any push backend (no remote push in v1).

## 2026-07-21 — React Navigation native-stack
Community default; native-stack variant uses real platform navigation primitives (learning-relevant), typed routes.
