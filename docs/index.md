---
okf_version: "0.1"
---

# VoiceInk Knowledge Base

VoiceInk is a React Native (New Architecture, TypeScript) voice-notes app for iOS and Android: hold to record, speech is transcribed on-device via a hand-written Turbo Module, an LLM structures the transcript into an editable card, the user reviews and saves. The Turbo Module is the architectural centerpiece and must not be replaced with a third-party speech package.

# Concepts

* [VoiceInk Product Spec](product-spec.md) - Screens, user flows, and UX rules; review-before-save is non-negotiable
* [VoiceInk Architecture](architecture.md) - Layers, data flow, state management, persistence, and project structure
* [TranscriptionProvider Turbo Module Spec](native-module-transcription.md) - TS contract, Swift/Kotlin implementation notes, permissions, error codes, parity checklist
* [VoiceInk Build Plan](build-plan.md) - Milestone breakdown (M1-M6) with acceptance criteria; work top to bottom
* [VoiceInk Decisions](decisions.md) - ADR-lite log of technical choices and rationale; check before adding dependencies
* [React Native Learning Notes](rn-learning-notes.md) - Living doc of RN internals; append notes as concepts come up during the build
* [Mobile Accessibility Engineering Guide & Audit Checklist](mobile-accessibility-engineering-guide.md) - WCAG 2.1/2.2 reference copied from a sibling SwiftUI/Skip project; background reading, not applied verbatim to this RN codebase

# History

* [Update Log](log.md) - Chronological history of notable project events, newest first

# Maintenance rules

* Update the relevant concept doc in the same change that alters behavior or decisions, and refresh its `timestamp`.
* Record notable events in [log.md](log.md) under an ISO-dated heading, newest first, with a bold leading convention word (**Update**, **Creation**, **Decision**).
* Frontmatter: `type` is required on every concept; recommended fields are `title`, `description`, `tags`, `timestamp` (ISO-8601); producer extensions in use here are `status` and `related`. Reserved files `index.md` and `log.md` carry no frontmatter (root index carries only `okf_version`).
