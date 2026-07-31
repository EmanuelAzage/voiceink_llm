module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-.*|@notifee/react-native)/)',
  ],
  setupFiles: ['react-native-gesture-handler/jestSetup'],
  moduleNameMapper: {
    // Local (non-node_modules) manual mocks aren't auto-applied by Jest —
    // unlike __mocks__/react-native-config.ts and __mocks__/react-native-mmkv.ts,
    // which Jest picks up on their own since those packages live in node_modules.
    // Matched against the import specifier as written (post-Babel-alias-resolution,
    // pre-Jest-resolution), which is a relative `./NativeTranscription` from
    // modules/transcription/index.ts — not the resolved absolute path.
    'NativeTranscription$': '<rootDir>/modules/transcription/__mocks__/NativeTranscription.ts',
    // Reanimated's own documented Jest pattern — its mock never touches the
    // real native worklets binding that crashes under Jest. Reanimated 4
    // split worklet internals into a separate react-native-worklets package,
    // whose real native module the same crash comes from transitively —
    // that package ships a mock too (react-native-worklets/src/mock.ts) but
    // has no public "/mock" entry point, so this points straight at its
    // compiled output.
    '^react-native-reanimated$': 'react-native-reanimated/mock',
    '^react-native-worklets$': '<rootDir>/node_modules/react-native-worklets/lib/module/mock.js',
    // lucide-react-native's package.json "exports" map has a "react-native"
    // condition Jest's resolver honors, pointing at its ESM build — but the
    // RN jest preset's babel transform only matches .js/.ts/.tsx, never
    // .mjs, so that file is never transformed and its raw `export` syntax
    // fails to parse. Route straight to the CJS build instead (already
    // real, working CommonJS — no mock needed).
    '^lucide-react-native$': '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
};
