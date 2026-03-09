/**
 * Onboarding Store
 *
 * 管理引导流程的状态
 * @module stores/onboardingStore
 */

import { create } from 'zustand';
import type { OnboardingStep, AIAppType } from '@/types/appConfig';

interface OnboardingState {
  currentStep: OnboardingStep;
  selectedAppType: AIAppType | null;
  endpoint: string;
  generatedPrompt: string;
  isConnecting: boolean;
  error: string | null;

  // Actions
  setStep: (step: OnboardingStep) => void;
  selectAppType: (type: AIAppType) => void;
  setEndpoint: (endpoint: string) => void;
  setGeneratedPrompt: (prompt: string) => void;
  setConnecting: (connecting: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

interface OnboardingStateValues {
  currentStep: OnboardingStep;
  selectedAppType: AIAppType | null;
  endpoint: string;
  generatedPrompt: string;
  error: string | null;
}

const initialState: OnboardingStateValues = {
  currentStep: 'welcome',
  selectedAppType: null,
  endpoint: '',
  generatedPrompt: '',
  error: null,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  isConnecting: false,
  ...initialState,

  setStep: (currentStep) => set({ currentStep }),

  selectAppType: (selectedAppType) => {
    set({ selectedAppType, currentStep: 'show_prompt' });
  },

  setEndpoint: (endpoint) => set({ endpoint }),

  setGeneratedPrompt: (generatedPrompt) => set({ generatedPrompt }),

  setConnecting: (isConnecting) => set({ isConnecting }),

  setError: (error) => set({ error }),

  reset: () => set({ ...initialState, isConnecting: false }),
}));
