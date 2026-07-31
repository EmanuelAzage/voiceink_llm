import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { trigger as triggerHaptic } from 'react-native-haptic-feedback';
import { Mic } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import { useTheme } from '@/theme';
import { useSettingsStore } from '@/state/settingsStore';
import { useCaptureStore } from '@/state/captureStore';
import { extractCard } from '@/services/extraction';
import { useTranscription } from '@modules/transcription';

type Props = NativeStackScreenProps<RootStackParamList, 'Capture'>;

export default function CaptureScreen({ navigation }: Props) {
  const { colors, spacing, typography } = useTheme();
  const language = useSettingsStore(state => state.language);
  const { status, partialTranscript, audioLevel, error, start, stop, requestPermissions } = useTranscription();
  const captureStatus = useCaptureStore(state => state.status);
  const beginStructuring = useCaptureStore(state => state.beginStructuring);
  const setExtracted = useCaptureStore(state => state.setExtracted);
  const setExtractionFailed = useCaptureStore(state => state.setExtractionFailed);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const levelShared = useSharedValue(0);
  useEffect(() => {
    levelShared.value = withTiming(status === 'recording' ? audioLevel : 0, { duration: 120 });
  }, [audioLevel, status, levelShared]);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: levelShared.value * 0.5,
    transform: [{ scale: 1 + levelShared.value * 0.5 }],
  }));

  const handlePressIn = async () => {
    setPermissionDenied(false);
    const permission = await requestPermissions();
    if (permission !== 'granted') {
      setPermissionDenied(true);
      return;
    }
    triggerHaptic('impactLight');
    await start(language);
  };

  const handlePressOut = async () => {
    if (status !== 'recording') {
      return;
    }
    triggerHaptic('impactLight');
    const transcript = await stop();
    if (!transcript.trim()) {
      return;
    }

    beginStructuring(transcript);
    const result = await extractCard(transcript);
    if (result.status === 'success') {
      setExtracted(result.card);
    } else {
      setExtractionFailed(result.reason);
    }
    navigation.navigate('Review');
  };

  if (permissionDenied || error?.code === 'permission_denied') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[typography.heading, { color: colors.text }]}>Microphone access needed</Text>
        <Text style={[typography.body, styles.subtitle, { color: colors.textMuted, marginTop: spacing.sm }]}>
          VoiceInk needs microphone and speech recognition access to record notes. Enable it in Settings to
          continue.
        </Text>
        <Pressable onPress={() => Linking.openSettings()} style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.primary }}>Open Settings</Text>
        </Pressable>
      </View>
    );
  }

  if (captureStatus === 'structuring') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[typography.body, styles.subtitle, { color: colors.textMuted, marginTop: spacing.md }]}>
          Structuring…
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[typography.body, styles.subtitle, { color: colors.textMuted }]}>
        {status === 'recording' ? partialTranscript || 'Listening…' : 'Hold the mic and start talking'}
      </Text>
      <View style={[styles.micWrapper, { marginTop: spacing.xl }]}>
        <Animated.View
          pointerEvents="none"
          style={[styles.micGlow, { backgroundColor: colors.danger }, glowStyle]}
        />
        <Pressable
          accessibilityLabel="Hold to record"
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[styles.micButton, { backgroundColor: status === 'recording' ? colors.danger : colors.primary }]}
        >
          <Mic size={36} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  subtitle: { textAlign: 'center' },
  micWrapper: { alignItems: 'center', justifyContent: 'center' },
  micButton: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  micGlow: { position: 'absolute', width: 96, height: 96, borderRadius: 48 },
});
