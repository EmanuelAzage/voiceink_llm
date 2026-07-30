module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['.'],
        extensions: ['.ios.tsx', '.android.tsx', '.tsx', '.ios.ts', '.android.ts', '.ts', '.js', '.json'],
        alias: {
          '@': './src',
          '@modules': './modules',
        },
      },
    ],
    // Must be listed last — react-native-reanimated 4's docs are explicit
    // about plugin ordering, since it rewrites "worklet" functions and needs
    // to see the fully-resolved code other plugins (e.g. module-resolver) produce.
    'react-native-worklets/plugin',
  ],
};
