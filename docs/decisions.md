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
