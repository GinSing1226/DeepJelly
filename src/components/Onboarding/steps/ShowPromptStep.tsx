/**
 * Show Prompt Step
 *
 * 显示集成提示词
 * @module components/Onboarding/steps/ShowPromptStep
 */

import { useState, useEffect } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useLocaleStore } from '@/stores/localeStore';
import { generateIntegrationPrompt } from '@/utils/promptTemplates';
import { useTranslation } from 'react-i18next';

interface ShowPromptStepProps {
  onSkip?: () => void;
}

export function ShowPromptStep({ onSkip }: ShowPromptStepProps) {
  const { t } = useTranslation('onboarding');
  const { locale } = useLocaleStore();
  const { setGeneratedPrompt, setStep } = useOnboardingStore();
  const [copied, setCopied] = useState(false);

  const prompt = useOnboardingStore.getState().generatedPrompt;

  useEffect(() => {
    const selectedAppType = useOnboardingStore.getState().selectedAppType;
    if (selectedAppType) {
      setGeneratedPrompt(generateIntegrationPrompt(selectedAppType, locale));
    }
  }, [setGeneratedPrompt]);

  // 当语言变化时重新生成提示词
  useEffect(() => {
    const selectedAppType = useOnboardingStore.getState().selectedAppType;
    if (selectedAppType) {
      setGeneratedPrompt(generateIntegrationPrompt(selectedAppType, locale));
    }
  }, [locale]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNext = () => {
    setStep('input_endpoint');
  };

  const handleBack = () => {
    setStep('select_app');
  };

  return (
    <div className="show-prompt-step">
      <h2>{t('integrationPromptTitle')}</h2>
      <p>{t('integrationPromptDesc')}</p>

      <div className="prompt-box">
        <pre>{prompt}</pre>
      </div>

      <div className="prompt-actions">
        <button className="btn-primary" onClick={handleCopy}>
          {copied ? t('copied') : t('copyPrompt')}
        </button>
      </div>

      <div className="step-actions">
        <button className="btn-back" onClick={handleBack}>
          {t('backButton')}
        </button>
        <button className="btn-primary" onClick={handleNext}>
          {t('nextStep')}
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
