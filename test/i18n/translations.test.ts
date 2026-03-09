/**
 * i18n Translation Completeness Test
 *
 * Tests that all translation keys used in the code exist in resources
 */

import { resources } from '@/i18n/resources';

describe('i18n Translation Completeness', () => {
  const locales: Array<keyof typeof resources> = ['zh', 'en', 'ja'];
  const namespaces = ['common', 'tray', 'settings', 'debug', 'confirm', 'status', 'error', 'about', 'dialog'];

  describe('should have all required keys in each namespace', () => {
    locales.forEach((locale) => {
      const localeResources = resources[locale];

      namespaces.forEach((ns) => {
        describe(`${locale} - ${ns} namespace`, () => {
          it('should exist', () => {
            expect(localeResources[ns]).toBeDefined();
            expect(typeof localeResources[ns]).toBe('object');
          });

          // Common required keys for tray namespace
          if (ns === 'tray') {
            const requiredTrayKeys = [
              'noCharacters',
              'openDialog',
              'settings',
              'switchCharacter',
              'enterDnd',
              'hideCharacter',
              'showCharacter',
              'centerCharacter',
              'language',
            ];

            requiredTrayKeys.forEach((key) => {
              it(`should have key "${key}"`, () => {
                expect(localeResources.tray[key]).toBeDefined();
                expect(typeof localeResources.tray[key]).toBe('string');
                expect(localeResources.tray[key].length).toBeGreaterThan(0);
              });
            });
          }

          // Common required keys for confirm namespace
          if (ns === 'confirm') {
            const requiredConfirmKeys = ['quit_title', 'quit_message', 'cancel', 'confirm'];

            requiredConfirmKeys.forEach((key) => {
              it(`should have key "${key}"`, () => {
                expect(localeResources.confirm[key]).toBeDefined();
                expect(typeof localeResources.confirm[key]).toBe('string');
              });
            });
          }

          // Common required keys for dialog namespace
          if (ns === 'dialog') {
            const requiredDialogKeys = [
              'sessionList',
              'conversation',
              'newConversation',
              'searchPlaceholder',
              'noSessions',
              'startConversation',
              'startTyping',
              'minimize',
            ];

            requiredDialogKeys.forEach((key) => {
              it(`should have key "${key}"`, () => {
                expect(localeResources.dialog[key]).toBeDefined();
                expect(typeof localeResources.dialog[key]).toBe('string');
              });
            });
          }
        });
      });
    });
  });

  describe('should have consistent keys across all locales', () => {
    namespaces.forEach((ns) => {
      it(`namespace "${ns}" should have same keys in all locales`, () => {
        const zhKeys = Object.keys(resources.zh[ns]);
        const enKeys = Object.keys(resources.en[ns]);
        const jaKeys = Object.keys(resources.ja[ns]);

        // All locales should have the same number of keys
        expect(zhKeys.length).toBe(enKeys.length);
        expect(zhKeys.length).toBe(jaKeys.length);

        // All locales should have the same key names
        zhKeys.forEach((key) => {
          expect(enKeys).toContain(key);
          expect(jaKeys).toContain(key);
        });
      });
    });
  });
});
