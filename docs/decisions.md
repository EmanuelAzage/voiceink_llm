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

## 2026-07-30 — `DateTimePicker`'s `onChange` → `onValueChange`/`onDismiss` migration
Found live on the Samsung tablet, not by any automated check: `@react-native-community/datetimepicker` v9.1.0 deprecated the unified `onChange` prop (`(event, date?) => void`, discriminate via `event.type === 'set'`) in favor of three specific callbacks — `onValueChange: (event, date) => void` (fires only on an actual selection, `date` always present), `onDismiss: () => void` (cancelled without selecting), and `onNeutralButtonPress` (Android neutral button, unused here). `ReviewScreen.tsx` migrated: `updateActionItemDate` now called directly from `onValueChange` with no `event.type` branching needed, `onDismiss` owns closing the Android dialog's `datePickerFor` state. Worth remembering as a process point, not just a code fix: this shipped once already (M4) without anyone reading the dev-mode warning banner it was throwing the whole time — caught only because the user was watching the on-device console during M5's Android pass.

## 2026-07-30 — M5 Jest mocking chain: gesture-handler → reanimated → worklets → notifee
Adding gesture-handler (swipe-to-delete) and notifee (M5) broke `__tests__/App.test.tsx` again, the same class of problem as `react-native-config`/`NativeTranscription` back in M4 — each new native-backed dependency in App's import chain needs its own Jest mock before the smoke test can run. Chased a genuine dependency chain: gesture-handler's official `jestSetup.js` (wired via `setupFiles`) mocks its own native module, but `HomeScreen`'s `Swipeable` import (`react-native-gesture-handler/ReanimatedSwipeable`) pulls in `react-native-reanimated`, whose *own* documented mock (`moduleNameMapper: '^react-native-reanimated$': 'react-native-reanimated/mock'`) still transitively requires the real `react-native-worklets` native binding — reanimated 4 split worklet internals into that separate package, and its mock wasn't fully decoupled from the real one. `react-native-worklets` ships its own mock too (`src/mock.ts`) but with no public `/mock` subpath entry, so `moduleNameMapper` points straight at the compiled output (`react-native-worklets/lib/module/mock.js`) instead. `@notifee/react-native` needed its own `__mocks__/@notifee/react-native.ts` re-exporting the library's documented `@notifee/react-native/jest-mock` (plus a stray `.d.ts` since that subpath ships untyped), and had to be added to `transformIgnorePatterns`'s allow-list since its mock file is raw ESM. All of this only to get one smoke test green — a real cost of native-module-heavy dependencies, worth remembering before adding the next one.

## 2026-07-30 — Notification id == action-item id (no separate bookkeeping)
`ActionItem.notificationId` is documented in architecture.md as distinct from `id`, implying they could diverge. Simplified: `scheduleActionItemNotification` always schedules with `id: item.id` as Notifee's notification id, so `cardStore.ts`'s cancel calls need no lookup — `cancelActionItemNotification(item.notificationId)` where `notificationId` is just set to `item.id` (or left `undefined` when nothing was actually scheduled — past-due item, no date, or permission denied). `notificationId`'s only remaining job is as a boolean-ish "does this item currently have a live scheduled notification" flag, checked before cancelling.

