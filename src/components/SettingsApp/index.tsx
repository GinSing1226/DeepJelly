/**
 * Settings Window App
 *
 * Standalone settings window component
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { useSettingsStore } from '@/stores/settingsStore';
import { useCharacterManagementStore } from '@/stores/characterManagementStore';
import { useIntegrationStore } from '@/stores/integrationStore';
import CharacterManagement from '@/components/CharacterManagement';
import { DisplaySettings } from './DisplaySettings';
import { AppIntegrationModal } from './IntegrationManagement/AppIntegrationModal';
import { AppIntegrationCard } from './IntegrationManagement/AppIntegrationCard';
import { CharacterIntegrationModal } from './IntegrationManagement/CharacterIntegration/CharacterIntegrationModal';
import { CharacterIntegrationCard } from './IntegrationManagement/CharacterIntegrationCard';
import { ConfirmDialog } from './IntegrationManagement/ConfirmDialog';
import { HelpSettings } from './HelpSettings';
import type { AppIntegration } from '@/types/character';
import type { CreateAppIntegrationDTO, UpdateAppIntegrationDTO } from '@/stores/integrationStore';
import type { CreateCharacterIntegrationDTO, UpdateCharacterIntegrationDTO, CharacterIntegration } from '@/stores/integrationStore';
import './styles.css';
import './IntegrationManagement/integration.css';
import './IntegrationManagement/ConfirmDialog.css';
import './DisplaySettings/display.css';

type SettingsTab = 'character' | 'app_integration' | 'character_integration' | 'display' | 'help' | 'system';

// App Integration Settings Component
function AppIntegrationSettings() {
  const { t } = useTranslation(['settings', 'common', 'onboarding']);

  const {
    appIntegrations,
    characterIntegrations,
    loadAppIntegrations,
    loadCharacterIntegrations,
    addAppIntegration,
    updateAppIntegration,
    deleteAppIntegration,
  } = useIntegrationStore();

  const { assistants, loadAssistants } = useCharacterManagementStore();

  // Modal states
  const [showAppModal, setShowAppModal] = useState(false);
  const [editingAppIntegration, setEditingAppIntegration] = useState<AppIntegration | undefined>();

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    item: AppIntegration | null;
  }>({ show: false, item: null });

  // Load data on mount
  useEffect(() => {
    loadAppIntegrations();
    loadCharacterIntegrations();
    loadAssistants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh data when window regains focus
  useEffect(() => {
    let unlistenFocus: (() => void) | null = null;
    let unlistenCustom: (() => void) | null = null;

    const setupListeners = async () => {
      try {
        unlistenFocus = await listen('tauri://focus', () => {
          loadAppIntegrations();
          loadCharacterIntegrations();
          loadAssistants();
        });

        unlistenCustom = await listen('onboarding:complete', () => {
          loadAppIntegrations();
          loadCharacterIntegrations();
          loadAssistants();
        });
      } catch (error) {
        console.error('[AppIntegrationSettings] Failed to setup listeners:', error);
      }
    };

    setupListeners();

    return () => {
      if (unlistenFocus) unlistenFocus();
      if (unlistenCustom) unlistenCustom();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open onboarding for quick setup
  const handleQuickSetup = async () => {
    try {
      await invoke('open_onboarding_window');
    } catch (error) {
      console.error('[AppIntegrationSettings] Failed to open onboarding window:', error);
    }
  };

  // Handle edit
  const handleEdit = (integration: AppIntegration) => {
    setEditingAppIntegration(integration);
    setShowAppModal(true);
  };

  // Handle save
  const handleSave = async (data: CreateAppIntegrationDTO | UpdateAppIntegrationDTO) => {
    if (editingAppIntegration) {
      // 编辑模式：更新现有集成
      await updateAppIntegration(editingAppIntegration.id, data as UpdateAppIntegrationDTO);
    } else {
      // 新增模式：创建新集成
      await addAppIntegration(data as CreateAppIntegrationDTO);
    }
    handleCloseModal();
  };

  // Handle delete click
  const handleDeleteClick = (integration: AppIntegration) => {
    setDeleteConfirm({ show: true, item: integration });
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    const { item } = deleteConfirm;
    if (!item) return;

    try {
      await deleteAppIntegration(item.id);
    } catch (error) {
      console.error('[AppIntegrationSettings] Delete failed:', error);
      alert(String(error));
    }

    setDeleteConfirm({ show: false, item: null });
  };

  // Handle toggle enabled
  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    try {
      await updateAppIntegration(id, { enabled });
    } catch (error) {
      console.error('[AppIntegrationSettings] Toggle failed:', error);
      alert(String(error));
    }
  };

  // Close modal
  const handleCloseModal = () => {
    setShowAppModal(false);
    setEditingAppIntegration(undefined);
  };

  // Get assistants bound to an app integration
  const getBoundAssistantsForApp = useCallback((appIntegration: AppIntegration) => {
    return assistants.filter(assistant =>
      assistant.integrations?.some(integration =>
        integration.params.applicationId === appIntegration.applicationId
      )
    );
  }, [assistants]);

  // Get character integrations bound to an app integration
  const getBoundCharacterIntegrationsForApp = useCallback((appIntegration: AppIntegration) => {
    return characterIntegrations.filter(
      (ci) => ci.integration.integrationId === appIntegration.id
    );
  }, [characterIntegrations]);

  return (
    <div className="integration-settings">
      {/* App Integrations Section */}
      <div className="integration-section">
        <div className="integration-section-header">
          <h3 className="section-title">
            <span className="icon">🔌</span>
            {t('settings:integration.title')}
          </h3>
          <div className="integration-actions">
            <button className="btn-quick-setup" onClick={handleQuickSetup}>
              <span>⚡</span>
              {t('onboarding:quickSetup')}
            </button>
            <button className="btn-add-integration" onClick={() => setShowAppModal(true)}>
              <span>+</span>
              {t('settings:integration.addIntegration')}
            </button>
          </div>
        </div>

        {appIntegrations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔌</div>
            <h4 className="empty-state-title">{t('settings:integration.noIntegrations')}</h4>
            <p className="empty-state-description">
              {t('onboarding:quickSetupDescription')}
            </p>
            <button className="dj-btn dj-btn-primary" onClick={handleQuickSetup}>
              {t('onboarding:startQuickSetup')}
            </button>
          </div>
        ) : (
          <div>
            {appIntegrations.map((integration) => (
              <AppIntegrationCard
                key={integration.id}
                integration={integration}
                assistants={assistants}
                characterIntegrations={characterIntegrations}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onToggleEnabled={handleToggleEnabled}
              />
            ))}
          </div>
        )}
      </div>

      {/* App Integration Modal */}
      {showAppModal && (
        <AppIntegrationModal
          isOpen={showAppModal}
          integration={editingAppIntegration}
          onClose={handleCloseModal}
          onSave={handleSave}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.show}
        title={t('settings:integration.confirmDeleteIntegration')}
        message={t('settings:integration.confirmDeleteIntegrationMessage', {
          name: deleteConfirm.item?.name || '',
        })}
        warning={
          (() => {
            if (!deleteConfirm.item) return undefined;
            const boundAssistants = getBoundAssistantsForApp(deleteConfirm.item);
            const boundCharIntegrations = getBoundCharacterIntegrationsForApp(deleteConfirm.item);
            const totalBindings = boundAssistants.length + boundCharIntegrations.length;
            if (totalBindings > 0) {
              return t('settings:integration.deleteHasBindingsWarning', { count: totalBindings });
            }
            return undefined;
          })()
        }
        confirmText={t('common:delete')}
        cancelText={t('common:cancel')}
        isDanger={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm({ show: false, item: null })}
      />
    </div>
  );
}

