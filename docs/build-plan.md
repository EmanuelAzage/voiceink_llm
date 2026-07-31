---
type: plan
title: VoiceInk Build Plan
description: Milestone breakdown (M1-M6) with acceptance criteria for the two-day build
status: living
tags: [plan, milestones]
timestamp: 2026-07-31T00:20:00Z
related: [product-spec.md, native-module-transcription.md, log.md]
---

# Build Plan

Work milestones top to bottom; each ends in a committed, compiling state on both platforms (until M2, iOS only is acceptable). Target: M1–M3 day one, M4–M6 day two.

## M1 — Scaffold & navigation
- [x] `npx @react-native-community/cli init VoiceInk` (New Architecture on), TypeScript strict, eslint/prettier, absolute imports.
- [x] React Navigation native-stack: Home, Capture (modal), Review, Detail, Settings with typed routes.
- [x] Theme tokens; Home renders empty state + mic button; Zustand + MMKV wired with a trivial persisted value.
- **Accept:** app boots on iOS simulator and Android emulator; navigation works; typecheck/lint clean. ✅ 2026-07-21

## M2 — Turbo Module, iOS side
- [x] Codegen spec (`NativeTranscription.ts`) per `native-module-transcription.md`; module registered and loading.
- [x] Swift implementation: permissions, start/stop/cancel, partial events, 60s cap.
- [x] Capture screen consumes `useTranscription()`: hold-to-record, live partial transcript, release → final transcript shown raw.
- **Accept:** speak on iOS simulator/device → live partials stream → release yields final transcript ✅ 2026-07-22; permission-denied path shows correct UI ✅ 2026-07-23 (verified for both speech-recognition and microphone denial, via fresh installs to reset privacy grants).

## M3 — Turbo Module, Android side
- [x] Kotlin implementation incl. OEM auto-end quirk handling and `<queries>` manifest entry.
- [ ] Run parity checklist from the module spec on both platforms.
- **Accept:** same capture flow works on Android device ✅ 2026-07-29 (real Samsung SM-X230 via USB); parity checklist partially passes — see [native-module-transcription.md](native-module-transcription.md)'s checklist for the itemized state.

## M4 — Extraction & Review
- [x] `cardSchema.ts` + `extraction.ts` (tool-use call, `additionalProperties: false`, timeout, one schema-retry, fallback path). ✅ 2026-07-30 (Gemini free tier; needs a real `GEMINI_API_KEY` to exercise against the live API — see [decisions.md](decisions.md))
- [x] Review screen: editable fields, AI badges, tag chips, action-item rows with native date picker; Save/Discard. ✅ 2026-07-30
- [x] Raw-transcript fallback save when extraction fails. ✅ 2026-07-30
- **Accept:** end-to-end voice → structured card → edited → saved; kill network mid-flow → fallback save works; nothing ever saved without Review. Verified: build boots clean on iOS Simulator, Home→Capture navigation works, extraction verified live against the real Gemini API (see [decisions.md](decisions.md)). **Not yet verified:** the actual mic-hold → speak → Review UI path in the simulator — `SFSpeechRecognizer`'s permission prompt isn't grantable via `simctl privacy` (unsupported service), and a real recording needs real audio input, so this needs a manual pass on-device/simulator by a human rather than headless automation.

