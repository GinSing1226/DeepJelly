import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { SupportedLocale } from '@/i18n/config';

interface LocaleState {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  /**
   * Initialize locale from backend
   * Call this to load the persisted locale setting
   */
  initializeLocale: () => Promise<void>;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  // Default to 'zh', will be updated by initializeLocale()
  locale: 'zh' as SupportedLocale,
  setLocale: (locale) => {
    // Update store immediately (optimistic UI)
    set({ locale });
    // Persist to backend in background (fire-and-forget)
    invoke('set_locale', { locale }).catch((error) => {
      console.error('[LocaleStore] Failed to persist locale to backend:', error);
      // Note: We keep the optimistic update even if backend fails
      // The next initializeLocale() call will re-sync with backend
    });
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
