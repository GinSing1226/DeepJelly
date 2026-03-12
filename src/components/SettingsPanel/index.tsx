/**
 * 设置面板组件
 *
 * 提供应用设置界面，包括角色管理、应用集成、系统设置
 *
 * @module components/SettingsPanel
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useSettingsStore } from '@/stores/settingsStore';
import CharacterManagement from '@/components/CharacterManagement';
import './styles.css';

type SettingsTab = 'character' | 'integration' | 'system';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onStartOnboarding?: () => void;
  /** 初始标签页 */
  initialTab?: SettingsTab;
}

export function SettingsPanel({ isOpen, onClose, onStartOnboarding, initialTab }: SettingsPanelProps) {
  const { t } = useTranslation(['settings', 'common', 'onboarding']);
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || 'character');

  // 当 initialTab 改变时，更新 activeTab
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // 设置状态
  const {
    autoLaunch,
    setAutoLaunch,
    language,
    setLanguage,
  } = useSettingsStore();

  if (!isOpen) return null;

  // 处理语言切换
  const handleLanguageChange = async (lang: 'zh' | 'en' | 'ja') => {
    await setLanguage(lang);
  };

  // 处理标题栏拖拽 - 程序化拖拽窗口
  const handleHeaderMouseDown = useCallback(async (e: React.MouseEvent) => {
    // 只响应左键
    if (e.button !== 0) return;

    // 如果点击的是按钮，不拖拽
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }

    try {
      const window = getCurrentWindow();
      await window.startDragging();
    } catch (error) {
      console.error('[SettingsPanel] Failed to start dragging:', error);
    }
  }, []);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className={`settings-panel ${activeTab === 'character' ? 'character-tab-active' : ''}`} onClick={(e) => e.stopPropagation()}>
        {/* 标题栏 */}
        <div className="settings-header" onMouseDown={handleHeaderMouseDown}>
          <h2>{t('settings:title')}</h2>
          <button className="settings-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="settings-content">
          {/* 左侧导航 */}
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

          {/* 右侧内容 */}
          <div className="settings-body">
            {/* 角色管理 */}
            {activeTab === 'character' && (
              <div className="settings-section settings-section-full">
                <CharacterManagement isWindow={false} />
              </div>
            )}

            {/* 应用集成 */}
            {activeTab === 'integration' && (
              <div className="settings-section">
                <h3>{t('settings:integration.title')}</h3>

                <IntegrationSettings onStartOnboarding={onStartOnboarding} />
              </div>
            )}

            {/* 系统设置 */}
            {activeTab === 'system' && (
              <div className="settings-section">
                <h3>{t('settings:system.title')}</h3>

                {/* 开机自启动 */}
                <div className="settings-item">
                  <label>{t('settings:system.autoLaunch')}</label>
                  <input
                    type="checkbox"
                    checked={autoLaunch}
                    onChange={(e) => setAutoLaunch(e.target.checked)}
                  />
                </div>

                {/* 默认语言 */}
                <div className="settings-item">
                  <label>{t('settings:system.language')}</label>
                  <select
                    value={language}
                    onChange={async (e) => {
                      await handleLanguageChange(e.target.value as 'zh' | 'en' | 'ja');
                      // 刷新界面以应用新语言
                      window.location.reload();
                    }}
                  >
                    <option value="zh">中文</option>
                    <option value="en">English</option>
                    <option value="ja">日本語</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 应用集成设置组件
 * MVP阶段：只显示快速集成按钮
 */
interface IntegrationSettingsProps {
  onStartOnboarding?: () => void;
}

function IntegrationSettings({ onStartOnboarding }: IntegrationSettingsProps) {
  const { t } = useTranslation(['settings', 'common']);
  const { boundApp } = useSettingsStore();

  const handleQuickSetup = () => {
    if (onStartOnboarding) {
      onStartOnboarding();
    }
  };

  return (
    <div className="integration-settings">
      {/* 快速集成说明 */}
      <div className="integration-info">
        <p style={{ color: '#6e6e73', fontSize: '14px', lineHeight: '1.5' }}>
          {t('integration.quickSetupDescription')}
        </p>
      </div>

      {/* 当前绑定状态 */}
      {boundApp && (
        <div className="settings-item">
          <label>{t('integration.currentBinding')}</label>
          <div className="bound-info">
            <span className="status-badge connected">{t('integration.bound')}</span>
            <small style={{ color: '#86868b', marginLeft: '8px' }}>
              {boundApp.appType} - {boundApp.assistantId}
            </small>
          </div>
        </div>
      )}

      {/* 快速集成按钮 */}
      <div className="settings-item">
        <button
          className="btn-quick-setup"
          onClick={handleQuickSetup}
          style={{
            width: '100%',
            padding: '14px 24px',
            background: '#1A1A1A',
            color: '#FAF9F6',
            border: 'none',
            borderRadius: '10px',
            fontSize: '15px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#4A4A4A';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#1A1A1A';
          }}
        >
          {boundApp ? t('integration.reintegrate') : t('onboarding:quickSetup')}
        </button>
      </div>

      {/*
      原有的集成界面已注释 - MVP阶段使用快速集成
      <div className="settings-item">
        <label>{t('settings:integration.status')}</label>
        <span className={`status-badge ${connected ? 'connected' : 'disconnected'}`}>
          {connecting ? t('common:connecting') : (connected ? t('common:connected') : t('common:disconnected'))}
        </span>
      </div>

      <div className="settings-item">
        <label>{t('settings:integration.url')}</label>
        <input
          type="text"
          value={brainUrl}
          onChange={(e) => setBrainUrl(e.target.value)}
          placeholder="ws://127.0.0.1:18790"
        />
      </div>

      <div className="settings-item">
        {connected ? (
          <button className="btn-disconnect" onClick={handleDisconnect} disabled={connecting}>
            {t('settings:integration.disconnect')}
          </button>
        ) : (
          <button className="btn-connect" onClick={handleConnect} disabled={connecting}>
            {connecting ? t('common:connecting') : t('settings:integration.connect')}
          </button>
        )}
      </div>
      */}
    </div>
  );
}

export default SettingsPanel;