## 2026-07-30 — Notification tap deep-linking: navigationRef + MMKV handoff for background taps
`notifee.onBackgroundEvent` (registered in `index.js`, per Notifee's setup requirement) can fire on Android while the app is fully backgrounded, before any React code — including the `navigationRef` — exists yet. Rather than trying to defer/queue navigation from that limited JS context, the background handler just persists the tapped card's id to MMKV (`setPendingDeepLinkCardId`); `RootNavigator` checks and consumes it once on mount (`consumePendingDeepLinkCardId`), alongside `notifee.getInitialNotification()` (cold start) and `notifee.onForegroundEvent` (warm taps). A module-level `pendingNavigation` closure covers the remaining race — `getInitialNotification` resolving before `NavigationContainer`'s `onReady` fires.

## 2026-07-30 — `react-native-gesture-handler` (v3.1.0) + `react-native-reanimated` (v4.5.3) for Home's swipe-to-delete, over hand-rolling it
M5 needs swipe-to-delete on the Home card list. Considered hand-rolling with RN's own `Animated` + `PanResponder` — genuinely tempting given this project's stated "learning depth over speed" priority, and it would've been a new RN-internals topic. Decided against it: correctly interoperating a horizontal pan gesture with `FlatList`'s own vertical scroll (not stealing/fighting each other), snap-back animation, and open/close thresholds is a well-known hard problem even with a library; hand-rolling it risked real implementation time and a janky result for a single, secondary feature. Went with the standard, near-universal RN dependency instead. Setup requirements that are easy to get wrong: `import 'react-native-gesture-handler'` must be the literal first line of `index.js` (before any other import — it patches native event handling), and the app root needs a `<GestureHandlerRootView style={{flex:1}}>` wrapper (added in `App.tsx`).

Discovered only after installing: gesture-handler v3 removed its plain (non-Reanimated) `Swipeable` component entirely — the only one it ships now, `ReanimatedSwipeable` (deep-imported as `react-native-gesture-handler/ReanimatedSwipeable`), hard-requires `react-native-reanimated`. That made the real choice "add reanimated too" vs. "use gesture-handler's lower-level Pan gesture + hand-roll the animation with plain `Animated`" — re-surfaced explicitly rather than silently picked, since it changed the terms of the original decision. Went with adding reanimated: the standard, idiomatic modern-RN pairing, and genuinely useful to have touched (worklets, UI-thread animation) even though it pulled in a second native module (plus `react-native-worklets`, reanimated 4's separated worklet-runtime package, added explicitly as a direct dependency rather than left as an implicit transitive peer).

## 2026-07-30 — Colocated `.test.ts` files; local native-module mocks via `moduleNameMapper`, not `jest.mock()` per-file
First real tests in the project (`cardSchema.test.ts`, `extraction.test.ts`, both colocated next to their source in `src/services/`, not in the root `__tests__/` that only holds the RN CLI's stock `App.test.tsx`) — establishing the pattern now since nothing existed before. Colocated over centralized: easier to find, and this codebase has no other precedent to conflict with.

Running the full suite for the first time (`npm test`, not previously part of the typecheck/lint loop this session had been checking) surfaced that `__tests__/App.test.tsx` was already silently broken — first by `react-native-config` (no Jest mock, so its top-level `NativeModules.RNCConfig.getConstants()` call throws under Jest), then by `NativeTranscription`'s `TurboModuleRegistry.getEnforcing('Transcription')` (native module obviously doesn't exist under Jest, and unlike `react-native-mmkv`'s `__mocks__/react-native-mmkv.ts`, this is a *local* file, not a node_modules package, so Jest doesn't auto-apply a sibling `__mocks__` for it). Fixed both:
- `__mocks__/react-native-config.ts` — same automatic-node_modules-mock pattern as MMKV's, `Config = {}`.
- `modules/transcription/__mocks__/NativeTranscription.ts` — a local mock, wired in via `jest.config.js`'s `moduleNameMapper` (`'NativeTranscription$'`) since local mocks need an explicit hookup; auto-`__mocks__`-adjacency only works for node_modules packages. Matches the regex against the *import specifier* (`./NativeTranscription`, post-Babel-alias-rewrite), not the resolved absolute path — moduleNameMapper doesn't see resolved paths.

`extraction.test.ts` mocks `react-native-config` per-file (`jest.mock('react-native-config', factory)`) instead, since it needs specific fake `GEMINI_API_KEY`/`GEMINI_MODEL` values — a per-test `jest.mock()` call takes precedence over the root automock for that one file.

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
