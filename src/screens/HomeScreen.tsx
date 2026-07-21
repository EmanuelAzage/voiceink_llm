import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { useSettingsStore } from '@/state/settingsStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { colors, spacing, typography } = useTheme();
  const language = useSettingsStore(state => state.language);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.emptyState}>
        <Text style={[typography.heading, { color: colors.text }]}>No cards yet</Text>
        <Text style={[typography.body, styles.subtitle, { color: colors.textMuted }]}>
          Hold the mic button and start talking — we'll turn it into a card.
        </Text>
        <Pressable onPress={() => navigation.navigate('Settings')} style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.primary }}>Settings</Text>
        </Pressable>
      </View>
      <View style={[styles.footer, { paddingBottom: spacing.xxl }]}>
        <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>
          Recognizing in {language}
        </Text>
        <Pressable
          accessibilityLabel="Start recording"
          onPress={() => navigation.navigate('Capture')}
          style={[styles.micButton, { backgroundColor: colors.primary }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  subtitle: { textAlign: 'center', marginTop: 8 },
  footer: { alignItems: 'center' },
  micButton: { width: 72, height: 72, borderRadius: 36 },
});
