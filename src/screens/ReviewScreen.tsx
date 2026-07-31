import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker, { type DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { trigger as triggerHaptic } from 'react-native-haptic-feedback';
import { Sparkles, Trash2, X } from 'lucide-react-native';
import { AnimatedPressable } from '@/components/AnimatedPressable';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { useCaptureStore, type ExtractionErrorReason } from '@/state/captureStore';
import { useCardStore, generateId, type Card } from '@/state/cardStore';
import { toLocalIsoDate } from '@/services/date';

type Props = NativeStackScreenProps<RootStackParamList, 'Review'>;

const MAX_TAGS = 5;

const ERROR_MESSAGES: Record<ExtractionErrorReason, string> = {
  timeout: 'The AI took too long to respond.',
  network: 'Could not reach the AI service.',
  'invalid-response': "The AI's response didn't match the expected format.",
};

interface EditableActionItem {
  id: string;
  text: string;
  dueDate?: string; // ISO-8601 (YYYY-MM-DD)
  done?: boolean;
}

function fromIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function AIBadge({ show, color }: { show: boolean; color: string }) {
  if (!show) return null;
  return <Sparkles size={14} color={color} accessibilityLabel="AI-filled" />;
}

export default function ReviewScreen({ navigation, route }: Props) {
  const { colors, typography, spacing, radii } = useTheme();
  const editingCardId = route.params?.cardId;
  const existingCard = useCardStore(state => (editingCardId ? state.cards.find(c => c.id === editingCardId) : undefined));
  const status = useCaptureStore(state => state.status);
  const rawTranscript = useCaptureStore(state => state.rawTranscript);
  const extractedCard = useCaptureStore(state => state.extractedCard);
  const extractionError = useCaptureStore(state => state.extractionError);
  const resetCapture = useCaptureStore(state => state.reset);
  const addCard = useCardStore(state => state.addCard);
  const updateCard = useCardStore(state => state.updateCard);

  const [title, setTitle] = useState(() => existingCard?.title ?? extractedCard?.title ?? '');
  const [summary, setSummary] = useState(() => existingCard?.summary ?? extractedCard?.summary ?? '');
  const [tags, setTags] = useState<string[]>(() => existingCard?.tags ?? extractedCard?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [actionItems, setActionItems] = useState<EditableActionItem[]>(() => {
    if (existingCard) return existingCard.actionItems.map(({ id, text, dueDate, done }) => ({ id, text, dueDate, done }));
    return extractedCard?.actionItems.map(item => ({ id: generateId(), ...item })) ?? [];
  });
  const [touched, setTouched] = useState(() =>
    existingCard
      ? { title: true, summary: true, tags: true, actionItems: true }
      : { title: false, summary: false, tags: false, actionItems: false },
  );
  const [datePickerFor, setDatePickerFor] = useState<string | null>(null);

  const finishAndGoHome = () => {
    resetCapture();
    navigation.popTo('Home');
  };

  const handleDiscard = () => {
    if (existingCard) {
      navigation.popTo('Detail', { cardId: existingCard.id });
      return;
    }
    finishAndGoHome();
  };

  const handleSave = () => {
    triggerHaptic('impactLight');
    const actionItemsPayload = actionItems
      .filter(item => item.text.trim())
      .map(item => ({ id: item.id, text: item.text.trim(), dueDate: item.dueDate, done: item.done ?? false }));

    if (existingCard) {
      updateCard({
        ...existingCard,
        title: title.trim() || 'Untitled note',
        summary: summary.trim(),
        tags,
        actionItems: actionItemsPayload,
      });
      navigation.popTo('Detail', { cardId: existingCard.id });
      return;
    }

    const card: Card = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      title: title.trim() || 'Untitled note',
      summary: summary.trim(),
      tags,
      actionItems: actionItemsPayload,
      rawTranscript,
      source: 'ai',
    };
    addCard(card);
    finishAndGoHome();
  };

  const handleSaveRaw = () => {
    triggerHaptic('impactLight');
    const card: Card = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      title: rawTranscript.trim().slice(0, 60) || 'Untitled note',
      summary: '',
      tags: [],
      actionItems: [],
      rawTranscript,
      source: 'manual',
    };
    addCard(card);
    finishAndGoHome();
  };

  const addTag = () => {
    const value = tagInput.trim();
    if (!value || tags.includes(value) || tags.length >= MAX_TAGS) return;
    setTags(prev => [...prev, value]);
    setTagInput('');
    setTouched(prev => ({ ...prev, tags: true }));
  };

  const removeTag = (tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
    setTouched(prev => ({ ...prev, tags: true }));
  };

  const addActionItem = () => {
    setActionItems(prev => [...prev, { id: generateId(), text: '' }]);
    setTouched(prev => ({ ...prev, actionItems: true }));
  };

  const updateActionItemText = (id: string, text: string) => {
    setActionItems(prev => prev.map(item => (item.id === id ? { ...item, text } : item)));
    setTouched(prev => ({ ...prev, actionItems: true }));
  };

  const updateActionItemDate = (id: string, date: Date) => {
    setActionItems(prev => prev.map(item => (item.id === id ? { ...item, dueDate: toLocalIsoDate(date) } : item)));
    setTouched(prev => ({ ...prev, actionItems: true }));
  };

  const clearActionItemDate = (id: string) => {
    setActionItems(prev => prev.map(item => (item.id === id ? { ...item, dueDate: undefined } : item)));
    setTouched(prev => ({ ...prev, actionItems: true }));
  };

  const removeActionItem = (id: string) => {
    setActionItems(prev => prev.filter(item => item.id !== id));
    setTouched(prev => ({ ...prev, actionItems: true }));
  };

  const handleDateValueChange = (id: string) => (_event: DateTimePickerChangeEvent, date: Date) => {
    updateActionItemDate(id, date);
    if (Platform.OS === 'android') {
      setDatePickerFor(null);
    }
  };

  const handleDateDismiss = () => {
    if (Platform.OS === 'android') {
      setDatePickerFor(null);
    }
  };

  if (!existingCard && status === 'error') {
    return (
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
        <Text accessibilityRole="header" style={[typography.heading, { color: colors.text }]}>
          Couldn't structure this note
        </Text>
        <Text style={[typography.body, { color: colors.textMuted, marginTop: spacing.sm }]}>
          {extractionError ? ERROR_MESSAGES[extractionError] : 'Something went wrong.'} You can still save the raw
          transcript.
        </Text>
        <Text style={[typography.body, { color: colors.text, marginTop: spacing.lg }]}>{rawTranscript}</Text>
        <View style={[styles.row, { marginTop: spacing.xl }]}>
          <Pressable accessibilityRole="button" onPress={finishAndGoHome}>
            <Text style={{ color: colors.textMuted }}>Discard</Text>
          </Pressable>
          <AnimatedPressable accessibilityRole="button" onPress={handleSaveRaw}>
            <Text style={[typography.body, styles.bold, { color: colors.primary }]}>Save transcript</Text>
          </AnimatedPressable>
        </View>
      </ScrollView>
    );
  }

  if (!existingCard && (status !== 'reviewing' || !extractedCard)) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[typography.body, { color: colors.textMuted }]}>Nothing to review yet.</Text>
        <Pressable accessibilityRole="button" onPress={finishAndGoHome} style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.primary }}>Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.fieldLabelRow}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>Title</Text>
        <AIBadge show={!touched.title} color={colors.primary} />
      </View>
      <TextInput
        value={title}
        onChangeText={text => {
          setTitle(text);
          setTouched(prev => ({ ...prev, title: true }));
        }}
        style={[typography.title, styles.input, { color: colors.text, borderColor: colors.border }]}
      />

      <View style={[styles.fieldLabelRow, { marginTop: spacing.lg }]}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>Summary</Text>
        <AIBadge show={!touched.summary} color={colors.primary} />
      </View>
      <TextInput
        value={summary}
        onChangeText={text => {
          setSummary(text);
          setTouched(prev => ({ ...prev, summary: true }));
        }}
        multiline
        style={[typography.body, styles.input, styles.multiline, { color: colors.text, borderColor: colors.border }]}
      />

      <View style={[styles.fieldLabelRow, { marginTop: spacing.lg }]}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>Tags</Text>
        <AIBadge show={!touched.tags} color={colors.primary} />
      </View>
      <View style={[styles.tagRow, { marginTop: spacing.sm }]}>
        {tags.map(tag => (
          <Pressable
            key={tag}
            accessibilityRole="button"
            accessibilityLabel={`Remove tag ${tag}`}
            onPress={() => removeTag(tag)}
            style={[styles.tagChip, styles.tagChipRow, { backgroundColor: colors.surface, borderRadius: radii.pill }]}
          >
            <Text style={[typography.caption, { color: colors.text }]}>{tag}</Text>
            <X size={12} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
      {tags.length < MAX_TAGS && (
        <View style={[styles.row, { marginTop: spacing.sm }]}>
          <TextInput
            value={tagInput}
            onChangeText={setTagInput}
            onSubmitEditing={addTag}
            placeholder="Add a tag"
            placeholderTextColor={colors.textMuted}
            style={[typography.body, styles.input, styles.tagInput, { color: colors.text, borderColor: colors.border }]}
          />
          <Pressable accessibilityRole="button" onPress={addTag} style={{ marginLeft: spacing.sm }}>
            <Text style={{ color: colors.primary }}>Add</Text>
          </Pressable>
        </View>
      )}

      <View style={[styles.fieldLabelRow, { marginTop: spacing.lg }]}>
        <Text accessibilityRole="header" style={[typography.heading, { color: colors.text }]}>
          Action items
        </Text>
        <AIBadge show={!touched.actionItems} color={colors.primary} />
      </View>
      {actionItems.map(item => (
        <View key={item.id} style={[styles.actionItemRow, { borderColor: colors.border, marginTop: spacing.sm }]}>
          <TextInput
            value={item.text}
            onChangeText={text => updateActionItemText(item.id, text)}
            placeholder="Action item"
            placeholderTextColor={colors.textMuted}
            style={[typography.body, styles.flexInput, { color: colors.text }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.dueDate ? `Due date: ${item.dueDate}` : 'Set date'}
            hitSlop={12}
            onPress={() => setDatePickerFor(item.id)}
          >
            <Text style={[typography.caption, { color: colors.primary }]}>{item.dueDate ?? 'Set date'}</Text>
          </Pressable>
          {item.dueDate && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear date"
              hitSlop={16}
              onPress={() => clearActionItemDate(item.id)}
              style={{ marginLeft: spacing.xs }}
            >
              <X size={14} color={colors.textMuted} />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove action item"
            hitSlop={14}
            onPress={() => removeActionItem(item.id)}
            style={{ marginLeft: spacing.sm }}
          >
            <Trash2 size={16} color={colors.danger} />
          </Pressable>
          {datePickerFor === item.id && (
            <DateTimePicker
              value={item.dueDate ? fromIsoDate(item.dueDate) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onValueChange={handleDateValueChange(item.id)}
              onDismiss={handleDateDismiss}
            />
          )}
        </View>
      ))}
      {Platform.OS === 'ios' && datePickerFor && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setDatePickerFor(null)}
          style={[styles.alignEnd, { marginTop: spacing.sm }]}
        >
          <Text style={{ color: colors.primary }}>Done</Text>
        </Pressable>
      )}
      <Pressable accessibilityRole="button" onPress={addActionItem} style={{ marginTop: spacing.sm }}>
        <Text style={{ color: colors.primary }}>+ Add action item</Text>
      </Pressable>

      <View style={[styles.row, { marginTop: spacing.xl }]}>
        <Pressable accessibilityRole="button" onPress={handleDiscard}>
          <Text style={{ color: colors.textMuted }}>Discard</Text>
        </Pressable>
        <AnimatedPressable accessibilityRole="button" onPress={handleSave}>
          <Text style={[typography.body, styles.bold, { color: colors.primary }]}>Save</Text>
        </AnimatedPressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 6 },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { paddingHorizontal: 12, paddingVertical: 6 },
  tagChipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tagInput: { flex: 1 },
  actionItemRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  bold: { fontWeight: '600' },
  flexInput: { flex: 1 },
  alignEnd: { alignSelf: 'flex-end' },
});
