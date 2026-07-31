declare module 'react-native-config' {
  export interface NativeConfig {
    GEMINI_API_KEY?: string;
    GEMINI_MODEL?: string;
    GEMINI_FALLBACK_MODEL?: string;
    SENTRY_DSN?: string;
  }

  export const Config: NativeConfig;
  export default Config;
}
