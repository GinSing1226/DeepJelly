/**
 * Onboarding Window App
 *
 * Standalone onboarding window for quick setup
 */

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { Onboarding } from '@/components/Onboarding';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAppIntegrationStore } from '@/stores/appIntegrationStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useLocaleStore } from '@/stores/localeStore';
import type { BoundAssistant } from '@/types/appConfig';
import { getOpenClawParams } from '@/utils/assistantHelper';
import './OnboardingApp.css';

/**
 * Get URL query parameter by name
 */
function getUrlParam(name: string): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

export function OnboardingApp() {
  const { setBoundApp, loadSettings } = useSettingsStore();
  const { loadIntegrations, getIntegration } = useAppIntegrationStore();
  const { setStep } = useOnboardingStore();
  const { initializeLocale } = useLocaleStore();
  const [isLocaleReady, setIsLocaleReady] = useState(false);

  // Initialize locale and settings from backend on mount
  useEffect(() => {
    const init = async () => {
      try {
        await initializeLocale();
        // Load endpoint config to get the correct LAN IP
        await loadSettings();
      } catch (error) {
        console.error('[OnboardingApp] Failed to initialize:', error);
      } finally {
        setIsLocaleReady(true);
      }
    };

    init();
  }, [initializeLocale, loadSettings]);

  // Check for pending edit integration on mount (for new windows)
  useEffect(() => {
    const initEditMode = async () => {
      // 1. Check URL query parameter first (most reliable for new windows)
      const editIdFromUrl = getUrlParam('edit');

      // 2. Fall back to store for existing windows
      const pendingEditId = editIdFromUrl || useAppIntegrationStore.getState().pendingEditIntegrationId;

      if (pendingEditId) {
        // Clear store state to avoid affecting future runs
        if (useAppIntegrationStore.getState().pendingEditIntegrationId) {
          useAppIntegrationStore.getState().setPendingEditIntegrationId(null);
        }

        // Load integrations to get the integration data
        await loadIntegrations();

        // Get the integration from the store
        const integration = getIntegration(pendingEditId);
        if (integration) {
          // Set the current integration in the store
          useAppIntegrationStore.getState().setCurrentIntegration(integration);
          // Skip to input_endpoint step
          setStep('input_endpoint');
        }
      }
    };

    initEditMode();
  }, []);

  // Listen for edit mode events (for existing/focused windows)
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      try {
        unlisten = await listen<string>('onboarding:edit-mode', async (event) => {
          const editIntegrationId = event.payload;

          // Load integrations to get the integration data
          await loadIntegrations();

          // Get the integration from the store
          const integration = getIntegration(editIntegrationId);
          if (integration) {
            // Set the current integration in the store
            useAppIntegrationStore.getState().setCurrentIntegration(integration);
            // Skip to input_endpoint step
            setStep('input_endpoint');
          }
        });
      } catch (error) {
        console.error('[OnboardingApp] Failed to setup edit mode listener:', error);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const handleComplete = (assistant: BoundAssistant) => {
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
        {!isLocaleReady ? (
          <div className="onboarding-loading">
            <div className="loading-spinner" />
            <p>Loading...</p>
          </div>
        ) : (
          <Onboarding
            onComplete={handleComplete}
            onSkip={handleSkip}
          />
        )}
      </div>
    </div>
  );
}

export default OnboardingApp;
