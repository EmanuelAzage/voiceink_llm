// react-native-haptic-feedback ships an official mock at src/__mocks__/
// inside the package, but that file itself imports the real, unmocked
// TurboModule transitively (via ../utils/playHaptic -> ../hapticFeedback),
// so it still throws under Jest — it's meant for the package's own test
// suite, not for consumers. Only `trigger` is used in this app.
export const trigger = jest.fn();
