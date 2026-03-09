/**
 * Onboarding Window App
 *
 * Standalone onboarding window for quick setup
 */

import { useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { Onboarding } from '@/components/Onboarding';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAppIntegrationStore } from '@/stores/appIntegrationStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import type { BoundAssistant } from '@/types/appConfig';
import { getOpenClawParams } from '@/utils/assistantHelper';
import './OnboardingApp.css';

export function OnboardingApp() {
  const { setBoundApp } = useSettingsStore();
  const { loadIntegrations, getIntegration } = useAppIntegrationStore();
  const { setStep } = useOnboardingStore();

  // Check localStorage on mount for pending edit integration
  useEffect(() => {
    const initEditMode = async () => {
      // Check if there's a pending edit integration ID
      const editIntegrationId = localStorage.getItem('onboarding:edit-integration-id');
      if (editIntegrationId) {
        console.log('[OnboardingApp] 📝 Found pending edit integration ID in localStorage:', editIntegrationId);

        // Clear it immediately to avoid affecting future runs
        localStorage.removeItem('onboarding:edit-integration-id');

        // Load integrations to get the integration data
        await loadIntegrations();

        // Get the integration from the store
        const integration = getIntegration(editIntegrationId);
        if (integration) {
          console.log('[OnboardingApp] ✅ Found integration, setting currentIntegration and skipping to input_endpoint');
          // Set the current integration in the store
          useAppIntegrationStore.getState().setCurrentIntegration(integration);
          // Skip to input_endpoint step
          setStep('input_endpoint');
        } else {
          console.error('[OnboardingApp] ❌ Integration not found:', editIntegrationId);
        }
      }
    };

    initEditMode();
  }, [loadIntegrations, getIntegration, setStep]);

  const handleComplete = (assistant: BoundAssistant) => {
    console.log('[OnboardingApp] Onboarding completed:', assistant);

    // 从 integrations 中提取 OpenClaw 参数
    const openclawParams = getOpenClawParams(assistant.integrations);

    if (!openclawParams) {
      console.error('[OnboardingApp] No OpenClaw integration found in assistant');
      return;
    }

    const boundAppToSave = {
      applicationId: openclawParams.applicationId,
      appType: 'openclaw' as const,
      endpoint: 'ws://127.0.0.1:18790',
      assistantId: assistant.id,
      assistantName: assistant.name,
      agentId: openclawParams.agentId,
      sessionKey: openclawParams.sessionKeys?.[0],  // ✅ 修复：sessionKeys 是数组
    };
    setBoundApp(boundAppToSave);

    // Close the onboarding window
    invoke('close_onboarding_window').catch(console.error);
  };

  const handleSkip = () => {
    console.log('[OnboardingApp] Onboarding skipped');
    // Close the onboarding window
    invoke('close_onboarding_window').catch(console.error);
  };

  // Handle header drag - programmatic drag for window
  const handleHeaderMouseDown = useCallback(async (e: React.MouseEvent) => {
    // Only respond to left mouse button
    if (e.button !== 0) return;

    // Don't drag if clicking on buttons
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }

    try {
      const window = getCurrentWindow();
      await window.startDragging();
    } catch (error) {
      console.error('[OnboardingApp] Failed to start dragging:', error);
    }
  }, []);

  // Handle minimize
  const handleMinimize = useCallback(async () => {
    const window = getCurrentWindow();
    await window.minimize();
  }, []);

  // Handle close
  const handleClose = useCallback(async () => {
    await invoke('close_onboarding_window');
  }, []);

  return (
    <div className="onboarding-window">
      {/* Window Header */}
      <div className="onboarding-header" onMouseDown={handleHeaderMouseDown}>
        <div className="onboarding-title">
          <span className="onboarding-icon">🔗</span>
          <span>集成引导</span>
        </div>
        <div className="onboarding-header-actions">
          <button
            className="onboarding-header-btn"
            onClick={handleMinimize}
            title="最小化"
          >
            −
          </button>
          <button
            className="onboarding-header-btn onboarding-close-btn"
            onClick={handleClose}
            title="关闭"
          >
            ×
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="onboarding-body">
        <Onboarding
          onComplete={handleComplete}
          onSkip={handleSkip}
        />
      </div>
    </div>
  );
}

export default OnboardingApp;
