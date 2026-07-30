import { create } from 'zustand';
import type { ExtractedCard } from '@/services/cardSchema';
import type { ExtractionResult } from '@/services/extraction';

export type CaptureStatus = 'idle' | 'structuring' | 'reviewing' | 'error';
export type ExtractionErrorReason = Extract<ExtractionResult, { status: 'error' }>['reason'];

interface CaptureState {
  status: CaptureStatus;
  rawTranscript: string;
  extractedCard: ExtractedCard | null;
  extractionError: ExtractionErrorReason | null;
  beginStructuring: (rawTranscript: string) => void;
  setExtracted: (card: ExtractedCard) => void;
  setExtractionFailed: (reason: ExtractionErrorReason) => void;
  reset: () => void;
}

const initialState = {
  status: 'idle' as CaptureStatus,
  rawTranscript: '',
  extractedCard: null,
  extractionError: null,
};

/**
 * Ephemeral post-recording session state (structuring → reviewing/error).
 * Never persisted — a fresh capture always starts from `reset()`. Recording
 * itself is owned by `useTranscription()`; this store picks up once a final
 * transcript exists.
 */
export const useCaptureStore = create<CaptureState>()(set => ({
  ...initialState,
  beginStructuring: rawTranscript =>
    set({ status: 'structuring', rawTranscript, extractedCard: null, extractionError: null }),
  setExtracted: card => set({ status: 'reviewing', extractedCard: card }),
  setExtractionFailed: reason => set({ status: 'error', extractionError: reason }),
  reset: () => set(initialState),
}));
