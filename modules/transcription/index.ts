import { useCallback, useEffect, useState } from 'react';
import { NativeEventEmitter } from 'react-native';
import NativeTranscription from './NativeTranscription';

const transcriptionEvents = new NativeEventEmitter(NativeTranscription);

export type TranscriptionErrorCode =
  | 'permission_denied'
  | 'recognizer_unavailable'
  | 'busy'
  | 'no_speech'
  | 'native_error';

export interface TranscriptionError {
  code: TranscriptionErrorCode;
  message: string;
}

export type PermissionResult = 'granted' | 'denied' | 'restricted';

export type TranscriptionStatus = 'idle' | 'recording' | 'stopping' | 'error';

export interface UseTranscriptionResult {
  status: TranscriptionStatus;
  partialTranscript: string;
  audioLevel: number;
  error: TranscriptionError | null;
  isAvailable: () => Promise<boolean>;
  requestPermissions: () => Promise<PermissionResult>;
  start: (language: string) => Promise<void>;
  stop: () => Promise<string>;
  cancel: () => Promise<void>;
}

/**
 * Friendly wrapper around the TranscriptionProvider Turbo Module — screens
 * consume this hook and never touch NativeTranscription directly.
 */
export function useTranscription(): UseTranscriptionResult {
  const [status, setStatus] = useState<TranscriptionStatus>('idle');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<TranscriptionError | null>(null);

  useEffect(() => {
    const subscriptions = [
      transcriptionEvents.addListener('onPartialTranscript', (event: { text: string }) => {
        setPartialTranscript(event.text);
      }),
      transcriptionEvents.addListener('onAudioLevel', (event: { level: number }) => {
        setAudioLevel(event.level);
      }),
      transcriptionEvents.addListener('onError', (event: TranscriptionError) => {
        setError(event);
        setStatus('error');
      }),
    ];

    return () => {
      subscriptions.forEach(subscription => subscription.remove());
    };
  }, []);

  const isAvailable = useCallback(() => NativeTranscription.isAvailable(), []);

  const requestPermissions = useCallback(
    () => NativeTranscription.requestPermissions() as Promise<PermissionResult>,
    [],
  );

  const start = useCallback(async (language: string) => {
    setError(null);
    setPartialTranscript('');
    setAudioLevel(0);
    setStatus('recording');
    try {
      await NativeTranscription.start(language);
    } catch (caught) {
      setStatus('error');
      setError({ code: 'native_error', message: String(caught) });
      throw caught;
    }
  }, []);

  const stop = useCallback(async () => {
    setStatus('stopping');
    try {
      const finalTranscript = await NativeTranscription.stop();
      setStatus('idle');
      return finalTranscript;
    } catch (caught) {
      setStatus('error');
      setError({ code: 'native_error', message: String(caught) });
      throw caught;
    }
  }, []);

  const cancel = useCallback(async () => {
    await NativeTranscription.cancel();
    setStatus('idle');
    setPartialTranscript('');
    setAudioLevel(0);
  }, []);

  return { status, partialTranscript, audioLevel, error, isAvailable, requestPermissions, start, stop, cancel };
}
