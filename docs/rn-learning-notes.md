---
type: learning-notes
title: React Native Learning Notes
description: Living doc of RN internals to understand while building — seeded with topics, filled in with notes as they come up in practice
status: living
tags: [learning, react-native, internals]
timestamp: 2026-07-21T21:20:00Z
related: [native-module-transcription.md, architecture.md]
---

# RN Learning Notes

Living doc. When an RN-specific concept surfaces during the build, append a short note here with what it is, where it appeared in this codebase, and how it maps to native-mobile equivalents. Seed topics below; notes accumulate under each.

## New Architecture

The question RN always has to answer: **how does JavaScript drive native UI/code?** "Old" and "new" are two answers to that.

**Old — the Bridge.** JS ran in its own engine/thread; native ran on the native side; between them sat a component literally called the Bridge. A JS→native call was serialized to a JSON message, sent **asynchronously** across the bridge, deserialized, and acted on. Three baked-in limitations: async only (JS could never get a synchronous value back from native), JSON serialization on every crossing (cheap per message, a congestion point under high volume), and everything funneled through one batched channel. Classic symptom: fast-scrolling a big list stutters because JS emits updates faster than serialize→cross→deserialize can clear them.

**New — JSI + its stack.** The centerpiece is **JSI (JavaScript Interface)**, a lightweight C++ layer letting JS hold a *direct reference* to a native object and call its methods **synchronously** — no JSON, no message-passing. On top of JSI:
- **TurboModules** — native modules exposed through JSI; lazy-loaded (only instantiated on first use → faster startup) and synchronous-capable. *Appears here:* `modules/transcription/` — `TranscriptionProvider` is a TurboModule.
- **Fabric** — the new renderer; UI tree ("shadow tree") managed in C++, integrates with concurrent React, shares view data with native more directly than the bridge did.
- **Codegen** — because JSI is typed C++, RN generates the native binding boilerplate from the typed TS spec at build time. That's why the module has a `NativeTranscription.ts` spec file: codegen reads it and emits the glue. *Look at the generated files on both platforms while building — seeing them turns "TurboModules use JSI" into something touched, not memorized.*

So **New Architecture ≈ JSI + TurboModules + Fabric + Codegen, replacing the Bridge.** Default since ~RN 0.76 (late 2024); by 2026 it's simply *the* architecture and the legacy bridge is frozen.

**Native-dev analogy:** the old bridge is two processes talking over a socket in JSON — clean boundary, but every call pays serialization and is inherently async. JSI is like linking against a library and calling its functions through a header — the two languages share a C++-level interface and call across it in-process. Same reason a linked call beats an IPC round-trip. (Related: RN 0.84's precompiled iOS binaries + the CocoaPods→SPM migration are part of this *same* modernization push.)

## Threading model
Three key threads: JS thread (app logic/React), UI/main thread (platform rendering), plus native module & render threads. Map to native experience: keeping heavy work off the main thread is the same discipline as avoiding main-thread I/O in iOS — this project keeps audio/recognition entirely native-side and passes only strings across.

## Hermes (vs JSC)

Separate axis from the architecture: the architecture is *how JS talks to native*; the **JS engine** is *what runs the JavaScript itself*. RN needs some engine to execute the JS bundle.

**JSC (JavaScriptCore)** — Apple's engine (inside Safari, available system-wide on iOS). Early RN used it on both platforms because it was already present on iOS and embeddable on Android. It's a general-purpose *browser* engine: takes JS **source text** at runtime, parses it, compiles it, runs it, and leans on **JIT** (just-in-time compilation — watches hot code and compiles it to machine code *while the app runs*) for steady-state speed. Great for a long-lived browser tab; less ideal for an app opened and closed constantly, because JIT warm-up happens after launch, every launch.

**Hermes** — an engine Meta built specifically for RN (open-sourced 2019, default since ~2022, "Hermes V1" standard around RN 0.84). Key move: **ahead-of-time bytecode precompilation.** Instead of shipping JS *source* that's parsed/compiled on-device at launch, Hermes compiles JS to compact **bytecode at build time**; the app ships the bytecode and starts executing almost immediately.

Why startup is faster, concretely:
- **Parse/compile moved from runtime to build time** — JSC parsed the whole bundle at launch; Hermes did it on the build machine already.
- **No JIT warm-up** — Hermes omits a JIT on purpose. It trades some peak steady-state throughput for fast, predictable startup and lighter memory — the right trade for open-often/run-briefly apps, the wrong one for a browser.
- **Lower memory** — precompiled bytecode + no JIT machinery = less runtime overhead; matters most on low-end Android.

**Native-dev analogy:** JSC shipping JS source that's parsed-and-JIT-compiled on launch is like distributing an app as **source that compiles on the user's device every open**. Hermes precompiling to bytecode is like shipping a **prebuilt binary** — the expensive compile happened at build time, so launch is load-and-run. Same instinct as reaching for prebuilt/precompiled artifacts to cut launch cost (and rhymes with RN 0.84's precompiled iOS binaries — same philosophy, different layer).

**One-line frame:** Hermes is *which engine runs your JS*; the New Architecture is *how that JS reaches native code*. Independent choices that matured together; modern RN defaults both on.

## Metro
The bundler: single JS bundle, fast refresh, platform-specific extensions (`.ios.tsx` / `.android.tsx`). Compare mental model to Xcode build phases / Gradle.

## iOS dependency tooling — CocoaPods today, SPM coming
RN still orchestrates iOS native deps via **CocoaPods** (the `Podfile` + `pod install`), and its **autolinking** (auto-discovering native modules to build) is built on CocoaPods — that's why this project uses pods despite SPM being the native-dev default (see [decisions.md](decisions.md)). But RN is **actively migrating to SPM**: an official RFC covers the CocoaPods→SPM replacement including autolinking; RN 0.84 (Feb 2026) made precompiled iOS binaries default to decouple the core from CocoaPods orchestration; and the forcing function is external — the **CocoaPods trunk goes read-only Dec 2, 2026**, with vendors (Firebase ~Oct 2026, Google Maps already) cutting over ahead of it. Existing pod apps keep building after that date (registry just stops accepting *new* pods); new projects increasingly default to SPM. **Interview line:** "RN is mid-migration from CocoaPods to SPM — driven by the New Architecture decoupling from Ruby build tooling, forced by CocoaPods going read-only Dec 2026 — but pods are still the paved road because SPM autolinking isn't fully stable yet." Ties to native experience: I've used both pods and SPM in native/Skip work, so this is a tooling-trajectory question, not a new concept.

## Rendering & lists
- React reconciliation → shadow tree → native views; what causes re-renders, why memoization matters with a streaming partial transcript feeding state.
- **FlatList virtualization** — windowed rendering, `keyExtractor`, `getItemLayout`. Directly analogous to prior native lazy-loading/memory work on image-heavy lists.

## Ecosystem fluency (screen-conversation level)
Expo vs bare workflow tradeoffs · React Navigation patterns · state library landscape (Zustand/Redux/Jotai) · MMKV vs AsyncStorage · how OTA updates (CodePush-style) relate to store releases · testing story (Jest, React Native Testing Library, Detox).

## Interview bridges (own-experience mapping)
- Shared TS contract + Swift/Kotlin implementations ↔ shared-interface/native-implementation pattern from prior cross-platform work.
- JS-thread jank vs main-thread jank ↔ prior watchdog-termination and main-thread-I/O debugging.
- FlatList memory behavior ↔ prior image-heavy list memory profiling (4GB → 700MB story).
