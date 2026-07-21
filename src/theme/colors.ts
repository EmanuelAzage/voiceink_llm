export const colors = {
  light: {
    background: '#FFFFFF',
    surface: '#F5F5F7',
    text: '#111114',
    textMuted: '#6B6B70',
    primary: '#4F46E5',
    border: '#E4E4E7',
    danger: '#DC2626',
  },
  dark: {
    background: '#111114',
    surface: '#1C1C1F',
    text: '#F5F5F7',
    textMuted: '#9A9AA1',
    primary: '#818CF8',
    border: '#2C2C31',
    danger: '#F87171',
  },
} as const;

export type ColorScheme = keyof typeof colors;
export type ThemeColors = (typeof colors)[ColorScheme];
