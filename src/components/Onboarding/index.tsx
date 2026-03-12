/**
 * Onboarding Component
 *
 * 新用户首次启动的引导流程组件
 * @module components/Onboarding
 */

import { useOnboardingStore } from '@/stores/onboardingStore';
import { WelcomeStep } from './steps/WelcomeStep';
import { SelectAppStep } from './steps/SelectAppStep';
import { ShowPromptStep } from './steps/ShowPromptStep';
import { InputEndpointStep } from './steps/InputEndpointStep';
import { ConfirmAssistantStep } from './steps/ConfirmAssistantStep';
import type { BoundAssistant } from '@/types/appConfig';
import '@/styles/design-system.css';
import './styles.css';

export interface OnboardingProps {
  onComplete: (assistant: BoundAssistant) => void;
  onSkip?: () => void;
}

export function Onboarding({ onComplete, onSkip }: OnboardingProps) {
  const { currentStep } = useOnboardingStore();

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return <WelcomeStep onSkip={onSkip} />;
      case 'select_app':
        return <SelectAppStep onSkip={onSkip} />;
      case 'show_prompt':
        return <ShowPromptStep onSkip={onSkip} />;
      case 'input_endpoint':
        return <InputEndpointStep onSkip={onSkip} />;
      case 'binding_confirm':
        return <ConfirmAssistantStep onComplete={onComplete} onSkip={onSkip} />;
      case 'complete':
        return null;
      default:
        return <WelcomeStep onSkip={onSkip} />;
    }
  };

  return <div className="onboarding-content">{renderStep()}</div>;
}
