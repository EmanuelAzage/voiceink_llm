package com.emanuelazage.voiceink

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.emanuelazage.voiceink.specs.NativeTranscriptionSpec

// Android's counterpart to iOS's getTurboModule: factory requirement (see
// rn-learning-notes.md) — a local Turbo Module needs both an implementation
// extending the Codegen-generated Spec class AND a ReactPackage that knows how
// to construct it and describes it as a TurboModule via ReactModuleInfo.
class TranscriptionPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == NativeTranscriptionSpec.NAME) TranscriptionModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      NativeTranscriptionSpec.NAME to
        ReactModuleInfo(
          NativeTranscriptionSpec.NAME,
          NativeTranscriptionSpec.NAME,
          false, // canOverrideExistingModule
          false, // needsEagerInit
          false, // isCxxModule
          true, // isTurboModule
        ),
    )
  }
}
