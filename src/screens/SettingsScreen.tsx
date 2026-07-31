import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { useSettingsStore } from '@/state/settingsStore';
import { useCardStore } from '@/state/cardStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const SUPPORTED_LANGUAGES = ['en-US', 'es-ES', 'fr-FR'];

export default function SettingsScreen(_props: Props) {
  const { colors, typography, spacing } = useTheme();
  const language = useSettingsStore(state => state.language);
  const setLanguage = useSettingsStore(state => state.setLanguage);
  const cardCount = useCardStore(state => state.cards.length);
  const deleteAllCards = useCardStore(state => state.deleteAllCards);

  const cycleLanguage = () => {
    const next = SUPPORTED_LANGUAGES[(SUPPORTED_LANGUAGES.indexOf(language) + 1) % SUPPORTED_LANGUAGES.length];
    setLanguage(next);
  };

  const confirmDeleteAll = () => {
    Alert.alert(
      'Delete all data?',
      `This permanently deletes all ${cardCount} saved card${cardCount === 1 ? '' : 's'} and cancels their reminders. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete all', style: 'destructive', onPress: deleteAllCards },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, padding: spacing.lg }]}>
      <Text accessibilityRole="header" style={[typography.body, { color: colors.text }]}>
        Recognition language
      </Text>
      <Text style={[typography.heading, { color: colors.primary, marginTop: spacing.xs }]}>{language}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Change recognition language, currently ${language}`}
        onPress={cycleLanguage}
        style={{ marginTop: spacing.md }}
      >
        <Text style={{ color: colors.primary }}>Change</Text>
      </Pressable>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xl }]}>
        Persisted via Zustand + MMKV — relaunch the app to confirm it sticks.
      </Text>

      <View style={[styles.dangerZone, { borderTopColor: colors.border, marginTop: spacing.xl, paddingTop: spacing.xl }]}>
        <Text style={[typography.body, { color: colors.text }]}>
          {cardCount} card{cardCount === 1 ? '' : 's'} saved
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={confirmDeleteAll}
          disabled={cardCount === 0}
          style={[{ marginTop: spacing.md }, cardCount === 0 && styles.disabled]}
        >
          <Text style={{ color: colors.danger }}>Delete all data</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dangerZone: { borderTopWidth: StyleSheet.hairlineWidth },
  disabled: { opacity: 0.4 },
});
