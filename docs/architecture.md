---
type: architecture
title: VoiceInk Architecture
description: Layers, data flow, state management, persistence, and project structure
status: living
tags: [architecture, state, persistence, structure]
timestamp: 2026-07-30T23:55:00Z
related: [native-module-transcription.md, product-spec.md, decisions.md]
---

# Architecture

## Layers

```
UI (screens/components, React Navigation)
        │
State (Zustand stores: cards, capture session, settings)
        │
Services (extraction.ts → LLM API · notifications.ts · storage.ts → MMKV)
        │
Native boundary (TranscriptionProvider Turbo Module — TS spec, Swift + Kotlin impls)
```

Unidirectional flow: native module emits transcription events → capture store updates → UI re-renders. Services are plain TS modules with no React imports; stores call services, components call stores.

**Observability:** `@sentry/react-native` (`src/services/observability.ts`) sits outside this layer diagram, not inside it — crash reporting spans every layer rather than living in one. `initObservability()` runs once at the app root (`App.tsx`, no-ops if `SENTRY_DSN` is unset) and the root component is wrapped in `Sentry.wrap` for automatic JS/native crash capture. `extraction.ts` reports a structured log event (`Sentry.logger`) for each terminal `ExtractionResult` failure (`timeout`/`network`/`invalid-response`, tagged with which model produced it) and for each time the `GEMINI_FALLBACK_MODEL` rate-limit fallback actually fires, so extraction reliability is a real, queryable signal rather than only ever pattern-matched in `ReviewScreen`'s error branch. See [decisions.md](decisions.md) for why Sentry over Firebase/PostHog/Datadog and for the manual (non-wizard) setup details.

## The native boundary

`TranscriptionProvider` is the only hand-written native code. Full spec in `native-module-transcription.md`. Design intent mirrors a shared-interface / per-platform-implementation pattern: one TypeScript contract, `SFSpeechRecognizer` behind it on iOS, `SpeechRecognizer` on Android. Everything above the contract is platform-agnostic.

## State (Zustand)

- `useCardStore` — cards CRUD; hydrates from MMKV at launch, persists on mutation (zustand persist middleware with MMKV storage adapter).
- `useCaptureStore` — ephemeral session: `idle | recording | structuring | error`, partial transcript, final transcript, extraction result. Never persisted.
- `useSettingsStore` — language; persisted.

## Data model

```ts
interface ActionItem { id: string; text: string; dueDate?: string; done: boolean; notificationId?: string }
interface Card {
  id: string; createdAt: string;
  title: string; summary: string; tags: string[];
  actionItems: ActionItem[];
  rawTranscript: string;
  source: 'ai' | 'manual';   // 'manual' = raw-transcript fallback save
}
```

## Extraction service

`services/extraction.ts` sends `{ transcript, today }` to the LLM with a tool definition generated from `cardSchema.ts` (`additionalProperties: false`; `tags` capped at 5; `dueDate` ISO-8601). Handles: timeout (15s), non-conforming output (one retry with error feedback), network failure (surface fallback path). The schema is the single source of truth — review UI renders from the same shape.

## Notifications

`services/notifications.ts` wraps Notifee: request permission on first dated action item, schedule at dueDate (09:00 local if date-only), cancel on item check-off or card delete, deep-link tap → Detail screen for that card.

## Project structure

```
/CLAUDE.md /AGENTS.md /docs
/modules/transcription/{index.ts, NativeTranscription.ts, ios/, android/}
/src
  /screens: Home, Capture, Review, Detail, Settings
  /components: CardRow, TagChips, ActionItemRow, MicButton, AIBadge
  /state: cardStore.ts, captureStore.ts, settingsStore.ts
  /services: extraction.ts, cardSchema.ts, notifications.ts, storage.ts
  /theme: colors.ts, typography.ts, spacing.ts
  /navigation: RootNavigator.tsx, types.ts
```

## Threading notes (why perf stays clean)

Speech recognition and audio run entirely on native threads; only lightweight partial-transcript strings cross into JS via TurboModule events. The LLM call is a plain async fetch. The JS thread does no heavy work, so the UI thread never blocks — same discipline as keeping I/O off the main thread in native apps.
