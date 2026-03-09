import { create } from 'zustand';
import type { SupportedLocale } from '@/i18n/config';
import { changeLocale as changeLocaleI18n } from '@/i18n/init';
import i18n from '@/i18n/config';

interface LocaleState {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  /**
   * Initialize locale from i18n (which was loaded from backend)
   * Call this after initI18n() completes
   */
  initializeLocale: () => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  // Default to 'zh', will be updated by initializeLocale()
  locale: 'zh' as SupportedLocale,
  setLocale: (locale) => {
    // Update zustand store
    set({ locale });
    // Sync to i18n and backend
    changeLocaleI18n(locale).catch(console.error);
  },
  initializeLocale: () => {
    // Sync with i18n's current language (loaded from backend)
    const currentLocale = i18n.language;
    // Validate it's a supported locale
    const supportedLocales: SupportedLocale[] = ['zh', 'en', 'ja'];
    if (supportedLocales.includes(currentLocale as SupportedLocale)) {
      set({ locale: currentLocale as SupportedLocale });
    }
  },
}));
