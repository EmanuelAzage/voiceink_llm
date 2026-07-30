import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { useSettingsStore } from '@/state/settingsStore';
import { useCardStore, type Card } from '@/state/cardStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { colors, spacing, typography, radii } = useTheme();
  const language = useSettingsStore(state => state.language);
  const cards = useCardStore(state => state.cards);

  const renderCard = ({ item }: { item: Card }) => (
    <Pressable
      onPress={() => navigation.navigate('Detail', { cardId: item.id })}
      style={[styles.cardRow, { borderColor: colors.border }]}
    >
      <Text style={[typography.body, { color: colors.text }]}>{item.title}</Text>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
        {new Date(item.createdAt).toLocaleDateString()}
        {item.actionItems.length > 0
          ? ` · ${item.actionItems.length} action item${item.actionItems.length === 1 ? '' : 's'}`
          : ''}
      </Text>
      {item.tags.length > 0 && (
        <View style={[styles.tagRow, { marginTop: spacing.sm }]}>
          {item.tags.map(tag => (
            <View key={tag} style={[styles.tagChip, { backgroundColor: colors.surface, borderRadius: radii.pill }]}>
              <Text style={[typography.caption, { color: colors.text }]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {cards.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[typography.heading, { color: colors.text }]}>No cards yet</Text>
          <Text style={[typography.body, styles.subtitle, { color: colors.textMuted }]}>
            Hold the mic button and start talking — we'll turn it into a card.
          </Text>
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={item => item.id}
          renderItem={renderCard}
          style={styles.list}
          contentContainerStyle={{ padding: spacing.md }}
        />
      )}
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
  list: { flex: 1 },
  micButton: { width: 72, height: 72, borderRadius: 36 },
  cardRow: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { paddingHorizontal: 10, paddingVertical: 4 },
});
