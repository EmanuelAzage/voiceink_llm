# VoiceInk Update Log

## 2026-07-21

* **Update**: Expanded [RN learning notes](rn-learning-notes.md) with worked explanations of the New Architecture (Bridge vs JSI/TurboModules/Fabric/Codegen), Hermes vs JSC (why startup improves), and the CocoaPods→SPM migration trajectory — each mapped to native-dev analogies.

* **Initialization**: Created the knowledge base — [product spec](product-spec.md), [architecture](architecture.md), [Turbo Module spec](native-module-transcription.md), [build plan](build-plan.md) (M1-M6), [decision log](decisions.md), and [learning notes](rn-learning-notes.md). Frontmatter conformed to the Open Knowledge Format v0.1 spec.
* **Decision**: Project scoped as a two-day build; the hand-written Turbo Module (Swift/Kotlin speech recognition behind a shared TS contract) designated the architectural centerpiece; RN CLI with New Architecture; Zustand + MMKV + React Navigation + Notifee; cloud LLM extraction with schema-constrained tool use. See [decisions](decisions.md).
