import { useColorScheme } from 'react-native';
import { colors } from './colors';
import { spacing, radii } from './spacing';
import { typography } from './typography';

export { colors, spacing, radii, typography };

export function useTheme() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return {
    colors: colors[scheme],
    spacing,
    radii,
    typography,
    scheme,
  };
}
