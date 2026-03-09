/**
 * i18n Module Exports
 *
 * Meta-Name: i18n Module Exports
 * Meta-Description: Main entry point for i18n module, exporting configuration and resources
 */

export { default } from './config';
export type { SupportedLocale } from './config';
export { SUPPORTED_LOCALES, LOCALE_NAMES } from './config';
export { resources } from './resources';
export type {
  TranslationResources,
  CommonTranslationKeys,
  TrayTranslationKeys,
  ErrorsTranslationKeys
} from './resources';
export { initI18n, changeLocale, getCurrentLocale, isLocaleSupported } from './init';
