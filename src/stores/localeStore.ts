import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { SupportedLocale } from '@/i18n/config';

interface LocaleState {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => Promise<void>;
  /**
   * Initialize locale from backend
   * Call this to load the persisted locale setting
   */
  initializeLocale: () => Promise<void>;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  // Default to 'zh', will be updated by initializeLocale()
  locale: 'zh' as SupportedLocale,
  setLocale: async (locale) => {
    // Persist to backend via set_locale command
    await invoke('set_locale', { locale });
    // Update zustand store after backend succeeds
    set({ locale });
  },
  initializeLocale: async () => {
    try {
      // Load persisted locale from backend
      const persistedLocale = await invoke<string>('get_locale');
      // Validate it's a supported locale
      const supportedLocales: SupportedLocale[] = ['zh', 'en', 'ja'];
      if (supportedLocales.includes(persistedLocale as SupportedLocale)) {
        set({ locale: persistedLocale as SupportedLocale });
      }
    } catch (error) {
      console.error('[LocaleStore] Failed to initialize locale from backend:', error);
      // Keep default 'zh' on error
    }
  },
}));
