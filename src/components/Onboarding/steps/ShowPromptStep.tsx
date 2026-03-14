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
      // 注意：此步骤已废弃，show_prompt 已从流程中移除
      // 使用占位值避免编译错误
      setGeneratedPrompt(generateIntegrationPrompt(
        selectedAppType,
        '待填写', // deepjellyHost
        '12260',  // deepjellyPort
        '待填写', // deepjellyToken
        locale
      ));
    }
  }, [setGeneratedPrompt]);

  // 当语言变化时重新生成提示词
  useEffect(() => {
    const selectedAppType = useOnboardingStore.getState().selectedAppType;
    if (selectedAppType) {
      // 注意：此步骤已废弃，show_prompt 已从流程中移除
      setGeneratedPrompt(generateIntegrationPrompt(
        selectedAppType,
        '待填写', // deepjellyHost
        '12260',  // deepjellyPort
        '待填写', // deepjellyToken
        locale
      ));
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
      <div className="step-content-wrapper">
        <h2>{t('integrationPromptTitle')}</h2>
        <p>{t('integrationPromptDesc')}</p>

        {/* 复制按钮紧跟在描述文字后面 */}
        <div className="prompt-actions">
          <button className="btn-primary" onClick={handleCopy}>
            {copied ? t('copied') : t('copyPrompt')}
          </button>
        </div>

        <div className="prompt-box">
          <pre>{prompt}</pre>
        </div>
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
