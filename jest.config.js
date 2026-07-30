module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-.*)/)',
  ],
  moduleNameMapper: {
    // Local (non-node_modules) manual mocks aren't auto-applied by Jest —
    // unlike __mocks__/react-native-config.ts and __mocks__/react-native-mmkv.ts,
    // which Jest picks up on their own since those packages live in node_modules.
    // Matched against the import specifier as written (post-Babel-alias-resolution,
    // pre-Jest-resolution), which is a relative `./NativeTranscription` from
    // modules/transcription/index.ts — not the resolved absolute path.
    'NativeTranscription$': '<rootDir>/modules/transcription/__mocks__/NativeTranscription.ts',
  },
};
