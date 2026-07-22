---
type: learning-notes
title: React Native Learning Notes
description: Living doc of RN internals to understand while building — seeded with topics, filled in with notes as they come up in practice
status: living
tags: [learning, react-native, internals]
timestamp: 2026-07-22T09:00:00Z
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

## Nitro Modules — a second JSI layer, sitting next to TurboModules

Learned this the hard way: `react-native-mmkv` v4 replaced its old `new MMKV()` class with `createMMKV()`, and importing it crashed with *"Failed to get NitroModules: the native Turbo/Native-Module could not be found."* Nitro Modules is a JSI-based native-module framework built by Margelo (the MMKV/Vision Camera/Reanimated-adjacent team) — not part of React Native core, but built *on the same JSI primitive* TurboModules use (JSI = JS holding a direct, synchronous, in-process reference to a native C++ object — think `@objc` bridging without the Bridge's serialization). TurboModules and Nitro are **sibling codegen systems targeting the same JSI foundation**, not one built on the other.

**Where they differ, concretely:**
- **TurboModules** (RN core): spec a `.ts extends TurboModule` interface; RN's own Codegen generates Objective-C++ (iOS) / Java (Android) binding boilerplate you conform to. `TranscriptionProvider` (`modules/transcription/`) is one of these — the M2/M3 work will show the generated glue directly.
- **Nitro** (third-party): spec a `.nitro.ts` "HybridObject" interface (seen directly in `node_modules/react-native-mmkv/src/specs/MMKV.nitro.ts`); Nitro's own codegen ("Nitrogen") generates **pure Swift and pure Kotlin** conformances — no hand-written Objective-C++/JNI required, which is a real ergonomics win over TurboModules' current authoring experience.

**The detail that makes the relationship click:** Nitro doesn't sidestep TurboModules — it bootstraps itself through *exactly one* real TurboModule, named `"NitroModules"`. That's what our actual crash showed:
```
at Object.getEnforcing (node_modules/react-native/Libraries/TurboModule/TurboModuleRegistry.js:28:26)
at Object.getEnforcing (node_modules/react-native-nitro-modules/src/turbomodule/NativeNitroModules.ts:37:39)
```
`react-native-nitro-modules` calls RN's own `TurboModuleRegistry.getEnforcing('NitroModules')` for one bootstrap module; every Nitro-based library (MMKV included) then rides on top of that single module via Nitro's own runtime, rather than each library registering its own TurboModule. Swift analogy: a plugin framework that installs itself as exactly one `@objc` bridge class, and every plugin built "on" the framework routes through that one class instead of writing its own bridge.

**Benefits (why a library author picks Nitro):** no ObjC++/JNI boilerplate, idiomatic Swift/Kotlin bindings; claimed better performance on high-frequency calls (more direct type marshalling than TurboModules' current codegen); "HybridObjects" let native object references pass between JS calls, not just primitives — plausible wins for something called as often as MMKV's `getString`/`setString`.

**Disadvantages (what we actually paid for it):**
- Extra install surface: `react-native-nitro-modules` is a `peerDependency` npm doesn't auto-install, and CocoaPods autolinking needs it *present* to find the `NitroModules` podspec — we hit both failure modes back to back (Jest crash, then `pod install` erroring "Unable to find a specification for NitroModules").
- Decoupled from RN's release train: TurboModules ship in lockstep with React Native itself; Nitro is an independent project whose New-Architecture compatibility and maintenance depend on a separate team's priorities.
- Ecosystem fragmentation: two parallel native-module systems now live in this project's dependency tree, not one.
- API churn risk lands on consumers: MMKV v4's `new MMKV()` → `createMMKV()` break was a direct consequence of moving onto Nitro's HybridObject pattern — my first draft of `storage.ts` used the old (memorized, now-wrong) API, and it surfaced as a Jest crash before `tsc` ever caught it, since I hadn't rerun typecheck yet at that point.

**Native-dev analogy:** JSI is the C-ABI-equivalent substrate; TurboModules and Nitro Modules are two different codegen toolchains built on top of it — like two ORMs both compiling down to the same SQL wire protocol. Knowing JSI exists doesn't tell you which codegen a given library picked; you find out from the library's own docs (or, as here, from the runtime error).

## `setOptions` + `useLayoutEffect` for dynamic headers, and `Pressable`

React Navigation's header is normally *declarative* — static `options` on `<Stack.Screen>` in the navigator (that's what screen titles use here: `options={{ title: 'VoiceInk' }}`). When a screen needs to inject something dynamic into its own header — say, a button whose `onPress` needs a value only the screen component has — the escape hatch is `navigation.setOptions()`, called imperatively from inside the screen.

I first wrote a Settings-button-in-the-header this way:
```tsx
useLayoutEffect(() => {
  navigation.setOptions({
    headerRight: () => <Pressable onPress={...}><Text>Settings</Text></Pressable>,
  });
}, [navigation]);
```
**Why `useLayoutEffect`, not `useEffect`:** a real React Navigation recommendation, not style. `useEffect` runs *after* paint — asynchronously, next tick — so with `setOptions` in a `useEffect`, the screen would render with the default header first, paint it, then patch in the custom header a moment later: a visible flicker. `useLayoutEffect` runs synchronously right after React commits host-tree changes but *before* anything is presented on screen, so the header is correct from the first frame. UIKit analogy: setting `navigationItem.rightBarButtonItem` in `viewWillAppear` (before the view is shown) vs. `viewDidAppear` (after — a visible late pop-in).

**Why it got removed:** ESLint's `react/no-unstable-nested-components` (from `@react-native/eslint-config`) flagged the inline `headerRight: () => (...)` arrow function — the rule exists because defining a component inline inside a render body gives it a fresh identity every render, which (when that pattern renders actual JSX in the tree across re-renders) makes React's reconciler treat it as a new component type each time and tear down/remount the subtree. Extracting a named `HeaderSettingsButton` component fixed the button's own identity but the rule still flagged the *outer* callback — arguably a false positive here, since `headerRight` is a render-prop the navigator calls imperatively, not a JSX element React's reconciler diffs directly. Rather than fight the lint rule (`useCallback`, a disable-comment), the simpler fix was to not use the header at all: the Settings link became plain JSX in `HomeScreen`'s own `return`, no effect, no timing to reason about.

**`Pressable`:** a core RN component (`react-native` itself, not a dependency) — the modern general-purpose replacement for the older `TouchableOpacity`/`TouchableHighlight` family. Wraps arbitrary children, exposes `onPress`/`onPressIn`/`onPressOut`/`onLongPress`, a `style` that can be a function of press state (`({ pressed }) => ({...})`), `hitSlop`, and `android_ripple`. SwiftUI analogy: closest to `Button { action } label: { ... }` or `.onTapGesture { }` — an unstyled tap container where you own all the visuals. UIKit analogy: a view wrapped in `UITapGestureRecognizer`, or a bare `UIControl` with `.addTarget(_:action:for:.touchUpInside)` — `onPress` fires on the RN equivalent of `.touchUpInside`. RN ships a `<Button>` too, but it's closer to a stock system button with little styling control; `Pressable` is what you reach for whenever you want a custom-looking tappable element (used for both the Settings link and the mic button here).

## Metro's babel pipeline and its cache

Added `babel-plugin-module-resolver` for `@/*` absolute imports, but the running Metro dev server kept failing to resolve them — until I killed it and restarted with `--reset-cache`. Reason: Metro transforms each file through your `babel.config.js` (which is where the resolver plugin rewrites `@/foo` → the real relative path) as part of building its dependency graph, then *caches* that transform output keyed by file content — but a `babel.config.js` edit isn't part of that cache key by default in a long-running dev server process, so a server started before the config changed keeps serving pre-alias transforms.

**Native-dev analogy:** this is the RN-bundler equivalent of Xcode's derived-data staleness — a build-system cache invalidated by inputs it doesn't fully track. `--reset-cache` here is the same move as nuking DerivedData.

## Typed navigation via global declaration merging

React Navigation v7's idiomatic pattern for typed routes: define a `RootStackParamList` type, then merge it into a global `ReactNavigation.RootParamList` interface (`declare global { namespace ReactNavigation { interface RootParamList extends RootStackParamList {} } }` in `src/navigation/types.ts`). This makes every navigation hook (`useNavigation()`, `NativeStackScreenProps`, etc.) app-wide type-safe without threading a generic through every call site — TypeScript's declaration merging fills in the library's otherwise-generic `RootParamList` with this app's concrete route list, project-wide, from one file.

## CocoaPods writes build settings into the pbxproj — and is telling you it's leaving

Running `pod install` auto-edits `ios/*.xcodeproj/project.pbxproj` and `Info.plist` directly — e.g. it wrote `RCT_REMOVE_LEGACY_ARCH=1` / `USE_HERMES=true` build flags and an `RCTNewArchEnabled` plist key as part of integrating the generated pods. This is normal (every RN iOS project's pbxproj carries CocoaPods-injected settings; they're meant to be committed) — but `pod install` now also prints a live deprecation notice pointing at `yarn ios`/`expo run:ios` instead, which is the RN team's migration-in-progress away from CocoaPods orchestration mentioned in [decisions.md](decisions.md)'s CocoaPods entry — seeing it fire on a plain `pod install` in mid-2026 is a concrete, dated data point for that migration's timeline, not just the announcement blog post.

## Interview bridges (own-experience mapping)
- Shared TS contract + Swift/Kotlin implementations ↔ shared-interface/native-implementation pattern from prior cross-platform work.
- JS-thread jank vs main-thread jank ↔ prior watchdog-termination and main-thread-I/O debugging.
- FlatList memory behavior ↔ prior image-heavy list memory profiling (4GB → 700MB story).
