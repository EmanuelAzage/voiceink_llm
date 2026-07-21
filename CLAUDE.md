# CLAUDE.md — VoiceInk

Voice-notes app for iOS and Android that turns rambling speech into structured, editable cards. Hold to record → on-device transcription → LLM extracts a structured card (title, tags, action items, dates) → user reviews and edits → save. Action items with dates schedule local notification reminders.

React Native (CLI, New Architecture) + TypeScript. The custom Turbo Module bridging native speech recognition (Swift + Kotlin) is the architectural centerpiece — do not replace it with a third-party speech library.

## Knowledge base

`docs/` is the source of truth, structured as an Open Knowledge Format (OKF v0.1) bundle — spec: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md. Concepts are markdown files with YAML frontmatter: `type` (required, lowercase), plus `title`, `description`, `tags`, `timestamp` (ISO-8601), and producer extensions `status` and `related`. Reserved files carry no frontmatter: `index.md` (root index holds only `okf_version`; body is sections of `* [Title](link) - description` bullets) and `log.md` (`## YYYY-MM-DD` headings, bullets led by **Update**/**Creation**/**Decision**). Start at `docs/index.md` and follow links to the concept relevant to your task. Update the relevant doc in the same change when behavior or decisions change (refresh its `timestamp`); record notable events in `docs/log.md`, newest first.

| Concept | Contents |
|---|---|
| `docs/index.md` | Bundle entry point — read first |
| `docs/product-spec.md` | Screens, flows, UX rules (review-before-save is non-negotiable) |
| `docs/architecture.md` | Layers, data flow, state, persistence, project structure |
| `docs/native-module-transcription.md` | `TranscriptionProvider` Turbo Module spec — TS interface, Swift/Kotlin implementations, permissions, error contract |
| `docs/build-plan.md` | Milestones M1–M6 with acceptance criteria; work top to bottom |
| `docs/decisions.md` | Tech choices and why (ADR-lite). Add an entry for every non-obvious choice |
| `docs/rn-learning-notes.md` | RN internals to understand while building (living doc) |
| `docs/log.md` | Chronological history of notable events |

## Project goals (in priority order)

1. **Learning depth over speed.** The developer is a senior native iOS/cross-platform engineer learning React Native specifics. Prefer idiomatic RN solutions; when an RN-specific concept comes up (bridge vs JSI, threading, Fabric, Hermes, Metro), briefly explain it in the response and append a note to `docs/rn-learning-notes.md`.
2. **A clean public portfolio repo.** Small, readable, well-documented. No dead code, no TODO litter.
3. **Working app on both platforms** with screenshots in the README.

## Commands

```bash
npm start                 # Metro
npm run ios               # build + run iOS simulator
npm run android           # build + run Android emulator
npm run lint              # eslint + prettier check
npm run typecheck         # tsc --noEmit
npm test                  # jest
cd ios && pod install     # after native dep changes
```

## Conventions

- TypeScript `strict`; no `any` without an inline justification comment.
- Functional components + hooks only. Zustand for app state, React Navigation (native-stack) for routing, MMKV for persistence.
- Native module code lives in `modules/transcription/` (TS spec + `ios/` + `android/`); app code in `src/` (`screens/`, `components/`, `state/`, `services/`, `theme/`).
- LLM calls go through `src/services/extraction.ts` only. The JSON schema for card extraction is defined once in `src/services/cardSchema.ts` and enforced via tool use with `additionalProperties: false`.
- API keys via `.env` (react-native-config), never committed. `.env.example` documents required vars.
- Never auto-save an AI-generated card. Every card passes through the Review screen.
- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`), one logical change per commit.

## Guardrails

- Don't add dependencies without checking `docs/decisions.md` for an existing choice; log new ones there.
- Don't eject to Expo or wrap the native layer in a prebuilt speech package — the hand-written Turbo Module is the point.
- Keep both platforms compiling: any change to the module's TS spec must update Swift and Kotlin in the same change.
