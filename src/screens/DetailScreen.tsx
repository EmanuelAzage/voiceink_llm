import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CheckSquare, Square } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { useCardStore, type ActionItem } from '@/state/cardStore';
import { isFutureDueDate } from '@/services/notifications';

type Props = NativeStackScreenProps<RootStackParamList, 'Detail'>;

export default function DetailScreen({ route, navigation }: Props) {
  const { colors, typography, spacing, radii } = useTheme();
  const card = useCardStore(state => state.cards.find(c => c.id === route.params.cardId));
  const toggleActionItemDone = useCardStore(state => state.toggleActionItemDone);
  const rescheduleActionItemNotification = useCardStore(state => state.rescheduleActionItemNotification);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);

  if (!card) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[typography.body, { color: colors.textMuted }]}>This card was deleted.</Text>
      </View>
    );
  }

  const handleToggleActionItem = (item: ActionItem) => {
    const wasDone = item.done;
    toggleActionItemDone(card.id, item.id);

    if (wasDone && item.dueDate && isFutureDueDate(item.dueDate)) {
      Alert.alert('Set a reminder?', `We can notify you on ${item.dueDate} for "${item.text}".`, [
        { text: 'Not now', style: 'cancel' },
        { text: 'Remind me', onPress: () => rescheduleActionItemNotification(card.id, item.id) },
      ]);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[typography.title, { color: colors.text }]}>{card.title}</Text>
      <Text style={[typography.caption, { color: colors.textMuted, marginTop: spacing.xs }]}>
        {new Date(card.createdAt).toLocaleDateString()}
      </Text>

      {card.summary.length > 0 && (
        <Text style={[typography.body, { color: colors.text, marginTop: spacing.md }]}>{card.summary}</Text>
      )}

      {card.tags.length > 0 && (
        <View style={[styles.tagRow, { marginTop: spacing.md }]}>
          {card.tags.map(tag => (
            <View key={tag} style={[styles.tagChip, { backgroundColor: colors.surface, borderRadius: radii.pill }]}>
              <Text style={[typography.caption, { color: colors.text }]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {card.actionItems.length > 0 && (
        <View style={{ marginTop: spacing.lg }}>
          <Text style={[typography.heading, { color: colors.text }]}>Action items</Text>
          {card.actionItems.map(item => (
            <Pressable
              key={item.id}
              onPress={() => handleToggleActionItem(item)}
              style={[styles.actionItemRow, { borderColor: colors.border, marginTop: spacing.sm }]}
            >
              <View style={styles.checkbox}>
                {item.done ? (
                  <CheckSquare size={20} color={colors.primary} />
                ) : (
                  <Square size={20} color={colors.primary} />
                )}
              </View>
              <View style={styles.flexOne}>
                <Text
                  style={[
                    typography.body,
                    item.done && styles.strikethrough,
                    { color: item.done ? colors.textMuted : colors.text },
                  ]}
                >
                  {item.text}
                </Text>
                {item.dueDate && (
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {item.dueDate}
                    {item.notificationId ? ' · Reminder set' : ''}
                  </Text>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <Pressable onPress={() => setTranscriptExpanded(prev => !prev)} style={{ marginTop: spacing.xl }}>
        <Text style={[typography.caption, { color: colors.primary }]}>
          {transcriptExpanded ? 'Hide' : 'Show'} raw transcript
        </Text>
      </Pressable>
      {transcriptExpanded && (
        <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>{card.rawTranscript}</Text>
      )}

      <Pressable onPress={() => navigation.navigate('Review', { cardId: card.id })} style={{ marginTop: spacing.xl }}>
        <Text style={[typography.body, styles.bold, { color: colors.primary }]}>Edit</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  strikethrough: { textDecorationLine: 'line-through' },
  flexOne: { flex: 1 },
  bold: { fontWeight: '600' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { paddingHorizontal: 10, paddingVertical: 4 },
  actionItemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  checkbox: { marginTop: 2 },
});
