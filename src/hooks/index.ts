/**
 * Hooks Barrel Export
 *
 * Meta-Name: Hooks Module Index
 * Meta-Description: Centralized exports for all custom React hooks in the application.
 */

export { useGlobalHotkeys } from './useGlobalHotkeys';
export type { UseGlobalHotkeysOptions, UseGlobalHotkeysReturn } from './useGlobalHotkeys';

export { useTrayEventHandler } from './useTrayEventHandler';
export type { TrayEventPayload, UseTrayEventHandlerOptions } from './useTrayEventHandler';

export { useTauriEvent } from './useTauriEvent';

export { useCAPMessage } from './useCAPMessage';
export type { CAPMessageHandlers, UseCAPMessageOptions } from './useCAPMessage';

export { useTheme } from './useTheme';
export type { Theme, UseThemeReturn } from './useTheme';
