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
  ],
};
