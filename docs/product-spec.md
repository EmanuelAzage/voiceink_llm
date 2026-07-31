---
type: spec
title: VoiceInk Product Spec
description: Screens, user flows, and UX rules for the VoiceInk voice-notes app
status: living
tags: [spec, ux, screens]
timestamp: 2026-07-30T23:50:00Z
related: [architecture.md, build-plan.md]
---

# Product Spec

One-line pitch: hold a button, ramble, release — get back a clean, structured, *editable* card.

## Core loop

1. **Capture.** User press-and-holds the mic button and speaks freely. Release (or 60s cap) stops recording. Live partial transcript renders while speaking.
2. **Structure.** Final transcript goes to the LLM with a fixed JSON schema. Output: `{ title, summary, tags[], actionItems[{ text, dueDate? }] }`. Nothing else — schema forbids extra fields.
3. **Review.** Card is shown in an editable review state; AI-filled fields are visually marked. User can edit any field, delete action items, or discard the whole card. **Nothing is saved without passing through this screen.**
4. **Save.** Card persists locally. Any action item with a `dueDate` schedules a local notification.

## Screens

### Home (card list)
- Reverse-chronological list of saved cards (FlatList): title, date, tag chips, action-item count.
- Prominent mic button (bottom center), pulses with live audio level while recording (M6). Empty state invites first capture with a simple icon, not text alone (M6).
- Tap card → Detail. Swipe → delete (with undo snackbar); haptic feedback on delete (M6).

### Capture (modal over Home)
- Opens on mic press. Shows recording indicator + streaming partial transcript.
- Release → brief "structuring…" state → navigates to Review.
- Errors (permission denied, recognizer unavailable, network fail on LLM call) render inline with a retry path; transcript is never lost — fallback offers saving the raw transcript as an unstructured card.

### Review
- Editable title, summary, tag chips (add/remove), action-item rows (text + optional date via native date picker).
- AI-filled fields carry a subtle "AI" badge (icon, M6) until touched.
- Buttons: Save / Discard. Save schedules notifications for dated items; haptic feedback on save (M6).

### Detail
- Read view of a card; checkable action items (icon checkbox, M6 — checking one cancels its pending notification, with a "Reminder set" status shown when a notification is actually scheduled). Edit reopens Review pre-filled. Shows original raw transcript in a collapsible section.

### Settings
- Language for speech recognition (passed to the native module — no auto-detection assumed).
- "Delete all data."

## UX rules

- Visual language (M6): `lucide-react-native` icons over plain text/color shapes where an icon reads faster than text (checkboxes, remove affordances, AI badge); light haptic feedback on record start/stop, save, and delete reinforces state changes without needing to look at the screen.
- Review-before-save is non-negotiable; the AI proposes, the human disposes.
- Offline behavior: capture and transcription work offline where the platform recognizer supports it; if the LLM call fails, offer raw-transcript save so no speech is ever lost.
- Permissions are requested in context (first mic press), each with a pre-permission explainer line, and denial states are handled with a path to system settings.
- Accessibility: Dynamic Type respected, all controls labeled, mic button operable via screen reader (toggle mode instead of press-and-hold).

## Non-goals (v1)

Cloud sync, accounts, audio playback/storage of recordings, on-device LLM, iPad-optimized layouts, localization beyond recognizer language choice.
