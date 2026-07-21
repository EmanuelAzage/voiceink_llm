import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { useSettingsStore } from '@/state/settingsStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const SUPPORTED_LANGUAGES = ['en-US', 'es-ES', 'fr-FR'];

export default function SettingsScreen(_props: Props) {
  const { colors, typography, spacing } = useTheme();
  const language = useSettingsStore(state => state.language);
  const setLanguage = useSettingsStore(state => state.setLanguage);

  const cycleLanguage = () => {
    const next = SUPPORTED_LANGUAGES[(SUPPORTED_LANGUAGES.indexOf(language) + 1) % SUPPORTED_LANGUAGES.length];
    setLanguage(next);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, padding: spacing.lg }]}>
      <Text style={[typography.body, { color: colors.text }]}>Recognition language</Text>
      <Text style={[typography.heading, { color: colors.primary, marginTop: spacing.xs }]}>{language}</Text>
      <Pressable onPress={cycleLanguage} style={{ marginTop: spacing.md }}>
        <Text style={{ color: colors.primary }}>Change</Text>
      </Pressable>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xl }]}>
        Persisted via Zustand + MMKV — relaunch the app to confirm it sticks.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
