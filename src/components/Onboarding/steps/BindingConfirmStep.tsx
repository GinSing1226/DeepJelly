/**
 * Binding Confirm Step
 *
 * 绑定确认步骤 - 等待OpenClaw Agent发送测试消息以确认绑定
 * @module components/Onboarding/steps/BindingConfirmStep
 */

import { useEffect, useState } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import type { BoundAssistant, AssistantIntegration } from '@/types/appConfig';
import { useTranslation } from 'react-i18next';

interface BindingConfirmStepProps {
  onComplete: (assistant: BoundAssistant) => void;
  onSkip?: () => void;
}

interface BindingResult {
  assistantId: string;
  name: string;
  description?: string;
  applicationId: string;
}

export function BindingConfirmStep({ onComplete, onSkip }: BindingConfirmStepProps) {
  const { t } = useTranslation('onboarding');
  const { selectedAppType, endpoint, setConnecting } = useOnboardingStore();
  const [status, setStatus] = useState<'waiting' | 'connecting' | 'received' | 'success'>('waiting');
  const [bindingData, setBindingData] = useState<BindingResult | null>(null);

  useEffect(() => {
    // 组件加载时开始等待绑定消息
    setStatus('connecting');

    // TODO: 实际应该从 Tauri 命令获取绑定结果
    // 这里需要调用 Rust 后端的绑定确认逻辑
    // invoke('confirm_binding', { endpoint: endpoint, appType: selectedAppType })

    // 模拟接收绑定消息（实际需要从WebSocket或Tauri事件接收）
    const timer = setTimeout(() => {
      // 模拟数据，实际应从 OpenClaw Agent 接收
      setBindingData({
        assistantId: generateApplicationId(),
        name: 'My Assistant',
        description: 'Bound to OpenClaw',
        applicationId: generateApplicationId(),
      });
      setStatus('received');
      setConnecting(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [endpoint, selectedAppType, setConnecting]);

  const generateApplicationId = (): string => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleConfirm = () => {
    if (!bindingData) return;

    // 创建 OpenClaw 集成参数
    const openclawIntegration: AssistantIntegration = {
      provider: selectedAppType || 'openclaw',
      params: {
        applicationId: bindingData.applicationId,
        agentId: bindingData.assistantId,
        sessionKey: 'agent:' + bindingData.assistantId + ':main',
      },
      enabled: true,
      createdAt: Date.now(),
    };

    const assistant: BoundAssistant = {
      id: bindingData.assistantId,
      name: bindingData.name,
      description: bindingData.description,
      integrations: [openclawIntegration],
    };

    setStatus('success');
    onComplete(assistant);
  };

  return (
    <div className="binding-confirm-step">
      <h1>{t('bindingTitle')}</h1>

      {status === 'connecting' && (
        <div className="binding-status">
          <div className="loading-spinner" />
          <p>{t('waitingForBinding', { appType: selectedAppType })}</p>
          <p className="text-sm text-gray">
            {t('configureApp', { appType: selectedAppType })}
          </p>
          <div className="endpoint-info">
            <p><strong>{t('websocketAddress')}</strong> {endpoint}</p>
          </div>
        </div>
      )}

      {status === 'received' && bindingData && (
        <div className="binding-success">
          <div className="success-icon">✓</div>
          <h2>{t('bindingRequestReceived')}</h2>
          <p>{t('agentInfo')}</p>
          <div className="agent-info">
            <p><strong>{t('nameLabel')}</strong> {bindingData.name}</p>
            {bindingData.description && (
              <p><strong>{t('descLabel')}</strong> {bindingData.description}</p>
            )}
          </div>

          <div className="auth-info-section">
            <h3>{t('appInfo')}</h3>
            <p className="text-sm text-gray">
              {t('copyConfigToApp', { appType: selectedAppType })}
            </p>
            <div className="auth-info">
              <div className="auth-field">
                <label>{t('applicationId')}</label>
                <code>{bindingData.applicationId}</code>
                <button
                  className="btn-copy"
                  onClick={() => navigator.clipboard.writeText(bindingData.applicationId)}
                >
                  {t('copy')}
                </button>
              </div>
            </div>
          </div>

          <div className="binding-actions">
            <button className="btn-primary" onClick={handleConfirm}>
              {t('confirmBinding')}
            </button>
            <button className="btn-secondary" onClick={() => setStatus('waiting')}>
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {status === 'success' && (
        <div className="binding-complete">
          <div className="success-icon">✓</div>
          <h2>{t('bindingSuccess')}</h2>
          <p>{t('boundSuccessfully', { appType: selectedAppType })}</p>
        </div>
      )}

      {onSkip && status !== 'success' && (
        <div className="skip-option">
          <button className="btn-text" onClick={onSkip}>
            {t('skipBinding')}
          </button>
        </div>
      )}
    </div>
  );
}
