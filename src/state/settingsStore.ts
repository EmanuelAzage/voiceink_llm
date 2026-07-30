import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandMmkvStorage } from '@/services/storage';

interface SettingsState {
  language: string;
  setLanguage: (language: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      language: 'en-US',
      setLanguage: language => set({ language }),
    }),
    {
      name: 'settings-store',
      storage: createJSONStorage(() => zustandMmkvStorage),
    },
  ),
);
