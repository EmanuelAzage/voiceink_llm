import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandMmkvStorage } from '@/services/storage';
import { cancelActionItemNotification, scheduleActionItemNotification } from '@/services/notifications';

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
  updateCard: (card: Card) => void;
  deleteCard: (id: string) => void;
  deleteAllCards: () => void;
  toggleActionItemDone: (cardId: string, itemId: string) => void;
  rescheduleActionItemNotification: (cardId: string, itemId: string) => void;
}

export const useCardStore = create<CardState>()(
  persist(
    (set, get) => {
      // Schedules one item's notification, then patches its `notificationId`
      // once scheduling resolves — scheduling is async (it may prompt for
      // permission), so this can't happen synchronously inside the caller.
      const scheduleOne = (card: Card, item: ActionItem) => {
        scheduleActionItemNotification(card, item).then(scheduled => {
          if (!scheduled) return;
          set(state => ({
            cards: state.cards.map(c =>
              c.id !== card.id
                ? c
                : { ...c, actionItems: c.actionItems.map(i => (i.id === item.id ? { ...i, notificationId: item.id } : i)) },
            ),
          }));
        });
      };

      // Schedules every dated, not-yet-done action item on `card`.
      const scheduleAndPatch = (card: Card) => {
        card.actionItems.forEach(item => {
          if (item.dueDate && !item.done) scheduleOne(card, item);
        });
      };

      return {
        cards: [],

        addCard: card => {
          set(state => ({ cards: [card, ...state.cards] }));
          scheduleAndPatch(card);
        },

        updateCard: card => {
          const previous = get().cards.find(c => c.id === card.id);
          previous?.actionItems.forEach(item => {
            if (item.notificationId) cancelActionItemNotification(item.notificationId);
          });
          set(state => ({ cards: state.cards.map(c => (c.id === card.id ? card : c)) }));
          scheduleAndPatch(card);
        },

        deleteCard: id => {
          const card = get().cards.find(c => c.id === id);
          card?.actionItems.forEach(item => {
            if (item.notificationId) cancelActionItemNotification(item.notificationId);
          });
          set(state => ({ cards: state.cards.filter(c => c.id !== id) }));
        },

        deleteAllCards: () => {
          get().cards.forEach(card => {
            card.actionItems.forEach(item => {
              if (item.notificationId) cancelActionItemNotification(item.notificationId);
            });
          });
          set({ cards: [] });
        },

        toggleActionItemDone: (cardId, itemId) => {
          const card = get().cards.find(c => c.id === cardId);
          const item = card?.actionItems.find(i => i.id === itemId);
          if (!item) return;

          const nowDone = !item.done;
          if (nowDone && item.notificationId) {
            cancelActionItemNotification(item.notificationId);
          }

          set(state => ({
            cards: state.cards.map(c =>
              c.id !== cardId
                ? c
                : {
                    ...c,
                    actionItems: c.actionItems.map(i =>
                      i.id !== itemId ? i : { ...i, done: nowDone, notificationId: nowDone ? undefined : i.notificationId },
                    ),
                  },
            ),
          }));
        },

        rescheduleActionItemNotification: (cardId, itemId) => {
          const card = get().cards.find(c => c.id === cardId);
          const item = card?.actionItems.find(i => i.id === itemId);
          if (!card || !item || !item.dueDate) return;
          scheduleOne(card, item);
        },
      };
    },
    {
      name: 'card-store',
      storage: createJSONStorage(() => zustandMmkvStorage),
    },
  ),
);
