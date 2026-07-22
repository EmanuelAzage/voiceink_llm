---
type: learning-notes
title: React Native Learning Notes
description: Living doc of RN internals to understand while building — seeded with topics, filled in with notes as they come up in practice
status: living
tags: [learning, react-native, internals]
timestamp: 2026-07-22T11:00:00Z
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

**Why it got removed:** ESLint's `react/no-unstable-nested-components` (from `@react-native/eslint-config`) flagged the inline `headerRight: () => (...)` arrow function — the rule exists because defining a component inline inside a render body gives it a fresh identity every render, which (when that pattern renders actual JSX in the tree across re-renders) makes React's reconciler treat it as a new component type each time and tear down/remount the subtree. Extracting a named `HeaderSettingsButton` component fixed the button's own identity but the rule still flagged the *outer* callback — arguably a false positive here, since `headerRight` is a render-prop the navigator calls imperatively, not a JSX element React's reconciler diffs directly. First fix was to sidestep the header entirely (plain JSX in `HomeScreen`'s body) — functional, but not the idiomatic pattern.

**The actual idiomatic fix, found on a second pass:** define the header button as a **stable, named component at module scope** (outside any component's render, so it's created once when the module loads, not per-render), reading what it needs — `navigation` via `useNavigation()`, theme via `useTheme()` — through hooks instead of props. Pass it **by reference**, not wrapped in an inline arrow, to `options.headerRight` on `<Stack.Screen>`:
```tsx
function HomeHeaderRight() {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Home'>>();
  return <Pressable onPress={() => navigation.navigate('Settings')}><Text style={{color: colors.primary}}>Settings</Text></Pressable>;
}
// <Stack.Screen name="Home" component={HomeScreen} options={{ headerRight: HomeHeaderRight }} />
```
No inline arrow (nothing for the lint rule to flag), and no `useLayoutEffect`/`setOptions` at all — that machinery is only needed when the header must react to state that lives *inside* the screen component (e.g. a Save button disabled until a form is valid); a header with nothing screen-local to depend on should just be declared statically in the navigator. **Why SwiftUI never needs this dance:** `.toolbar { }` is a modifier on the view itself, re-evaluated automatically whenever `@State` changes, same as the rest of `body`. React Navigation's header is rendered by a structurally different component (the `Navigator`, not the screen) — `setOptions` exists specifically to bridge that gap when a screen truly needs to reach up and patch it.

**`Pressable`:** a core RN component (`react-native` itself, not a dependency) — the modern general-purpose replacement for the older `TouchableOpacity`/`TouchableHighlight` family. Wraps arbitrary children, exposes `onPress`/`onPressIn`/`onPressOut`/`onLongPress`, a `style` that can be a function of press state (`({ pressed }) => ({...})`), `hitSlop`, and `android_ripple`. SwiftUI analogy: closest to `Button { action } label: { ... }` or `.onTapGesture { }` — an unstyled tap container where you own all the visuals. UIKit analogy: a view wrapped in `UITapGestureRecognizer`, or a bare `UIControl` with `.addTarget(_:action:for:.touchUpInside)` — `onPress` fires on the RN equivalent of `.touchUpInside`. RN ships a `<Button>` too, but it's closer to a stock system button with little styling control; `Pressable` is what you reach for whenever you want a custom-looking tappable element (used for both the Settings link and the mic button here).

**`useNavigation()`:** grabs the nearest ancestor navigator's navigation object out of React Context, without prop-drilling it down through every intermediate component. SwiftUI analogy: genuinely close to `@Environment` — both are ambient data injected higher up the tree and readable anywhere below without threading it through parameters.

## Metro's babel pipeline and its cache

Added `babel-plugin-module-resolver` for `@/*` absolute imports, but the running Metro dev server kept failing to resolve them — until I killed it and restarted with `--reset-cache`. Reason: Metro transforms each file through your `babel.config.js` (which is where the resolver plugin rewrites `@/foo` → the real relative path) as part of building its dependency graph, then *caches* that transform output keyed by file content — but a `babel.config.js` edit isn't part of that cache key by default in a long-running dev server process, so a server started before the config changed keeps serving pre-alias transforms.

**Native-dev analogy:** this is the RN-bundler equivalent of Xcode's derived-data staleness — a build-system cache invalidated by inputs it doesn't fully track. `--reset-cache` here is the same move as nuking DerivedData.

## Typed navigation via global declaration merging

React Navigation v7's idiomatic pattern for typed routes: define a `RootStackParamList` type, then merge it into a global `ReactNavigation.RootParamList` interface (`declare global { namespace ReactNavigation { interface RootParamList extends RootStackParamList {} } }` in `src/navigation/types.ts`). This makes every navigation hook (`useNavigation()`, `NativeStackScreenProps`, etc.) app-wide type-safe without threading a generic through every call site — TypeScript's declaration merging fills in the library's otherwise-generic `RootParamList` with this app's concrete route list, project-wide, from one file.

## RN ships a thin core; SwiftUI ships a whole framework

The single biggest mental-model shift coming from SwiftUI. `import SwiftUI` gives you rendering *and* navigation (`NavigationStack`/`NavigationLink`) *and* state (`@State`/`@Observable`) *and* theming (`Color`, `@Environment(\.colorScheme)`) *and* forms/animation — one integrated, opinionated framework from Apple. `import react-native` gives almost none of that: just the JS↔native rendering runtime plus a handful of primitives (`View`, `Text`, `Image`, `ScrollView`, `TextInput`, `Pressable`). Navigation, state management, and theming are explicitly *not* RN's job — they're separate, competing, community-maintained packages chosen per project. This is the actual reason [decisions.md](decisions.md) has so many "library X vs library Y" entries (Zustand vs Redux, React Navigation, Notifee, MMKV): in SwiftUI those decisions mostly don't exist because Apple already made them. In RN, someone has to, every time — this project's own `docs/decisions.md` is that log.

**Where things come from, concretely:** RN core components (`View`, `Pressable`, ...) come from the `react-native` package itself (≈ `import SwiftUI`). Everything else — `@react-navigation/*`, `zustand`, `react-native-mmkv` — is an npm package in `node_modules`, resolved/pinned via `package-lock.json`, the JS-world analog of `Package.resolved`/`Podfile.lock`. Scoped names like `@react-navigation/native` vs `@react-navigation/native-stack` are **separate installable packages** from the same publisher (React Navigation ships each navigator type — native-stack, bottom-tabs, drawer — as its own package; install only what you use). Our own code, reached via the `@/*` alias (`@/screens/HomeScreen`), never touches `node_modules` at all — it's a pure build-time string rewrite to a relative path within `src/`, not a package.

## `Stack.Navigator`/`Stack.Screen` vs `UINavigationController`/`NavigationLink`

`createNativeStackNavigator()` returns `{ Navigator, Screen, Group }` — the same shape every React Navigation navigator type returns, hence always `const Stack = createXNavigator()` then `<Stack.Navigator>`/`<Stack.Screen>`. Mapping:
- **`<Stack.Navigator>`** owns the push/pop stack and header chrome — closest to `UINavigationController` (UIKit) or SwiftUI's `NavigationStack` (iOS 16+).
- **`<Stack.Screen name="Home" component={...} options={...}>`** registers one route: name, component, header/presentation options. Closest to pairing `.navigationDestination(for:)` with its destination view, or each pushed `UIViewController`.
- **"native-stack" is a real distinction, not a naming detail.** React Navigation has two stack implementations: an older pure-JS one (`@react-navigation/stack`, animations reimplemented via Reanimated) and `native-stack` (used here), which wraps the actual platform navigation controller via `react-native-screens` — a genuine `UINavigationController` on iOS, Fragment-based navigation on Android. `decisions.md` picked native-stack specifically because it's real platform navigation, not a JS reimplementation.
- **Triggering navigation:** SwiftUI's `NavigationLink` is declarative — a tappable view that pushes when tapped, part of the tree itself. React Navigation has no mobile-idiomatic equivalent; you call `navigation.navigate('RouteName')` imperatively from any `onPress` — closer to calling `pushViewController(_:animated:)` from a UIKit `@objc` tap handler than to a declarative link.
- **Typed routes** (`RootStackParamList`, see the declaration-merging note above) are a plain TS type — route name → param shape — passed as a generic. Swift analog: an enum with associated values used with `.navigationDestination(for: Route.self)`.

## Linting and typecheck are separate, optional tools — because JS has no type system at the language level

Swift ties type-checking and compiling together: `swiftc` *is* the type checker; you cannot produce a binary with type errors in it. TypeScript doesn't work that way, and the gap matters in practice, not just in theory. JavaScript — what Hermes actually executes — is fully dynamic, no types at the language level. TypeScript adds annotation syntax plus a standalone compiler frontend (`tsc`) that statically checks that annotated code — but Metro (the bundler) uses **Babel**, not `tsc`, to strip TS syntax when building the real app bundle. Babel deletes type annotations *syntactically* — fast, but it never verifies them. That means `npm start`/`npm run ios` will happily build and run an app containing real type errors. `npm run typecheck` (`tsc --noEmit`: check everything, emit nothing) is a deliberate, separate safety gate that has to be run explicitly — not an unavoidable part of the dev loop the way `swiftc` is. Types are fully erased at runtime either way, even on a `tsc`-clean build, unlike Swift where the type system has real runtime presence (`as?`, dynamic casts).

Same "separate, optional tool" shape applies to linting: `tsc` only checks types, never style or footgun patterns (like the `no-unstable-nested-components` rule above) — that's ESLint's job entirely, a fully separate, pluggable, AST-walking tool. SwiftLint is the much closer analogy here than "the Swift compiler" — also separate, also optional, also rule-based. Formatting (Prettier) is a third, distinct concern again, same role as swift-format/SwiftFormat. Four separate concerns in this ecosystem — types, lint, format, tests — where Swift mostly collapses the first into "does it compile."

## Architecture patterns: MVVM/DI/TCA/MVP mapped to React

- **MVVM → custom hooks.** React has no framework-blessed ViewModel class; the pattern shows up as a **custom hook** — a function owning state (`useState`/`useReducer`/a store subscription), computing derived values, exposing action functions, returned as a clean object the component consumes. `useTranscription()` (speced in [native-module-transcription.md](native-module-transcription.md), built in M2) is this app's concrete example — screens call it and never touch the TurboModule directly, same shape as a ViewModel wrapping a repository. Key difference from SwiftUI: no `@Published`/`ObservableObject`/`@StateObject` ceremony — React's re-render-on-state-change is automatic; calling the hook *is* the binding.
- **DI → Context, and mostly just modules.** `createContext`/`Provider`/`useContext` is the built-in mechanism (≈ `@EnvironmentObject`), but the RN/React ecosystem doesn't lean on DI containers the way enterprise iOS sometimes does. The default idiom is cruder and simpler: a JS module *is* a singleton (the module system caches it), so `import { storage } from '@/services/storage'` anywhere gets the same instance — no container, no `resolve()`. Testability's usual DI payoff (swap a fake in) is instead solved by **module mocking** (`__mocks__/react-native-mmkv.ts`) — swap the whole module out from under the import, not inject via initializer.
- **TCA/reducers → Redux, almost exactly** — not a coincidence; TCA was explicitly modeled on Redux's ideas, with Swift's enums-with-associated-values giving Action more rigor than JS can. Same shape: State (a tree) → Action (plain object/discriminated union) → Reducer (pure `(state, action) => newState`) → Effects (historically middleware — redux-thunk/redux-saga; modern Redux Toolkit uses `createAsyncThunk`). React even has this built into core at component scope, no library: `useReducer(reducer, initialState)`. [decisions.md](decisions.md) explicitly considered and rejected this family ("Redux is overkill at this scale") in favor of Zustand — direct method calls (`setLanguage('es-ES')`) instead of `dispatch({ type, payload })` ceremony. The pattern is real and common in the ecosystem (Redux Toolkit is still widely used in larger RN apps); this project just opted out for scale reasons.
- **MVP → container/presentational components** — an older, hooks-superseded React convention: "container" (smart) components held state/logic, "presentational" (dumb) components just took props and rendered. Literally the MVP split under a different name; evolved into "custom hook + component" post-hooks.

**Patterns with no clean native-iOS name:**
- **Render props** — a component taking a *function* as a prop to control what renders, e.g. `<X>{data => <Text>{data}</Text>}</X>`. Already hit this one without the name: React Navigation's `headerRight: () => <HomeHeaderRight />` is a render prop.
- **HOCs (Higher-Order Components)** — a function wrapping a component to inject props (classic Redux's `connect()`). Mostly replaced by hooks now.
- **State colocation** — a real cultural difference, not just a pattern: React nudges toward keeping state as local as possible, lifting it only when siblings need it, rather than one big per-screen ViewModel owning everything. This app's `useCaptureStore` (ephemeral, screen-scoped, "never persisted" per architecture.md) vs `useCardStore`/`useSettingsStore` (global, persisted) is state colocation as an actual design decision.
- **Feature-based vs. layer-based folders** — orthogonal to state-management choice. This app's structure (`screens/`, `state/`, `services/` as top-level siblings) is layer-based, fine at this scale; larger RN apps often go feature-based (`features/capture/{Screen,store,...}`, everything for one feature colocated).

**This app's own architecture in these terms:** the `architecture.md` layer diagram (UI → State → Services → Native boundary) is MVVM plus a service/repository layer — screens are the View, Zustand stores (+ `useTranscription()`) are the ViewModel layer, `services/` is the Model/data-access layer, the Turbo Module is the native-framework boundary a repository would normally wrap.

## CocoaPods writes build settings into the pbxproj — and is telling you it's leaving

Running `pod install` auto-edits `ios/*.xcodeproj/project.pbxproj` and `Info.plist` directly — e.g. it wrote `RCT_REMOVE_LEGACY_ARCH=1` / `USE_HERMES=true` build flags and an `RCTNewArchEnabled` plist key as part of integrating the generated pods. This is normal (every RN iOS project's pbxproj carries CocoaPods-injected settings; they're meant to be committed) — but `pod install` now also prints a live deprecation notice pointing at `yarn ios`/`expo run:ios` instead, which is the RN team's migration-in-progress away from CocoaPods orchestration mentioned in [decisions.md](decisions.md)'s CocoaPods entry — seeing it fire on a plain `pod install` in mid-2026 is a concrete, dated data point for that migration's timeline, not just the announcement blog post.

## Interview bridges (own-experience mapping)
- Shared TS contract + Swift/Kotlin implementations ↔ shared-interface/native-implementation pattern from prior cross-platform work.
- JS-thread jank vs main-thread jank ↔ prior watchdog-termination and main-thread-I/O debugging.
- FlatList memory behavior ↔ prior image-heavy list memory profiling (4GB → 700MB story).
