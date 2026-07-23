---
type: plan
title: VoiceInk Build Plan
description: Milestone breakdown (M1-M6) with acceptance criteria for the two-day build
status: living
tags: [plan, milestones]
timestamp: 2026-07-21T21:00:00Z
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
- [ ] Kotlin implementation incl. OEM auto-end quirk handling and `<queries>` manifest entry.
- [ ] Run parity checklist from the module spec on both platforms.
- **Accept:** same capture flow works on Android emulator (with host mic) / device; parity checklist passes.

## M4 — Extraction & Review
- [ ] `cardSchema.ts` + `extraction.ts` (tool-use call, `additionalProperties: false`, timeout, one schema-retry, fallback path).
- [ ] Review screen: editable fields, AI badges, tag chips, action-item rows with native date picker; Save/Discard.
- [ ] Raw-transcript fallback save when extraction fails.
- **Accept:** end-to-end voice → structured card → edited → saved; kill network mid-flow → fallback save works; nothing ever saved without Review.

## M5 — Persistence, Detail, notifications
- [ ] Card list on Home (FlatList, swipe-delete + undo); Detail with checkable items and collapsible raw transcript.
- [ ] Notifee: schedule on dated items, cancel on check-off/delete, tap deep-links to Detail.
- **Accept:** relaunch app → cards persist; dated action item fires a local notification whose tap opens the right card, on both platforms.

## M6 — Polish & portfolio
- [ ] Settings (language, API key, delete-all); accessibility pass (labels, Dynamic Type, screen-reader toggle mode for mic).
- [ ] Empty/error states reviewed; dark mode.
- [ ] README: fill the placeholder comments in the existing `README.md` — screenshots (iOS + Android, light + dark), verified setup instructions on a clean machine, `.env.example` committed.
- [ ] Squash noisy WIP commits; public repo.
- **Accept:** a stranger can clone, add an API key, and run both platforms from README alone.

## Stretch (only if time remains)
- Streaming the LLM response into the Review screen field-by-field.
- Jest tests for `extraction.ts` schema handling; one native-module mock test.
- Haptics on record start/stop via the existing module (`onAudioLevel`-driven mic animation counts too).
