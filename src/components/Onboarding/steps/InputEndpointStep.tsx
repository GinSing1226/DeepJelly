/**
 * Input Endpoint Step
 *
 * 输入IP地址、端口和Token并连接
 * @module components/Onboarding/steps/InputEndpointStep
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useBrainStore } from '@/stores/brainStore';
import { useAppIntegrationStore } from '@/stores/appIntegrationStore';

interface InputEndpointStepProps {
  onSkip?: () => void;
}

export function InputEndpointStep({ onSkip }: InputEndpointStepProps) {
  const { t } = useTranslation('onboarding');
  const { setEndpoint, setStep, setError, error } = useOnboardingStore();
  const { connectAndSetConfig, connecting, connected } = useBrainStore();
  const { currentIntegration } = useAppIntegrationStore();

  // Parse endpoint to get IP and port for reintegration
  const getDefaultValues = () => {
    console.log('[InputEndpointStep] getDefaultValues called, currentIntegration:', currentIntegration);
    if (currentIntegration?.endpoint) {
      try {
        const url = new URL(currentIntegration.endpoint);
        const values = {
          ip: url.hostname,
          port: url.port || '18790',
          authToken: currentIntegration.authToken || ''
        };
        console.log('[InputEndpointStep] Returning values from URL:', values);
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
          console.log('[InputEndpointStep] Returning values from regex:', values);
          return values;
        }
      }
    }
    // Default values for first-time setup
    console.log('[InputEndpointStep] No integration, returning default values');
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

  // 组件挂载时检查是否有需要回显的数据
  useEffect(() => {
    console.log('[InputEndpointStep] Component mounted, currentIntegration:', currentIntegration);
  }, []);

  // 监听 currentIntegration 变化，更新表单值（用于重新集成时的回显）
  useEffect(() => {
    console.log('[InputEndpointStep] currentIntegration changed:', currentIntegration);
    if (currentIntegration?.endpoint) {
      try {
        const url = new URL(currentIntegration.endpoint);
        console.log('[InputEndpointStep] Restoring from URL:', url.hostname, url.port);
        setIp(url.hostname);
        setPort(url.port || '18790');
        setAuthToken(currentIntegration.authToken || '');
      } catch {
        const match = currentIntegration.endpoint.match(/ws:\/\/([^:]+):(\d+)/);
        if (match) {
          console.log('[InputEndpointStep] Restoring from regex:', match[1], match[2]);
          setIp(match[1]);
          setPort(match[2]);
          setAuthToken(currentIntegration.authToken || '');
        }
      }
    }
  }, [currentIntegration?.endpoint, currentIntegration?.authToken]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[InputEndpointStep] ${message}`);
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
      await connectAndSetConfig(fullEndpoint, authToken);

      addLog('✅ connectAndSetConfig() 完成');
      addLog('===== 连接流程结束 =====');

      // 如果没有抛出异常，说明连接成功
      setStatusMessage(t('connectSuccess'));
      addLog('✅ 连接验证通过！进入确认助手步骤');
      setTimeout(() => {
        setStep('confirm_assistant');
      }, 500);
    } catch (err) {
      const errorMsg = `${t('connectFailed')}: ${err instanceof Error ? err.message : String(err)}`;
      addLog(`❌ ===== ${t('connectFailed')} =====`);
      addLog(`错误详情: ${err}`);
      setError(errorMsg);
      setStatusMessage(t('connectFailed'));

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
    console.log('[InputEndpointStep] ⬅️ 返回上一步');
    setStep('show_prompt');
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="input-endpoint-step">
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
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="step-actions">
        <button className="btn-back" onClick={handleBack}>
          {t('previousStep')}
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

      {/* 日志面板 */}
      <div style={{ marginTop: '12px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <button
            onClick={() => setShowLogs(!showLogs)}
            style={{
              background: 'none',
              border: 'none',
              color: '#0071e3',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500'
            }}
          >
            {showLogs ? '▼' : '▶'} {t('connectionLog')} ({logs.length})
          </button>
          {logs.length > 0 && (
            <button
              onClick={handleClearLogs}
              style={{
                background: 'none',
                border: 'none',
                color: '#86868b',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              {t('clearLog')}
            </button>
          )}
        </div>

        {showLogs && (
          <div style={{
            background: '#1e1e1e',
            color: '#d4d4d4',
            padding: '10px',
            borderRadius: '6px',
            fontFamily: 'Consolas, Monaco, monospace',
            fontSize: '11px',
            maxHeight: '120px',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            border: '1px solid #3e3e42'
          }}>
            {logs.length === 0 ? (
              <span style={{ color: '#858585' }}>{t('noLogs')}</span>
            ) : (
              logs.map((log, index) => (
                <div key={index} style={{
                  marginBottom: index < logs.length - 1 ? '4px' : 0,
                  color: log.includes('❌') ? '#f48771' :
                        log.includes('✅') ? '#89d185' :
                        log.includes('⚠️') ? '#cca700' :
                        '#d4d4d4'
                }}>
                  {log}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
