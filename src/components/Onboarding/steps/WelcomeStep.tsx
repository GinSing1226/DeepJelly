/**
 * Welcome Step
 *
 * 引导流程的欢迎页面
 * @module components/Onboarding/steps/WelcomeStep
 */

import { useOnboardingStore } from '@/stores/onboardingStore';
import { useLocaleStore } from '@/stores/localeStore';
import { useTranslation } from 'react-i18next';
import { LOCALE_NAMES, SUPPORTED_LOCALES } from '@/i18n/config';
import type { SupportedLocale } from '@/i18n/config';
import { changeLocale as changeLocaleI18n } from '@/i18n/init';

interface WelcomeStepProps {
  onSkip?: () => void;
}

export function WelcomeStep({ onSkip }: WelcomeStepProps) {
  const { setStep } = useOnboardingStore();
  const { setLocale: setLocaleStore } = useLocaleStore();
  const { t } = useTranslation('onboarding');

  const handleStart = () => {
    setStep('select_app');
  };

  const handleLanguageChange = async (newLocale: SupportedLocale) => {
    // 立即切换语言
    await changeLocaleI18n(newLocale);
    // 更新 store
    setLocaleStore(newLocale);
  };

  return (
    <div className="welcome-step">
      <h1>{t('title')}</h1>
      <p>{t('subtitle')}</p>

      {/* Language Selection */}
      <div className="language-selector">
        <label>{t('selectLanguage')}</label>
        <div className="language-buttons">
          {SUPPORTED_LOCALES.map((locale) => (
            <button
              key={locale}
              className={`btn-language ${locale === useLocaleStore.getState().locale ? 'active' : ''}`}
              onClick={() => handleLanguageChange(locale)}
            >
              {LOCALE_NAMES[locale]}
            </button>
          ))}
        </div>
      </div>

      <div className="welcome-actions">
        <button className="btn-primary" onClick={handleStart}>
          {t('startButton')}
        </button>
        {onSkip && (
          <button className="btn-secondary" onClick={onSkip}>
            {t('skipButton')}
          </button>
        )}
      </div>
    </div>
  );
}
