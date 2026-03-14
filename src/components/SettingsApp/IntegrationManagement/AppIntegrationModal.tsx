/**
 * App Integration Modal
 *
 * Meta-Name: App Integration Modal
 * Meta-Description: MAC-style modal for adding/editing app integrations
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppIntegration, ProviderType } from '@/types/character';
import type { CreateAppIntegrationDTO, UpdateAppIntegrationDTO } from '@/stores/integrationStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { generateIntegrationPrompt } from '@/utils/promptTemplates';
import './styles.css';

export interface AppIntegrationModalProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 编辑模式：传递要编辑的数据 */
  integration?: AppIntegration;
  /** 关闭回调 */
  onClose: () => void;
  /** 保存回调 */
  onSave: (data: CreateAppIntegrationDTO | UpdateAppIntegrationDTO) => Promise<void>;
}

const PROVIDER_OPTIONS: { value: ProviderType; label: string }[] = [
  { value: 'openclaw', label: 'OpenClaw' },
  { value: 'claude', label: 'Claude' },
  { value: 'chatgpt', label: 'ChatGPT' },
];

// Generate a 32-char DeepJelly Token
function generateDeepjellyToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function AppIntegrationModal({
  isOpen,
  integration,
  onClose,
  onSave,
}: AppIntegrationModalProps) {
  const { t } = useTranslation(['settings', 'common', 'onboarding']);
  const { endpointConfig } = useSettingsStore();
  const isEditMode = !!integration;

  // 表单状态
  const [provider, setProvider] = useState<ProviderType>('openclaw');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<'success' | 'error' | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);

  // DeepJelly Token - 新增模式时生成，编辑模式时使用现有值
  const [deepjellyToken, setDeepjellyToken] = useState(() => generateDeepjellyToken());

  // Generate integration prompt
  const integrationPrompt = useMemo(() => {
    if (!endpointConfig?.host || !endpointConfig?.port || !deepjellyToken) return '';
    // 获取当前语言
    const locale = (localStorage.getItem('i18nextLng') as 'zh' | 'en' | 'ja') || 'zh';
    return generateIntegrationPrompt(
      provider,
      endpointConfig.host,
      endpointConfig.port.toString(),
      deepjellyToken,
      locale
    );
  }, [provider, endpointConfig?.host, endpointConfig?.port, deepjellyToken]);

  // 初始化表单数据
  useEffect(() => {
    if (integration) {
      setProvider(integration.provider as ProviderType);
      setName(integration.name);
      setDescription(integration.description || '');
      setEndpoint(integration.endpoint);
      setAuthToken(integration.authToken || '');
      setEnabled(integration.enabled ?? true);
      // 编辑模式：使用现有的 deepjellyToken，如果没有则生成新的
      setDeepjellyToken(integration.deepjellyToken || generateDeepjellyToken());
    } else {
      // 重置为默认值
      setProvider('openclaw');
      setName('');
      setDescription('');
      setEndpoint('');
      setAuthToken('');
      setEnabled(true);
      // 新增模式：重新生成新的 deepjellyToken
      setDeepjellyToken(generateDeepjellyToken());
    }
    setConnectionResult(null);
    setCopiedToken(false);
    setCopiedPrompt(false);
    setPromptExpanded(false);
  }, [integration, isOpen]);

  // 验证表单
  const isFormValid = name.trim() && endpoint.trim();

  // Copy deepjelly token to clipboard
  const handleCopyToken = async () => {
    try {
      await navigator.clipboard.writeText(deepjellyToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } catch (error) {
      console.error('[AppIntegrationModal] Copy token failed:', error);
    }
  };

  // Copy prompt to clipboard
  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(integrationPrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch (error) {
      console.error('[AppIntegrationModal] Copy prompt failed:', error);
    }
  };

  // 保存处理
  const handleSave = async () => {
    if (!isFormValid) return;

    setLoading(true);
    try {
      const data = isEditMode
        ? ({
            ...(name !== integration?.name && { name }),
            ...(description !== integration?.description && { description }),
            ...(endpoint !== integration?.endpoint && { endpoint }),
            ...(authToken !== integration?.authToken && { authToken: authToken || undefined }),
          } as UpdateAppIntegrationDTO)
        : ({
            provider,
            name: name.trim(),
            description: description.trim() || undefined,
            endpoint: endpoint.trim(),
            authToken: authToken.trim() || undefined,
            deepjellyToken: deepjellyToken, // 新增时保存 deepjellyToken
            enabled,
          } as CreateAppIntegrationDTO);

      await onSave(data);
      onClose();
    } catch (error) {
      console.error('[AppIntegrationModal] Save failed:', error);
      alert(String(error));
    } finally {
      setLoading(false);
    }
  };

  // 测试连接
  const handleTestConnection = async () => {
    if (!endpoint.trim()) return;

    setTestingConnection(true);
    setConnectionResult(null);

    try {
      // 这里应该调用实际的测试连接接口
      // 暂时模拟测试
      await new Promise(resolve => setTimeout(resolve, 1000));
      setConnectionResult('success');
    } catch (error) {
      console.error('[AppIntegrationModal] Connection test failed:', error);
      setConnectionResult('error');
    } finally {
      setTestingConnection(false);
    }
  };

  if (!isOpen) return null;

  const hasPrompt = integrationPrompt.length > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="app-integration-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header - MAC Style */}
        <div className="modal-header-mac">
          <div className="modal-title">
            {isEditMode ? t('integration.edit') : t('integration.addIntegration')}
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body - MAC Style */}
        <div className="modal-body-mac">
          {/* Integration Prompt Section - 始终显示 */}
          <div className="form-group-mac prompt-section-collapsible">
            <div
              className="prompt-header-mac"
              onClick={() => setPromptExpanded(!promptExpanded)}
            >
              <label className="form-label-mac">{t('onboarding:integrationPromptTitle')}</label>
              <button
                type="button"
                className="btn-expand-mac"
                onClick={(e) => {
                  e.stopPropagation();
                  setPromptExpanded(!promptExpanded);
                }}
              >
                {promptExpanded ? '▼' : '▶'}
              </button>
            </div>
            {promptExpanded && (
              <div className="prompt-box-mac">
                {hasPrompt ? (
                  <pre className="prompt-content-mac">{integrationPrompt}</pre>
                ) : (
                  <div className="prompt-placeholder-mac">
                    请先填写应用类型和地址后，将生成集成提示词
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Provider Type */}
          <div className="form-group-mac">
            <label className="form-label-mac">
              {t('integration.appType')}
              <span className="form-required">*</span>
            </label>
            <select
              className="form-select-mac"
              value={provider}
              onChange={(e) => setProvider(e.target.value as ProviderType)}
              disabled={isEditMode}
            >
              {PROVIDER_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div className="form-group-mac">
            <label className="form-label-mac">
              {t('integration.appName')}
              <span className="form-required">*</span>
            </label>
            <input
              type="text"
              className="form-input-mac"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('integration.appName')}
            />
          </div>

          {/* Description */}
          <div className="form-group-mac">
            <label className="form-label-mac">
              {t('integration.description')}
              <span className="form-optional">可选</span>
            </label>
            <textarea
              className="form-textarea-mac"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('integration.description')}
              rows={2}
            />
          </div>

          {/* Endpoint */}
          <div className="form-group-mac">
            <label className="form-label-mac">
              {t('integration.endpoint')}
              <span className="form-required">*</span>
            </label>
            <input
              type="text"
              className="form-input-mac"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="ws://192.168.10.128:18790"
            />
          </div>

          {/* Auth Token */}
          <div className="form-group-mac">
            <label className="form-label-mac">
              {t('integration.authToken')}
              <span className="form-optional">可选</span>
            </label>
            <input
              type="password"
              className="form-input-mac"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="sk-xxxx... (可选)"
            />
          </div>

          {/* DeepJelly Token - 始终显示 */}
          <div className="form-group-mac">
            <label className="form-label-mac">
              {t('integration.deepjellyToken', 'DeepJelly API Token')}
            </label>
            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}>
              <input
                type="text"
                className="form-input-mac"
                value={deepjellyToken}
                readOnly
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  background: '#f5f5f7',
                  color: '#6e6e73',
                  cursor: 'not-allowed',
                  flex: 1,
                }}
              />
              <button
                type="button"
                onClick={handleCopyToken}
                style={{
                  padding: '8px 12px',
                  background: copiedToken ? '#1a1a1a' : '#007aff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                title={copiedToken ? t('common:copied', '已复制') : t('common:copy', '复制')}
              >
                {copiedToken ? '✓' : '📋'}
              </button>
            </div>
            <small style={{ color: '#86868b', fontSize: '11px' }}>
              {isEditMode
                ? t('integration.deepjellyTokenReadOnly', 'Token 不可更改，这是 AI 应用调用 DeepJelly API 的密钥')
                : t('integration.deepjellyTokenHint', '这是 AI 应用调用 DeepJelly API 的密钥，请妥善保管')}
            </small>
          </div>

          {/* Connection Test */}
          <div className="form-group-mac">
            <div className="connection-test-mac">
              <button
                type="button"
                className="btn-test-connection-mac"
                onClick={handleTestConnection}
                disabled={!endpoint.trim() || testingConnection}
              >
                {testingConnection && <span className="spinner" style={{ marginRight: 6 }}></span>}
                {testingConnection ? t('integration.testingConnection') : t('integration.testConnection')}
              </button>
              {connectionResult === 'success' && (
                <span className="connection-result-mac success">✓ {t('integration.connectionSuccess')}</span>
              )}
              {connectionResult === 'error' && (
                <span className="connection-result-mac error">✗ {t('integration.connectionFailed')}</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer - MAC Style */}
        <div className="modal-footer-mac">
          <button
            type="button"
            className="btn-mac btn-mac-secondary"
            onClick={handleCopyPrompt}
            disabled={!hasPrompt}
            title={!hasPrompt ? "请先填写应用类型和地址" : t('onboarding:copyPrompt')}
          >
            {copiedPrompt ? (
              <>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{ marginRight: '6px' }}>
                  <path d="M13.33 4.67l-8 8M5.33 12.67l8-8" />
                </svg>
                {t('onboarding:copied')}
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{ marginRight: '6px' }}>
                  <rect x="3" y="7" width="10" height="6" rx="1" />
                  <path d="M5.5 7V4.5a2.5 2.5 0 0 1 5 0V7" />
                </svg>
                {t('onboarding:copyPrompt')}
              </>
            )}
          </button>
          <button
            className="btn-mac btn-mac-secondary"
            onClick={onClose}
            disabled={loading}
          >
            {t('common:cancel')}
          </button>
          <button
            className="btn-mac btn-mac-primary"
            onClick={handleSave}
            disabled={!isFormValid || loading}
          >
            {loading ? t('common:saving') : t('common:save')}
          </button>
        </div>
      </div>
    </div>
  );
}
