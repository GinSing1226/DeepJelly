/**
 * Settings Window App
 *
 * Standalone settings window component
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen, emit } from '@tauri-apps/api/event';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAppIntegrationStore } from '@/stores/appIntegrationStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useCharacterManagementStore } from '@/stores/characterManagementStore';
import CharacterManagement from '@/components/CharacterManagement';
import type { AppIntegration } from '@/types/appConfig';
import './styles.css';

type SettingsTab = 'character' | 'integration' | 'system';

// Integration Settings Component
function IntegrationSettings() {
  const { t } = useTranslation(['settings', 'common']);
  const { integrations, loadIntegrations } = useAppIntegrationStore();
  const { assistants, loadAssistants } = useCharacterManagementStore();

  // Load data on mount
  useEffect(() => {
    loadIntegrations();
    loadAssistants();
  }, []);

  // Refresh data when window regains focus (e.g., after returning from onboarding)
  useEffect(() => {
    let unlistenFocus: (() => void) | null = null;
    let unlistenCustom: (() => void) | null = null;

    const setupListeners = async () => {
      try {
        // Listen for window focus events - fires when window regains focus
        unlistenFocus = await listen('tauri://focus', () => {
          console.log('[IntegrationSettings] Window focused, refreshing data...');
          loadIntegrations();
          loadAssistants();
        });

        // Also listen for custom event emitted when onboarding completes
        unlistenCustom = await listen('onboarding:complete', () => {
          console.log('[IntegrationSettings] Onboarding complete event, refreshing data...');
          loadIntegrations();
          loadAssistants();
        });
      } catch (error) {
        console.error('[IntegrationSettings] Failed to setup listeners:', error);
      }
    };

    setupListeners();

    return () => {
      // Cleanup listeners on unmount
      if (unlistenFocus) {
        unlistenFocus();
      }
      if (unlistenCustom) {
        unlistenCustom();
      }
    };
  }, [loadIntegrations, loadAssistants]);

  // Get assistants that use this app integration
  const getAssistantsForApp = (appIntegration: AppIntegration) => {
    return assistants.filter(assistant =>
      assistant.integrations?.some(integration =>
        integration.params.applicationId === appIntegration.applicationId
      )
    );
  };

  const handleQuickSetup = async () => {
    console.log('[IntegrationSettings] 🔧 Quick setup clicked');
    // Open onboarding window
    try {
      await invoke('open_onboarding_window');
    } catch (error) {
      console.error('[IntegrationSettings] Failed to open onboarding window:', error);
    }
  };

  const handleEdit = async (integration: AppIntegration) => {
    console.log('[IntegrationSettings] ✏️ Edit clicked for integration:', integration.applicationId);
    // Store the integration ID in localStorage for the onboarding window to pick up
    // localStorage is shared across Tauri windows
    try {
      localStorage.setItem('onboarding:edit-integration-id', integration.id);
      console.log('[IntegrationSettings] ✅ Stored integration ID in localStorage:', integration.id);
      // Open onboarding window
      await invoke('open_onboarding_window');
    } catch (error) {
      console.error('[IntegrationSettings] Failed to open onboarding window:', error);
    }
  };

  return (
    <div className="integration-settings">
      {/* Quick setup info */}
      <div className="integration-info">
        <p style={{ color: '#6e6e73', fontSize: '14px', lineHeight: '1.5' }}>
          {t('settings:integration.title')}
        </p>
      </div>

      {/* App Integration Cards */}
      <div className="integration-cards" style={{ marginTop: '20px' }}>
        {integrations.length === 0 ? (
          <div className="no-integrations" style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#86868b',
            background: '#f5f5f7',
            borderRadius: '12px',
          }}>
            <p>{t('settings:integration.noIntegrations')}</p>
          </div>
        ) : (
          <>
            {integrations.map((integration) => {
              const linkedAssistants = getAssistantsForApp(integration);
              return (
                <div key={integration.id} className="integration-card" style={{
                  background: '#ffffff',
                  border: '1px solid #e5e5e7',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '12px',
                }}>
                  {/* Card Header: App Name & Status */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                  }}>
                    <h4 style={{
                      margin: 0,
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#1d1d1f',
                    }}>
                      {integration.name}
                    </h4>
                    <span className="status-badge connected" style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: '#e8f5e9',
                      color: '#1b5e20',
                    }}>
                      {integration.enabled !== false ? t('settings:integration.enabled') : t('settings:integration.disabled')}
                    </span>
                  </div>

                  {/* Card Details */}
                  <div className="integration-details" style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: '8px 16px',
                    fontSize: '13px',
                    color: '#6e6e73',
                    marginBottom: '12px',
                  }}>
                    <div style={{ fontWeight: '500' }}>{t('settings:integration.appType')}:</div>
                    <div>{integration.provider || 'N/A'}</div>

                    <div style={{ fontWeight: '500' }}>{t('settings:integration.appId')}:</div>
                    <div style={{
                      fontFamily: 'monospace',
                      background: '#f5f5f7',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      wordBreak: 'break-all',
                    }}>
                      {integration.applicationId}
                    </div>

                    <div style={{ fontWeight: '500' }}>{t('settings:integration.endpoint')}:</div>
                    <div style={{
                      fontFamily: 'monospace',
                      fontSize: '12px',
                    }}>
                      {integration.endpoint}
                    </div>

                    {integration.authToken && (
                      <>
                        <div style={{ fontWeight: '500' }}>{t('settings:integration.token')}:</div>
                        <div style={{
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {integration.authToken.slice(0, 20)}...
                        </div>
                      </>
                    )}

                    <div style={{ fontWeight: '500' }}>{t('settings:integration.boundAssistants')}:</div>
                    <div>
                      {linkedAssistants.length > 0 ? (
                        linkedAssistants.map(assistant => (
                          <span key={assistant.id} style={{
                            display: 'inline-block',
                            marginRight: '8px',
                            marginBottom: '4px',
                            padding: '2px 8px',
                            background: '#e3f2fd',
                            borderRadius: '4px',
                            fontSize: '12px',
                            color: '#1565c0',
                          }}>
                            {assistant.name}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: '#86868b', fontStyle: 'italic' }}>
                          {t('settings:integration.none')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    paddingTop: '12px',
                    borderTop: '1px solid #e5e5e7',
                  }}>
                    <button
                      onClick={() => handleEdit(integration)}
                      style={{
                        flex: 1,
                        padding: '8px 16px',
                        background: '#0071e3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#0077ed';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#0071e3';
                      }}
                    >
                      {t('settings:integration.edit')}
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

export function SettingsApp() {
  const { t } = useTranslation(['settings', 'common']);
  const [activeTab, setActiveTab] = useState<SettingsTab>('character');

  // 设置状态
  const {
    autoLaunch,
    setAutoLaunch,
    language,
    setLanguage,
  } = useSettingsStore();

  // Handle header drag
  const handleHeaderMouseDown = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }
    try {
      const window = getCurrentWindow();
      await window.startDragging();
    } catch (error) {
      console.error('[SettingsApp] Failed to start dragging:', error);
    }
    e.preventDefault();
  };

  // Handle close
  const handleClose = async () => {
    try {
      await invoke('close_settings_window');
    } catch (error) {
      console.error('[SettingsApp] Failed to close settings window:', error);
    }
  };

  return (
    <div className="settings-window">
      <div className="settings-header" onMouseDown={handleHeaderMouseDown}>
        <h2>DeepJelly - Settings</h2>
        <button className="settings-close" onClick={handleClose}>
          ✕
        </button>
      </div>

      <div className="settings-content">
        {/* Left Navigation */}
        <div className="settings-nav">
          <button
            className={`nav-item ${activeTab === 'character' ? 'active' : ''}`}
            onClick={() => setActiveTab('character')}
          >
            🎭 {t('settings:tabs.character')}
          </button>
          <button
            className={`nav-item ${activeTab === 'integration' ? 'active' : ''}`}
            onClick={() => setActiveTab('integration')}
          >
            🔌 {t('settings:tabs.integration')}
          </button>
          <button
            className={`nav-item ${activeTab === 'system' ? 'active' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            ⚙️ {t('settings:tabs.system')}
          </button>
        </div>

        {/* Right Content */}
        <div className="settings-body">
          {activeTab === 'character' && (
            <div className="settings-section settings-section-full">
              <CharacterManagement isWindow={true} />
            </div>
          )}

          {activeTab === 'integration' && (
            <div className="settings-section">
              <h3>{t('settings:integration.title')}</h3>
              <IntegrationSettings />
            </div>
          )}

          {activeTab === 'system' && (
            <div className="settings-section">
              <h3>{t('settings:system.title')}</h3>

              {/* Auto Launch */}
              <div className="settings-item">
                <label>{t('settings:system.autoLaunch')}</label>
                <input
                  type="checkbox"
                  checked={autoLaunch}
                  onChange={(e) => setAutoLaunch(e.target.checked)}
                />
              </div>

              {/* Language */}
              <div className="settings-item">
                <label>{t('settings:system.language')}</label>
                <select
                  value={language}
                  onChange={async (e) => {
                    await setLanguage(e.target.value as 'zh' | 'en' | 'ja');
                    // 刷新窗口以应用新语言
                    window.location.reload();
                  }}
                >
                  <option value="zh">{t('common:localeNameZh')}</option>
                  <option value="en">{t('common:localeNameEn')}</option>
                  <option value="ja">{t('common:localeNameJa')}</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsApp;
