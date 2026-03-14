/**
 * Input Endpoint Step
 *
 * 输入IP地址、端口和Token并连接
 * @module components/Onboarding/steps/InputEndpointStep
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useBrainStore } from '@/stores/brainStore';
import { useAppIntegrationStore } from '@/stores/appIntegrationStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { generateIntegrationPrompt } from '@/utils/promptTemplates';

interface InputEndpointStepProps {
  onSkip?: () => void;
}

// 生成32位 DeepJelly Token
function generateDeepjellyToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function InputEndpointStep({ onSkip }: InputEndpointStepProps) {
  const { t } = useTranslation('onboarding');
  const { setEndpoint, setStep, setError, error, selectedAppType, appName, appDescription, setAppName, setAppDescription } = useOnboardingStore();
  const { connectAndSetConfig, connecting, resetConnecting } = useBrainStore();
  const { currentIntegration, addIntegration, updateIntegration, setCurrentIntegration } = useAppIntegrationStore();
  const { endpointConfig } = useSettingsStore();

  // Parse endpoint to get IP and port for reintegration
  const getDefaultValues = () => {
    if (currentIntegration?.endpoint) {
      try {
        const url = new URL(currentIntegration.endpoint);
        const values = {
          ip: url.hostname,
          port: url.port || '18790',
          authToken: currentIntegration.authToken || ''
        };
        return values;
      } catch {
        // Fallback to regex parsing if URL constructor fails
        const match = currentIntegration.endpoint.match(/ws:\/\/([^:]+):(\d+)/);
        if (match) {
          const values = {
            ip: match[1],
            port: match[2],
            authToken: currentIntegration.authToken || ''
          };
          return values;
        }
      }
    }
    // Default values for first-time setup
    return {
      ip: '',
      port: '18790',
      authToken: ''
    };
  };

  const defaults = getDefaultValues();
  const [ip, setIp] = useState(defaults.ip);
  const [port, setPort] = useState(defaults.port);
  const [authToken, setAuthToken] = useState(defaults.authToken);
  const [statusMessage, setStatusMessage] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // DeepJelly Token - 首次创建时生成
  const [deepjellyToken] = useState(() => generateDeepjellyToken());

  // 生成集成提示词
  const integrationPrompt = useMemo(() => {
    if (!selectedAppType || !endpointConfig?.host || !endpointConfig?.port) return '';
    // 获取当前语言
    const locale = (localStorage.getItem('i18nextLng') as 'zh' | 'en' | 'ja') || 'zh';
    return generateIntegrationPrompt(
      selectedAppType,
      endpointConfig.host,
      endpointConfig.port.toString(),
      deepjellyToken,
      locale
    );
  }, [selectedAppType, endpointConfig?.host, endpointConfig?.port, deepjellyToken]);

  // 应用名称和描述状态
  const [appNameLocal, setAppNameLocal] = useState(() => {
    // 优先使用 store 中的值，否则使用当前集成的值，否则使用应用类型名称
    if (appName) return appName;
    if (currentIntegration?.name) return currentIntegration.name;
    return selectedAppType === 'openclaw' ? 'OpenClaw' : '';
  });
  const [appDescriptionLocal, setAppDescriptionLocal] = useState(() => {
    if (appDescription) return appDescription;
    if (currentIntegration?.description) return currentIntegration.description;
    return '';
  });

  // 组件挂载时检查是否有需要回显的数据
  useEffect(() => {
    // 如果有 currentIntegration，恢复应用名称和描述
    if (currentIntegration) {
      if (currentIntegration.name && !appName) {
        setAppNameLocal(currentIntegration.name);
        setAppName(currentIntegration.name);
      }
      if (currentIntegration.description && !appDescription) {
        setAppDescriptionLocal(currentIntegration.description);
        setAppDescription(currentIntegration.description);
      }
    }
  }, [currentIntegration, appName, appDescription]);

  // 监听 currentIntegration 变化，更新表单值（用于重新集成时的回显）
  useEffect(() => {
    if (currentIntegration?.endpoint) {
      try {
        const url = new URL(currentIntegration.endpoint);
        setIp(url.hostname);
        setPort(url.port || '18790');
        setAuthToken(currentIntegration.authToken || '');
      } catch {
        const match = currentIntegration.endpoint.match(/ws:\/\/([^:]+):(\d+)/);
        if (match) {
          setIp(match[1]);
          setPort(match[2]);
          setAuthToken(currentIntegration.authToken || '');
        }
      }
    }
  }, [currentIntegration]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // 带超时的 Promise 包装器
  const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
      ),
    ]);
  };

  const validateIP = (value: string): boolean => {
    if (value === 'localhost' || value === '127.0.0.1') return true;
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    return ipRegex.test(value);
  };

  const handleConnect = async () => {
    addLog('🚀 ===== 开始连接流程 =====');

    // Reset logs and state
    setLogs([]);
    addLog('🔄 重置状态...');
    setError('');
    setStatusMessage('正在准备连接...');

    addLog(`📡 输入参数:`);
    addLog(`   IP: ${ip}`);
    addLog(`   Port: ${port}`);
    addLog(`   Token: ${authToken ? `${authToken.substring(0, 8)}...(${authToken.length} chars)` : '(未提供)'}`);

    if (!validateIP(ip)) {
      const errorMsg = t('ipFormatError');
      addLog(`❌ ${errorMsg}`);
      setError(errorMsg);
      setStatusMessage('');
      return;
    }
    addLog('✅ IP格式验证通过');

    const fullEndpoint = `ws://${ip}:${port}`;
    addLog(`🔗 构造的端点: ${fullEndpoint}`);

    // Save to store
    setEndpoint(fullEndpoint);
    addLog('💾 已保存到 onboarding store');

    try {
      addLog('📞 调用 brainStore.connectAndSetConfig()...');
      setStatusMessage(t('connectingStatus'));

      // connectAndSetConfig 成功完成表示连接已建立
      // 添加 2 分钟超时机制
      const CONNECTION_TIMEOUT = 120 * 1000; // 2 分钟
      await withTimeout(
        connectAndSetConfig(fullEndpoint, authToken),
        CONNECTION_TIMEOUT,
        t('connectionTimeout', '连接超时：超过 2 分钟未响应，请检查网络或服务器状态后重试')
      );

      addLog('✅ connectAndSetConfig() 完成');

      // 连接成功后，立即保存集成配置到文件
      addLog('💾 保存集成配置到文件...');

      // 使用用户输入的应用名称和描述
      const finalAppName = appNameLocal.trim() || (selectedAppType === 'openclaw' ? 'OpenClaw' : 'Application');

      if (currentIntegration) {
        // 编辑场景：更新现有集成
        addLog(`📝 编辑模式：更新集成 ${currentIntegration.id}`);
        await updateIntegration(currentIntegration.id, {
          id: currentIntegration.id,
          applicationId: currentIntegration.applicationId,
          provider: currentIntegration.provider,
          name: finalAppName,
          description: appDescriptionLocal.trim() || undefined,
          endpoint: fullEndpoint,
          authToken: authToken || undefined,
          enabled: true,
          createdAt: currentIntegration.createdAt,
          assistant: currentIntegration.assistant,
        });
        addLog('✅ 集成配置已更新');
      } else {
        // 首次场景：创建新集成
        addLog('📝 首次模式：创建新集成');
        const newIntegration = await addIntegration({
          provider: 'openclaw',
          name: finalAppName,
          description: appDescriptionLocal.trim() || undefined,
          endpoint: fullEndpoint,
          authToken: authToken || undefined,
          deepjellyToken: deepjellyToken, // 保存 DeepJelly Token
          enabled: true, // 首次绑定默认启用
        });
        addLog('✅ 新集成已创建');
        // 关键：设置为当前集成，让 ConfirmAssistantStep 能找到它
        setCurrentIntegration(newIntegration);
        addLog(`📍 设置为当前集成: ${newIntegration.id}`);
      }

      addLog('===== 连接流程结束 =====');

      // 如果没有抛出异常，说明连接成功
      setStatusMessage(t('connectSuccess'));
      addLog('✅ 连接验证通过！进入确认助手步骤');
      setTimeout(() => {
        setStep('binding_confirm');
      }, 500);
    } catch (err) {
      const errorMsg = `${t('connectFailed')}: ${err instanceof Error ? err.message : String(err)}`;
      addLog(`❌ ===== ${t('connectFailed')} =====`);
      addLog(`错误详情: ${err}`);
      setError(errorMsg);
      setStatusMessage(t('connectFailed'));

      // 重置连接状态，允许用户重新点击连接按钮
      resetConnecting();

      // Print more detailed error info
      if (err instanceof Error) {
        addLog(`Error name: ${err.name}`);
        addLog(`Error message: ${err.message}`);
        if (err.stack) {
          addLog(`Error stack: ${err.stack.split('\n').slice(0, 3).join('\n')}`);
        }
      }
    }
  };

  const handleBack = () => {
    setStep('select_app');
  };

  const handleCopyPrompt = async () => {
    if (!integrationPrompt) return;
    try {
      await navigator.clipboard.writeText(integrationPrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch (error) {
      console.error('[InputEndpointStep] Copy prompt failed:', error);
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="input-endpoint-step">
      <div className="step-content-wrapper">
        <h2>{t('connectTitle')}</h2>
        <p>{t('connectDesc')}</p>

        {/* 状态提示 */}
        {statusMessage && (
          <div style={{
            padding: '10px',
            marginBottom: '16px',
            background: statusMessage.includes('成功') ? '#d4edda' : statusMessage.includes('失败') ? '#f8d7da' : '#e7f3ff',
            borderRadius: '6px',
            fontSize: '14px',
            textAlign: 'center'
          }}>
            {statusMessage}
          </div>
        )}

        {/* 集成提示词 - 折叠区域，放在第一个字段 */}
        <div className="prompt-section">
          <div
            className="prompt-header"
            onClick={() => setPromptExpanded(!promptExpanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              userSelect: 'none',
              padding: '8px 0',
            }}
          >
            <label style={{
              fontSize: '14px',
              color: 'var(--dj-text-secondary)',
              fontWeight: '500',
            }}>
              {t('integrationPrompt', '集成提示词')}
            </label>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPromptExpanded(!promptExpanded);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--dj-text-muted)',
                cursor: 'pointer',
                padding: '4px',
                fontSize: '10px',
                transition: 'transform 0.15s ease',
              }}
            >
              {promptExpanded ? '▼' : '▶'}
            </button>
          </div>
          {promptExpanded && (
            <div className="prompt-card">
              {integrationPrompt ? (
                <pre className="prompt-content">{integrationPrompt}</pre>
              ) : (
                <div style={{
                  color: 'var(--dj-text-muted)',
                  fontSize: '14px',
                  padding: '12px 0',
                  textAlign: 'center',
                }}>
                  请先填写IP地址和端口后，将生成集成提示词
                </div>
              )}
            </div>
          )}
        </div>

        <div className="endpoint-form">
          <div className="form-group">
            <label>{t('ipAddress')}</label>
            <input
              type="text"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="127.0.0.1"
              autoFocus
            />
            <small>{t('ipAddressHint')}</small>
          </div>

          <div className="form-group">
            <label>{t('port')}</label>
            <input
              type="text"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="18790"
            />
            <small>{t('portHint')}</small>
          </div>

          <div className="form-group">
            <label>{t('authToken')}</label>
            <input
              type="text"
              value={authToken}
              onChange={(e) => {
                setAuthToken(e.target.value);
              }}
              placeholder=""
            />
            <small>{t('authTokenHint')}</small>
          </div>

          {/* 应用名称 */}
          <div className="form-group">
            <label>{t('appName')} <span style={{ color: 'red' }}>*</span></label>
            <input
              type="text"
              value={appNameLocal}
              onChange={(e) => {
                setAppNameLocal(e.target.value);
                setAppName(e.target.value);
              }}
              placeholder={selectedAppType === 'openclaw' ? 'OpenClaw' : 'Application'}
            />
            <small>{t('appNameHint')}</small>
          </div>

          {/* 应用描述 */}
          <div className="form-group">
            <label>{t('appDescription')}</label>
            <input
              type="text"
              value={appDescriptionLocal}
              onChange={(e) => {
                setAppDescriptionLocal(e.target.value);
                setAppDescription(e.target.value);
              }}
              placeholder={t('appDescriptionPlaceholder')}
            />
            <small>{t('appDescriptionHint')}</small>
          </div>

          {/* DeepJelly 配置 */}
          <div style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid var(--dj-border)',
          }}>
            <div style={{
              fontSize: '13px',
              fontWeight: '600',
              color: 'var(--dj-text-secondary)',
              marginBottom: '12px',
            }}>
              DeepJelly 配置
            </div>

            {/* DeepJelly Token */}
            <div className="form-group">
              <label>DeepJelly API Token</label>
              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
              }}>
                <input
                  type="text"
                  value={deepjellyToken}
                  readOnly
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    background: 'var(--dj-bg-secondary)',
                    color: 'var(--dj-text-muted)',
                    cursor: 'not-allowed',
                    flex: 1,
                  }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(deepjellyToken);
                      setStatusMessage('Token 已复制到剪贴板');
                      setTimeout(() => setStatusMessage(''), 2000);
                    } catch (error) {
                      console.error('[InputEndpointStep] Copy token failed:', error);
                    }
                  }}
                  style={{
                    padding: '10px 12px',
                    background: 'var(--dj-text-primary)',
                    color: 'var(--dj-bg-primary)',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  title="复制 Token"
                >
                  📋 复制
                </button>
              </div>
              <small>这是 AI 应用调用 DeepJelly API 的密钥，请妥善保管</small>
            </div>

            {/* DeepJelly 请求地址 */}
            <div className="form-group">
              <label>DeepJelly 请求地址</label>
              <input
                type="text"
                value={endpointConfig?.host || ''}
                readOnly
                style={{
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  background: 'var(--dj-bg-secondary)',
                  color: 'var(--dj-text-muted)',
                  cursor: 'not-allowed',
                }}
              />
              <small>AI 应用将连接到此地址</small>
            </div>

            {/* DeepJelly 请求端口 */}
            <div className="form-group">
              <label>DeepJelly 请求端口</label>
              <input
                type="text"
                value={endpointConfig?.port?.toString() || ''}
                readOnly
                style={{
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  background: 'var(--dj-bg-secondary)',
                  color: 'var(--dj-text-muted)',
                  cursor: 'not-allowed',
                }}
              />
              <small>AI 应用将连接到此端口</small>
            </div>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* 日志面板 - 移到内容区 */}
        <div className="connection-logs-section">
          <div className="connection-logs-header">
            <button
              className="btn-toggle-logs"
              onClick={() => setShowLogs(!showLogs)}
            >
              {showLogs ? '▼' : '▶'} {t('connectionLog')} ({logs.length})
            </button>
            {logs.length > 0 && (
              <button
                className="btn-clear-logs"
                onClick={handleClearLogs}
              >
                {t('clearLog')}
              </button>
            )}
          </div>

          {showLogs && (
            <div className="connection-logs-content">
              {logs.length === 0 ? (
                <span className="log-empty">{t('noLogs')}</span>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className={`log-entry ${
                    log.includes('❌') ? 'log-error' :
                    log.includes('✅') ? 'log-success' :
                    log.includes('⚠️') ? 'log-warning' : ''
                  }`}>
                    {log}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="step-actions">
        <button className="btn-back" onClick={handleBack}>
          {t('previousStep')}
        </button>
        <button
          className="btn-secondary"
          onClick={handleCopyPrompt}
          disabled={!integrationPrompt}
          title={!integrationPrompt ? "请先填写IP地址和端口" : t('copyPrompt', '复制提示词')}
        >
          {copiedPrompt ? (
            <>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{ marginRight: '6px' }}>
                <path d="M13.33 4.67l-8 8M5.33 12.67l8-8" />
              </svg>
              {t('copied', '已复制')}
            </>
          ) : (
            <>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{ marginRight: '6px' }}>
                <rect x="3" y="7" width="10" height="6" rx="1" />
                <path d="M5.5 7V4.5a2.5 2.5 0 0 1 5 0V7" />
              </svg>
              {t('copyPrompt', '复制提示词')}
            </>
          )}
        </button>
        <button
          className="btn-primary"
          onClick={handleConnect}
          disabled={connecting || !ip}
        >
          {connecting ? t('connecting') : t('connectButton')}
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
