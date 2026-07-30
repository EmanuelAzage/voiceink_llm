import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandMmkvStorage } from '@/services/storage';

export interface ActionItem {
  id: string;
  text: string;
  dueDate?: string;
  done: boolean;
  notificationId?: string;
}

export interface Card {
  id: string;
  createdAt: string;
  title: string;
  summary: string;
  tags: string[];
  actionItems: ActionItem[];
  rawTranscript: string;
  source: 'ai' | 'manual';
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface CardState {
  cards: Card[];
  addCard: (card: Card) => void;
}

export const useCardStore = create<CardState>()(
  persist(
    set => ({
      cards: [],
      addCard: card => set(state => ({ cards: [card, ...state.cards] })),
    }),
    {
      name: 'card-store',
      storage: createJSONStorage(() => zustandMmkvStorage),
    },
  ),
);