// Character Integration Settings Component
function CharacterIntegrationSettings() {
  const { t } = useTranslation(['settings', 'common', 'onboarding']);

  const {
    appIntegrations,
    characterIntegrations,
    loadAppIntegrations,
    loadCharacterIntegrations,
    addCharacterIntegration,
    updateCharacterIntegration,
    deleteCharacterIntegration,
  } = useIntegrationStore();

  const { assistants, loadAssistants } = useCharacterManagementStore();

  // Modal states
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [editingCharacterIntegration, setEditingCharacterIntegration] = useState<CharacterIntegration | undefined>();

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    item: CharacterIntegration | null;
  }>({ show: false, item: null });

  // Load data on mount
  useEffect(() => {
    loadAppIntegrations();
    loadCharacterIntegrations();
    loadAssistants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh data when window regains focus
  useEffect(() => {
    let unlistenFocus: (() => void) | null = null;
    let unlistenCustom: (() => void) | null = null;

    const setupListeners = async () => {
      try {
        unlistenFocus = await listen('tauri://focus', () => {
          loadAppIntegrations();
          loadCharacterIntegrations();
          loadAssistants();
        });

        unlistenCustom = await listen('onboarding:complete', () => {
          loadAppIntegrations();
          loadCharacterIntegrations();
          loadAssistants();
        });
      } catch (error) {
        console.error('[CharacterIntegrationSettings] Failed to setup listeners:', error);
      }
    };

    setupListeners();

    return () => {
      if (unlistenFocus) unlistenFocus();
      if (unlistenCustom) unlistenCustom();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle edit
  const handleEdit = (integration: CharacterIntegration) => {
    setEditingCharacterIntegration(integration);
    setShowCharacterModal(true);
  };

  // Handle save
  const handleSave = async (data: CreateCharacterIntegrationDTO | UpdateCharacterIntegrationDTO) => {
    if (editingCharacterIntegration) {
      // 编辑模式：更新现有绑定
      await updateCharacterIntegration(editingCharacterIntegration.id, data as UpdateCharacterIntegrationDTO);
    } else {
      // 新增模式：创建新绑定
      await addCharacterIntegration(data as CreateCharacterIntegrationDTO);
    }
    handleCloseModal();
  };

  // Handle delete click
  const handleDeleteClick = (integration: CharacterIntegration) => {
    setDeleteConfirm({ show: true, item: integration });
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    const { item } = deleteConfirm;
    if (!item) return;

    try {
      await deleteCharacterIntegration(item.id);
    } catch (error) {
      console.error('[CharacterIntegrationSettings] Delete failed:', error);
      alert(String(error));
    }

    setDeleteConfirm({ show: false, item: null });
  };

  // Handle toggle enabled
  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    try {
      await updateCharacterIntegration(id, { enabled });
    } catch (error) {
      console.error('[CharacterIntegrationSettings] Toggle failed:', error);
      alert(String(error));
    }
  };

  // Close modal
  const handleCloseModal = () => {
    setShowCharacterModal(false);
    setEditingCharacterIntegration(undefined);
  };

  return (
    <div className="integration-settings">
      {/* Character Integrations Section */}
      <div className="integration-section">
        <div className="integration-section-header">
          <h3 className="section-title">
            <span className="icon">🎭</span>
            {t('settings:integration.characterIntegration')}
            <span className="section-count">{characterIntegrations.length}</span>
          </h3>
          <div className="integration-actions">
            <button className="btn-add-integration" onClick={() => setShowCharacterModal(true)}>
              <span>+</span>
              {t('settings:integration.addBinding')}
            </button>
          </div>
        </div>

        {characterIntegrations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔗</div>
            <h4 className="empty-state-title">{t('settings:integration.noBindings')}</h4>
            <p className="empty-state-description">
              {t('settings:integration.noBindingsDescription')}
            </p>
          </div>
        ) : (
          <div>
            {characterIntegrations.map((integration) => (
              <CharacterIntegrationCard
                key={integration.id}
                integration={integration}
                appIntegrations={appIntegrations}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onToggleEnabled={handleToggleEnabled}
              />
            ))}
          </div>
        )}
      </div>

      {/* Character Integration Modal */}
      {showCharacterModal && (
        <CharacterIntegrationModal
          key={editingCharacterIntegration?.id || 'new'}
          isOpen={showCharacterModal}
          integration={editingCharacterIntegration}
          assistants={assistants}
          appIntegrations={appIntegrations}
          existingIntegrations={characterIntegrations}
          onClose={handleCloseModal}
          onSave={handleSave}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.show}
        title={t('settings:integration.confirmDeleteBinding')}
        message={t('settings:integration.confirmDeleteBindingMessage', {
          name: `${deleteConfirm.item?.assistantName} / ${deleteConfirm.item?.characterName}`,
        })}
        confirmText={t('common:delete')}
        cancelText={t('common:cancel')}
        isDanger={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm({ show: false, item: null })}
      />
    </div>
  );
}

export function SettingsApp() {
  const { t } = useTranslation(['settings', 'common', 'onboarding']);
  const [activeTab, setActiveTab] = useState<SettingsTab>('character');

  // Listen for tab switch events from backend
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      try {
        unlisten = await listen('settings:open-tab', (event) => {
          const tab = event.payload as string;
          if (tab === 'display') {
            setActiveTab('display');
          }
        });
      } catch (error) {
        console.error('[SettingsApp] Failed to setup tab listener:', error);
      }
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

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

  // Handle close - use getCurrentWindow for direct window control
  const handleClose = async () => {
    try {
      const window = getCurrentWindow();
      await window.close();
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
            className={`nav-item ${activeTab === 'app_integration' ? 'active' : ''}`}
            onClick={() => setActiveTab('app_integration')}
          >
            🔌 {t('settings:tabs.appIntegration')}
          </button>
          <button
            className={`nav-item ${activeTab === 'character_integration' ? 'active' : ''}`}
            onClick={() => setActiveTab('character_integration')}
          >
            🎭 {t('settings:tabs.characterIntegration')}
          </button>
          <button
            className={`nav-item ${activeTab === 'display' ? 'active' : ''}`}
            onClick={() => setActiveTab('display')}
          >
            🪟 {t('settings:tabs.display')}
          </button>
          <button
            className={`nav-item ${activeTab === 'system' ? 'active' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            ⚙️ {t('settings:tabs.system')}
          </button>
          <button
            className={`nav-item ${activeTab === 'help' ? 'active' : ''}`}
            onClick={() => setActiveTab('help')}
          >
            ❓ {t('settings:tabs.help')}
          </button>
        </div>

        {/* Right Content */}
        <div className="settings-body">
          {activeTab === 'character' && (
            <div className="settings-section settings-section-full">
              <CharacterManagement isWindow={true} />
            </div>
          )}

          {activeTab === 'app_integration' && (
            <div className="settings-section">
              <AppIntegrationSettings />
            </div>
          )}

          {activeTab === 'character_integration' && (
            <div className="settings-section">
              <CharacterIntegrationSettings />
            </div>
          )}

          {activeTab === 'display' && (
            <div className="settings-section settings-section-full">
              <DisplaySettings />
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

          {activeTab === 'help' && (
            <div className="settings-section">
              <HelpSettings />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsApp;