## M5 — Persistence, Detail, notifications
- [x] Card list on Home (FlatList, swipe-delete + undo); Detail with checkable items and collapsible raw transcript. ✅ 2026-07-30 — read-only list was pulled forward into M4; this milestone added swipe-to-delete + timed undo (`react-native-gesture-handler` + `react-native-reanimated`), the real Detail screen (checkable action items, collapsible raw transcript, Edit → Review pre-filled), and edit-mode in `ReviewScreen` (`Review: { cardId? }` — loads from `cardStore` instead of the extraction result, `Save` calls `updateCard`, no AI badges since it's not a fresh extraction).
- [x] Notifee: schedule on dated items, cancel on check-off/delete, tap deep-links to Detail. ✅ 2026-07-30 — `src/services/notifications.ts`; `cardStore.ts`'s add/update/delete/toggle actions own the schedule/cancel side effects (notification id == action item id, no extra bookkeeping); tap deep-linking via a `navigationRef` + `notifee.getInitialNotification()`/`onForegroundEvent`/`onBackgroundEvent` (background taps hand off through MMKV since no navigationRef exists in that JS context — see decisions.md).
- **Accept:** relaunch app → cards persist ✅ (verified surviving a true process restart on both platforms); dated action item fires a local notification whose tap opens the right card ✅ scheduling confirmed on both platforms (see below), tap-to-deep-link not observed firing live on either platform this session (would need waiting for or faking a real delivery).

  **iOS Simulator:** clean build/boot with all four new native deps (gesture-handler, reanimated, worklets, notifee — after a stale-Metro-cache false alarm, see [rn-learning-notes.md](rn-learning-notes.md)); Home→Detail→Edit→Review→Save round-trip; checkable action items; notification permission prompt fires correctly, both Allow/Deny paths clean. Swipe-to-delete's gesture specifically wasn't verified here — synthetic Simulator swipes don't reliably trigger `react-native-gesture-handler`'s native pan recognizer.

  **Android (Samsung SM-X230 tablet, real hardware):** full pipeline confirmed including live extraction against the real Gemini API; swipe-to-delete worked immediately with a real touch gesture (`adb shell input swipe`) — card removed, undo bar shown; notification scheduling confirmed concretely via `adb shell dumpsys jobscheduler` (a real WorkManager job with ~15h21m minimum latency landing at the 09:00-tomorrow target); notification cancellation on both delete and check-off confirmed the same way (job disappears from the dump); checkable items and the Edit→native-DatePickerDialog→Save round-trip all verified, including that edited state survives a true `am force-stop` + relaunch. Fixed a real deprecation along the way: `@react-native-community/datetimepicker`'s `onChange` prop is deprecated in this version in favor of `onValueChange`/`onDismiss`/`onNeutralButtonPress` — `ReviewScreen.tsx` migrated (caught by the user reading the on-device dev-mode warning banner, not by anything automated).

## M6 — Polish & portfolio
- [x] Settings: delete-all. ✅ 2026-07-30 — see [decisions.md](decisions.md)
- [ ] Accessibility pass (labels, Dynamic Type, screen-reader toggle mode for mic).
- [ ] Empty/error states reviewed; dark mode.
- [x] Icons (`lucide-react-native` + `react-native-svg`): checkboxes, tag/date remove affordances, AI badge, nav header, empty state. ✅ 2026-07-30 — see [decisions.md](decisions.md)
- [ ] Animated + haptic mic button — pulse/glow reactive to the Turbo Module's existing `onAudioLevel` stream (previously unused for visuals); haptic feedback on record start/stop, save, and delete.
- [ ] Micro-interactions: press-scale animation on card rows/buttons via `react-native-reanimated` (already installed).
- [x] Sentry (`@sentry/react-native`): crash reporting plus custom events for `extractCard`'s outcome (`timeout`/`network`/`invalid-response`/rate-limit-fallback-used), so extraction reliability is actually observable, not just handled. ✅ 2026-07-30 — see [decisions.md](decisions.md)
- [ ] README: fill the placeholder comments in the existing `README.md` — screenshots (iOS + Android, light + dark), verified setup instructions on a clean machine, `.env.example` committed.
- [x] Squash noisy WIP commits; public repo. ✅ already satisfied — history was already conventional-commit-clean with no WIP noise to squash (confirmed via `git log --oneline`), and the repo was already public (confirmed via `gh repo view`). No action needed for either.
- **Accept:** a stranger can clone, add an API key, and run both platforms from README alone.

## Stretch (only if time remains)
- Streaming the LLM response into the Review screen field-by-field.
- [x] Jest tests for `cardSchema.ts`/`extraction.ts` schema handling; one native-module mock test. ✅ 2026-07-30 — see [decisions.md](decisions.md). Surfaced and fixed a real, pre-existing gap: `__tests__/App.test.tsx` had been silently broken since react-native-config and the M2 Turbo Module landed (nobody had re-run `npm test` since); both now have Jest mocks.
- Haptics on record start/stop via the existing module (`onAudioLevel`-driven mic animation counts too).
