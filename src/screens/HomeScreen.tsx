import { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { trigger as triggerHaptic } from 'react-native-haptic-feedback';
import { Mic, NotebookPen } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { useSettingsStore } from '@/state/settingsStore';
import { useCardStore, type Card } from '@/state/cardStore';
import { AnimatedPressable } from '@/components/AnimatedPressable';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const UNDO_WINDOW_MS = 4000;

function DeleteAction({ color }: { color: string }) {
  const { typography } = useTheme();
  return (
    <View style={[styles.deleteAction, { backgroundColor: color }]}>
      <Text style={[typography.body, styles.deleteActionText]}>Delete</Text>
    </View>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const { colors, spacing, typography, radii } = useTheme();
  const language = useSettingsStore(state => state.language);
  const cards = useCardStore(state => state.cards);
  const addCard = useCardStore(state => state.addCard);
  const deleteCard = useCardStore(state => state.deleteCard);

  const [lastDeleted, setLastDeleted] = useState<Card | null>(null);
  const undoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDelete = (card: Card) => {
    if (undoTimeout.current) clearTimeout(undoTimeout.current);
    triggerHaptic('impactLight');
    deleteCard(card.id);
    setLastDeleted(card);
    undoTimeout.current = setTimeout(() => setLastDeleted(null), UNDO_WINDOW_MS);
  };

  const handleUndo = () => {
    if (undoTimeout.current) clearTimeout(undoTimeout.current);
    if (lastDeleted) addCard(lastDeleted);
    setLastDeleted(null);
  };

  const renderCard = ({ item }: { item: Card }) => (
    <Swipeable renderRightActions={() => <DeleteAction color={colors.danger} />} onSwipeableOpen={() => handleDelete(item)}>
      <AnimatedPressable
        onPress={() => navigation.navigate('Detail', { cardId: item.id })}
        style={[styles.cardRow, { borderColor: colors.border, backgroundColor: colors.background }]}
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
      </AnimatedPressable>
    </Swipeable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {cards.length === 0 ? (
        <View style={styles.emptyState}>
          <NotebookPen size={40} color={colors.textMuted} style={{ marginBottom: spacing.md }} />
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

      {lastDeleted && (
        <View style={[styles.undoBar, { backgroundColor: colors.surface }]}>
          <Text style={[typography.body, { color: colors.text }]}>Card deleted</Text>
          <Pressable onPress={handleUndo}>
            <Text style={[typography.body, styles.bold, { color: colors.primary }]}>Undo</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.footer, { paddingBottom: spacing.xxl }]}>
        <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>
          Recognizing in {language}
        </Text>
        <AnimatedPressable
          accessibilityLabel="Start recording"
          onPress={() => navigation.navigate('Capture')}
          style={[styles.micButton, { backgroundColor: colors.primary }]}
        >
          <Mic size={30} color="#FFFFFF" />
        </AnimatedPressable>
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
  bold: { fontWeight: '600' },
  micButton: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  cardRow: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12, paddingHorizontal: 4 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { paddingHorizontal: 10, paddingVertical: 4 },
  deleteAction: { justifyContent: 'center', alignItems: 'center', width: 88 },
  deleteActionText: { color: '#FFFFFF', fontWeight: '600' },
  undoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
});
