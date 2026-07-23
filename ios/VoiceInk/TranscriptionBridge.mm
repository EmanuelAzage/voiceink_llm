#import <ReactCodegen/VoiceInkSpecs/VoiceInkSpecs.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <ReactCommon/RCTTurboModule.h>

// Forward-declare the Swift class's shape (superclass only) rather than importing
// the whole VoiceInk-Swift.h umbrella header — that header covers every @objc Swift
// declaration in the target (including AppDelegate's), which would drag in a pile of
// unrelated framework imports this file doesn't need. Objective-C class interfaces
// just need to be consistent across translation units; the real implementation is
// the compiled Swift class either way.
@interface Transcription : RCTEventEmitter
@end

// Transcription.swift implements every method NativeTranscriptionSpec requires
// (matching selectors), but can't declare conformance to it directly in Swift: the
// protocol lives in VoiceInkSpecs.h, which is gated behind `#ifndef __cplusplus
// #error ...`, so it's only importable from Objective-C++. Objective-C doesn't
// require the implementation and the conformance declaration to live in the same
// file, so this category adds the conformance Swift couldn't declare.
@interface Transcription (NativeTranscriptionSpecConformance) <NativeTranscriptionSpec>
@end

@implementation Transcription (NativeTranscriptionSpecConformance)
@end

RCT_EXTERN void RCTRegisterModule(Class);

@interface Transcription (RCTModuleRegistration) <RCTBridgeModule>
@end

@implementation Transcription (RCTModuleRegistration)

+ (NSString *)moduleName
{
  return @"Transcription";
}

+ (void)load
{
  RCTRegisterModule(self);
}

@end

// The missing piece: RCTTurboModuleManager only turns a resolved RCTBridgeModule
// instance into an actual TurboModule if it responds to getTurboModule: (see
// -[RCTTurboModuleManager _createAndSetUpObjCModule:...] in RCTTurboModuleManager.mm
// — if that check fails, it returns nullptr unconditionally, no fallback). Conforming
// to NativeTranscriptionSpec and being discoverable by name isn't sufficient on its
// own; this is what actually wires the instance into the JSI-backed TurboModule via
// the Codegen-generated NativeTranscriptionSpecJSI bridge class.
@interface Transcription (RCTTurboModuleFactory) <RCTTurboModule>
@end

@implementation Transcription (RCTTurboModuleFactory)

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeTranscriptionSpecJSI>(params);
}

@end
