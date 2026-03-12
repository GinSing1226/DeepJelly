/**
 * Select App Step
 *
 * 选择AI应用类型
 * @module components/Onboarding/steps/SelectAppStep
 */

import { useOnboardingStore } from '@/stores/onboardingStore';
import { useTranslation } from 'react-i18next';
import type { AIAppType } from '@/types/appConfig';

interface SelectAppStepProps {
  onSkip?: () => void;
}

export function SelectAppStep({ onSkip }: SelectAppStepProps) {
  const { selectAppType, setStep } = useOnboardingStore();
  const { t } = useTranslation('onboarding');

  const handleSelect = (type: AIAppType) => {
    selectAppType(type);
  };

  const handleBack = () => {
    setStep('welcome');
  };

  return (
    <div className="select-app-step">
      <div className="step-content-wrapper">
        <h2>{t('selectAppTitle')}</h2>
        <p>{t('selectAppDesc')}</p>

        <div className="app-options">
          <button
            className="app-option"
            onClick={() => handleSelect('openclaw')}
          >
            <span className="app-icon">🤖</span>
            <span className="app-name">{t('openclawName')}</span>
            <span className="app-desc">{t('openclawDesc')}</span>
          </button>
        </div>
      </div>

      <div className="step-actions">
        <button className="btn-back" onClick={handleBack}>
          {t('backButton')}
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
