/**
 * Confirm Assistant Step
 *
 * 选择 OpenClaw 助手，选择 Session Key，创建应用集成和绑定
 * @module components/Onboarding/steps/ConfirmAssistantStep
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useBrainStore } from '@/stores/brainStore';
import { useAppIntegrationStore } from '@/stores/appIntegrationStore';
import { useCharacterManagementStore } from '@/stores/characterManagementStore';
import { useCAPMessage } from '@/hooks/useCAPMessage';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import type { BoundAssistant, AssistantIntegration, AppIntegration } from '@/types/appConfig';
import type { SessionPayload } from '@/types/cap';

interface ConfirmAssistantStepProps {
  onComplete: (assistant: BoundAssistant) => void;
  onSkip?: () => void;
}

interface OpenClawAssistant {
  id: string;
  name: string;
  description?: string;
}

interface LocalAssistant {
  id: string;
  name: string;
  description?: string;
}

interface AgentSession {
  sessionKey: string;
  sessionId: string;
  label?: string;
  displayName?: string;
  kind: string;
  channel?: string;
  updatedAt?: number;
}

interface BoundAssistantResult {
  id: string;
  name: string;
  description?: string;
  agentId: string;
  agentName: string;
  sessionKey: string;
  applicationId: string;
}

// 生成随机应用ID
function generateApplicationId(): string {
  const charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

export function ConfirmAssistantStep({ onComplete, onSkip }: ConfirmAssistantStepProps) {
  const { t } = useTranslation('onboarding');
  const { assistants: openclawAgents, getAgents, getAgentSessions, connected, config } = useBrainStore();
  const { endpoint } = useOnboardingStore();
  const { addIntegration, updateIntegration, currentIntegration } = useAppIntegrationStore();
  const { assistants: localAssistants, addAssistant, updateAssistant, loadAssistants } = useCharacterManagementStore();

  // 从 brainStore config 获取 authToken
  const authToken = config?.auth_token || '';

  // 集成模式：'auto' | 'manual'
  const [integrationMode, setIntegrationMode] = useState<'auto' | 'manual'>('auto');
  const [bindStatus, setBindStatus] = useState<'idle' | 'binding' | 'success' | 'failed'>('idle');
  const [bindError, setBindError] = useState<string | null>(null);

  const [selectedOpenClawAssistant, setSelectedOpenClawAssistant] = useState<OpenClawAssistant | null>(null);
  const [selectedSessionKey, setSelectedSessionKey] = useState<string>('');
  const [selectedLocalAssistant, setSelectedLocalAssistant] = useState<LocalAssistant | null>(null);
  const [agentSessions, setAgentSessions] = useState<AgentSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingOpenClaw, setIsLoadingOpenClaw] = useState(true);

  // 用于等待回复的标志
  const [waitingForReply, setWaitingForReply] = useState(false);
  const waitingForSessionKeyRef = useRef<string>('');

  // 绑定成功后的结果信息
  const [boundResult, setBoundResult] = useState<BoundAssistantResult | null>(null);

  // 生成并缓存 applicationId（手动模式使用）
  const manualApplicationId = useMemo(() => generateApplicationId(), []);

  // 加载 OpenClaw 助手列表
  useEffect(() => {
    const loadOpenClawAgents = async () => {
      console.log('[ConfirmAssistantStep] 📡 Loading OpenClaw agents...');
      setIsLoadingOpenClaw(true);
      try {
        await getAgents();
        console.log('[ConfirmAssistantStep] ✅ OpenClaw agents loaded');
      } catch (error) {
        console.error('[ConfirmAssistantStep] ❌ Failed to load OpenClaw agents:', error);
      } finally {
        setIsLoadingOpenClaw(false);
      }
    };

    loadOpenClawAgents();
  }, [getAgents]);

  // 加载本地预设助手列表
  useEffect(() => {
    const loadLocalAssistants = async () => {
      console.log('[ConfirmAssistantStep] 📡 Loading local assistants...');
      try {
        await loadAssistants();
        console.log('[ConfirmAssistantStep] ✅ Local assistants loaded');
      } catch (error) {
        console.error('[ConfirmAssistantStep] ❌ Failed to load local assistants:', error);
      }
    };

    loadLocalAssistants();
  }, [loadAssistants]);

  // 加载本地预设助手（从 store）
  useEffect(() => {
    if (localAssistants.length > 0 && !selectedLocalAssistant) {
      setSelectedLocalAssistant(localAssistants[0]);
    }
  }, [localAssistants, selectedLocalAssistant]);

  // 默认选择第一个 OpenClaw Agent（首次集成）或回显已选择的 Agent（重新集成）
  useEffect(() => {
    console.log('[ConfirmAssistantStep] 📋 OpenClaw agents updated:', openclawAgents.length);
    console.log('[ConfirmAssistantStep] 📋 Currently selected:', selectedOpenClawAssistant?.id);
    console.log('[ConfirmAssistantStep] 📋 currentIntegration:', currentIntegration?.applicationId);

    // 检查 agent 是否有有效的 ID
    openclawAgents.forEach((agent, i) => {
      if (!agent.id || agent.id === 'undefined' || agent.id === '') {
        console.error(`[ConfirmAssistantStep] ❌ Agent ${i} has invalid ID:`, agent);
      }
    });

    if (openclawAgents.length > 0 && !selectedOpenClawAssistant) {
      // 重新集成：查找已绑定的 agent
      if (currentIntegration) {
        const existingAssistant = localAssistants.find(assistant =>
          assistant.integrations?.some(integration =>
            integration.provider === 'openclaw' &&
            integration.params.applicationId === currentIntegration.applicationId
          )
        );
        if (existingAssistant?.integrations) {
          const openclawIntegration = existingAssistant.integrations.find(i => i.provider === 'openclaw');
          if (openclawIntegration?.params.agentId) {
            const matchedAgent = openclawAgents.find(a => a.id === openclawIntegration.params.agentId);
            if (matchedAgent) {
              console.log('[ConfirmAssistantStep] ✅ Reintegration: restoring selected agent:', matchedAgent.id);
              setSelectedOpenClawAssistant(matchedAgent);
              return;
            }
          }
        }
      }

      // 首次集成：选择第一个 agent
      const firstAgent = openclawAgents[0];
      console.log('[ConfirmAssistantStep] ✅ Auto-selecting first agent:', firstAgent.id, firstAgent.name);

      // 验证 agent ID 有效性
      if (!firstAgent.id || firstAgent.id === 'undefined' || firstAgent.id === '') {
        console.error('[ConfirmAssistantStep] ❌ First agent has invalid ID:', firstAgent);
      }

      setSelectedOpenClawAssistant(firstAgent);
    }
  }, [openclawAgents, selectedOpenClawAssistant, currentIntegration, localAssistants]);

  // 当选择 Agent 后，获取该 Agent 的所有 Session
  useEffect(() => {
    const loadAgentSessions = async () => {
      if (!selectedOpenClawAssistant) {
        setAgentSessions([]);
        setSelectedSessionKey('');
        return;
      }

      console.log('[ConfirmAssistantStep] 📋 Loading sessions for agent:', selectedOpenClawAssistant.id);
      setIsLoadingSessions(true);
      try {
        const sessions = await getAgentSessions(selectedOpenClawAssistant.id);
        console.log('[ConfirmAssistantStep] ✅ Got sessions:', sessions);
        console.log('[ConfirmAssistantStep] 📋 Sessions count:', sessions.length);

        // Check for invalid session keys
        const invalidSessions = sessions.filter((s: AgentSession) => s.sessionKey.includes('undefined'));
        if (invalidSessions.length > 0) {
          console.error('[ConfirmAssistantStep] ❌ Found sessions with "undefined" in key:', invalidSessions);
          console.error('[ConfirmAssistantStep] 💡 This means OpenClaw agents don\'t have proper IDs configured');
        }

        sessions.forEach((s: AgentSession, i: number) => {
          console.log(`[ConfirmAssistantStep]   [${i}] sessionKey="${s.sessionKey}", sessionId="${s.sessionId}", label="${s.label}"`);
        });

        setAgentSessions(sessions);

        // 重新集成：查找之前绑定的 sessionKey
        if (currentIntegration) {
          const existingAssistant = localAssistants.find(assistant =>
            assistant.integrations?.some(integration =>
              integration.provider === 'openclaw' &&
              integration.params.applicationId === currentIntegration.applicationId
            )
          );
          if (existingAssistant?.integrations) {
            const openclawIntegration = existingAssistant.integrations.find(i => i.provider === 'openclaw');
            if (openclawIntegration?.params.sessionKeys?.[0]) {
              const previousSessionKey = openclawIntegration.params.sessionKeys[0];
              const sessionExists = sessions.find((s: AgentSession) => s.sessionKey === previousSessionKey);
              if (sessionExists) {
                console.log('[ConfirmAssistantStep] ✅ Reintegration: restoring previous session:', previousSessionKey);
                setSelectedSessionKey(previousSessionKey);
                setIsLoadingSessions(false);
                return;
              }
            }
          }
        }

        // 默认选择 main 会话（但跳过包含 undefined 的）
        const validSessions = sessions.filter((s: AgentSession) => !s.sessionKey.includes('undefined'));
        const mainSession = validSessions.find((s: AgentSession) => s.sessionKey.endsWith(':main'));

        if (mainSession) {
          console.log('[ConfirmAssistantStep] ✅ Selected main session:', mainSession.sessionKey);
          setSelectedSessionKey(mainSession.sessionKey);  // ✅ 使用 sessionKey
          console.log('[ConfirmAssistantStep] 📝 State update: setSelectedSessionKey called with:', mainSession.sessionKey);
        } else if (validSessions.length > 0) {
          console.log('[ConfirmAssistantStep] ✅ Selected first valid session:', validSessions[0].sessionKey);
          setSelectedSessionKey(validSessions[0].sessionKey);  // ✅ 使用 sessionKey
          console.log('[ConfirmAssistantStep] 📝 State update: setSelectedSessionKey called with:', validSessions[0].sessionKey);
        } else {
          console.log('[ConfirmAssistantStep] ⚠️ No valid sessions available');
          setSelectedSessionKey('');
          console.log('[ConfirmAssistantStep] 📝 State update: setSelectedSessionKey called with: empty string');
          if (sessions.length > 0 && invalidSessions.length > 0) {
            // All sessions are invalid - show warning
            console.warn('[ConfirmAssistantStep] ⚠️ All sessions contain "undefined" - OpenClaw configuration issue');
          }
        }
      } catch (error) {
        console.error('[ConfirmAssistantStep] ❌ Failed to load agent sessions:', error);
        setAgentSessions([]);
        setSelectedSessionKey('');
      } finally {
        setIsLoadingSessions(false);
      }
    };

    loadAgentSessions();
  }, [selectedOpenClawAssistant, getAgentSessions, currentIntegration, localAssistants]);

  // 监听会话消息，用于自动集成时等待回复
  useCAPMessage({
    onSession: useCallback((payload: SessionPayload) => {
      console.log('[ConfirmAssistantStep] 📨 Received session message:', payload);

      // 如果正在等待回复，检查是否是目标 sessionKey 的回复
      if (waitingForReply && waitingForSessionKeyRef.current) {
        const messageSessionKey = payload.session_id || '';
        console.log('[ConfirmAssistantStep] 📌 Message from sessionKey:', messageSessionKey);
        console.log('[ConfirmAssistantStep] 📌 Waiting for sessionKey:', waitingForSessionKeyRef.current);

        if (messageSessionKey === waitingForSessionKeyRef.current) {
          console.log('[ConfirmAssistantStep] ✅ Received reply from target session!');
          setWaitingForReply(false);

          // 收到回复，继续完成集成
          completeIntegration(generateApplicationId());
        }
      }
    }, [waitingForReply]),
  });

  // 完成集成的通用逻辑
  const completeIntegration = async (applicationId: string) => {
    if (!selectedSessionKey || !selectedOpenClawAssistant) {
      setBindStatus('failed');
      setBindError('缺少必要信息');
      return;
    }

    try {
      // 检查是否是重新集成模式
      const isReintegration = currentIntegration !== null;

      // 1. 创建或更新 OpenClaw 应用集成配置
      let integrationConfig: AppIntegration;

      if (isReintegration && currentIntegration) {
        // 重新集成：更新现有集成
        await updateIntegration(currentIntegration.id, {
          name: `OpenClaw (${selectedOpenClawAssistant.name})`,
          endpoint: endpoint,
          authToken: authToken,
          enabled: true,
        });
        integrationConfig = currentIntegration;
        console.log('[ConfirmAssistantStep] ✅ App integration updated:', integrationConfig);
      } else {
        // 首次集成：创建新集成
        integrationConfig = await addIntegration({
          name: `OpenClaw (${selectedOpenClawAssistant.name})`,
          provider: 'openclaw',
          endpoint: endpoint,
          authToken: authToken,
          enabled: true,
        });
        console.log('[ConfirmAssistantStep] ✅ App integration created:', integrationConfig);
      }

      // 2. 创建助手集成配置
      const openclawIntegration: AssistantIntegration = {
        provider: 'openclaw',
        params: {
          applicationId: integrationConfig.applicationId,
          agentId: selectedOpenClawAssistant.id,
          sessionKeys: [selectedSessionKey],
        },
        enabled: true,
        createdAt: Date.now(),
      };

      // 3. 添加或更新助手
      let boundAssistantId: string;
      let boundAssistantName: string;
      let boundAssistantDescription: string | undefined;

      // 查找已绑定到此应用集成的助手
      const existingAssistant = localAssistants.find(assistant =>
        assistant.integrations?.some(integration =>
          integration.provider === 'openclaw' &&
          integration.params.applicationId === integrationConfig.applicationId
        )
      );

      if (isReintegration && existingAssistant) {
        // 重新集成：更新现有助手的集成
        const existingIntegrations = existingAssistant.integrations || [];
        const otherIntegrations = existingIntegrations.filter(i => i.provider !== 'openclaw');

        await updateAssistant(existingAssistant.id, {
          name: existingAssistant.name,
          description: existingAssistant.description,
          appType: 'openclaw',
          agentLabel: selectedOpenClawAssistant.name,
          boundAgentId: selectedOpenClawAssistant.id,
          sessionKey: selectedSessionKey,
          integrations: [...otherIntegrations, openclawIntegration],
        });
        boundAssistantId = existingAssistant.id;
        boundAssistantName = existingAssistant.name;
        boundAssistantDescription = existingAssistant.description;
        console.log('[ConfirmAssistantStep] ✅ Existing assistant updated:', existingAssistant.id);
      } else if (selectedLocalAssistant) {
        // 使用选中的本地助手（首次集成）- 更新现有助手而不是创建新的
        const existingIntegrations = selectedLocalAssistant.integrations || [];
        const otherIntegrations = existingIntegrations.filter(i => i.provider !== 'openclaw');

        await updateAssistant(selectedLocalAssistant.id, {
          name: selectedLocalAssistant.name,
          description: selectedLocalAssistant.description,
          appType: 'openclaw',
          agentLabel: selectedOpenClawAssistant.name,
          boundAgentId: selectedOpenClawAssistant.id,
          sessionKey: selectedSessionKey,
          integrations: [...otherIntegrations, openclawIntegration],
        });
        boundAssistantId = selectedLocalAssistant.id;
        boundAssistantName = selectedLocalAssistant.name;
        boundAssistantDescription = selectedLocalAssistant.description;
        console.log('[ConfirmAssistantStep] ✅ Local assistant updated:', selectedLocalAssistant.id);
      } else {
        // 添加新助手
        const created = await addAssistant({
          name: selectedOpenClawAssistant.name,
          description: selectedOpenClawAssistant.description,
          appType: 'openclaw',
          agentLabel: selectedOpenClawAssistant.name,
          boundAgentId: selectedOpenClawAssistant.id,
          sessionKey: selectedSessionKey,
          integrations: [openclawIntegration],
        });
        boundAssistantId = created.id;
        boundAssistantName = selectedOpenClawAssistant.name;
        boundAssistantDescription = selectedOpenClawAssistant.description;
      }

      console.log('[ConfirmAssistantStep] ✅ Assistant integration complete');
      setBindStatus('success');

      // 4. Emit event 通知其他窗口刷新
      await emit('onboarding:complete', { integration: integrationConfig });

      // 5. 准备绑定信息用于显示
      const boundAssistant = {
        id: boundAssistantId,
        name: boundAssistantName,
        description: boundAssistantDescription,
        agentId: selectedOpenClawAssistant.id,
        agentName: selectedOpenClawAssistant.name,
        sessionKey: selectedSessionKey,
        applicationId: integrationConfig.applicationId,
      };

      // 保存到状态以便在成功页面显示
      setBoundResult(boundAssistant);
    } catch (error) {
      console.error('[ConfirmAssistantStep] ❌ Failed to complete integration:', error);
      setBindStatus('failed');
      setBindError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleFinish = () => {
    if (!boundResult) return;

    onComplete({
      id: boundResult.id,
      name: boundResult.name,
      description: boundResult.description,
      integrations: [{
        provider: 'openclaw',
        params: {
          applicationId: boundResult.applicationId,
          agentId: boundResult.agentId,
          sessionKeys: [boundResult.sessionKey],
        },
        enabled: true,
        createdAt: Date.now(),
      }],
    });
  };

  // 生成显示名称
  const getSessionDisplayName = (session: AgentSession): string => {
    if (session.label || session.displayName) {
      return `${session.label || session.displayName} (${session.sessionKey})`;
    }
    // 从 sessionKey 解析友好的名称
    const parts = session.sessionKey.split(':');
    if (parts[0] === 'agent' && parts.length >= 3) {
      const agentId = parts[1];
      if (parts[2] === 'main') {
        return `${agentId} - ${t('mainSession')}`;
      }
      // channel:peer 格式
      if (parts.length >= 4) {
        const channel = parts[2];
        const peer = parts[3];
        return `${agentId} - ${channel}:${peer}`;
      }
    }
    return session.sessionKey;  // 显示时仍然用 sessionKey
  };

  // 自动集成
  const handleAutoBind = async () => {
    console.log('[ConfirmAssistantStep] =======================================');
    console.log('[ConfirmAssistantStep] 🤖 handleAutoBind called');

    // 验证必要的选项
    if (!selectedOpenClawAssistant) {
      alert(t('pleaseSelectAgent'));
      setBindStatus('failed');
      setBindError(t('noAgentSelected'));
      return;
    }

    if (!selectedSessionKey) {
      alert(t('pleaseSelectSession'));
      return;
    }

    // 检查 sessionKey 是否包含 undefined
    if (selectedSessionKey.includes('undefined')) {
      console.error('[ConfirmAssistantStep] ❌ Session key contains "undefined":', selectedSessionKey);
      alert(`${t('sessionKeyInvalid')}: ${selectedSessionKey}\n\n${t('agentIdConfigIssue')}`);
      setBindStatus('failed');
      setBindError(`${t('invalidSessionKey')}: ${selectedSessionKey}`);
      return;
    }

    // 检查是否已连接
    if (!connected) {
      alert(t('pleaseConnectFirst'));
      setBindStatus('failed');
      setBindError(t('notConnected'));
      return;
    }

    console.log('[ConfirmAssistantStep] 🤖 Starting auto-integration...');
    console.log('[ConfirmAssistantStep] 📌 Selected Agent:', selectedOpenClawAssistant?.id);
    console.log('[ConfirmAssistantStep] 📌 Target Session Key:', selectedSessionKey);
    setBindStatus('binding');
    setBindError(null);

    try {
      const applicationId = generateApplicationId();
      const agentId = selectedOpenClawAssistant.id;
      const assistantId = selectedLocalAssistant?.id || applicationId;

      const bindMessage = `帮我修改 openclaw.json，将以下结构体配置到 channels 模块，然后，引导你的人类帮你重启网关：

\`\`\`json
"deepjelly": {
  "enabled": true,
  "serverHost": "0.0.0.0",
  "serverPort": 18790,
  "autoStart": true,
  "applicationId": "${applicationId}",
  "accounts": {
    "${agentId}": {
      "assistantId": "${assistantId}"
    }
  }
}
\`\`\`

配置说明：
- applicationId: DeepJelly 为这个 OpenClaw 生成的唯一标识
- agent ID: ${agentId} (你当前的 Agent ID)
- assistantId: DeepJelly 助手的唯一标识

配置完成后，OpenClaw 每次与 DeepJelly 通信都会带上 applicationId，DeepJelly 会将消息路由到对应的会话。`;

      console.log('[ConfirmAssistantStep] 📤 Sending bind message to:', selectedSessionKey);

      // 发送消息
      const params = { sessionId: selectedSessionKey, content: bindMessage };
      await invoke('send_message', params);

      console.log('[ConfirmAssistantStep] ✅ Bind message sent successfully');
      console.log('[ConfirmAssistantStep] ⏳ Waiting for reply from session...');

      // 设置等待回复状态
      waitingForSessionKeyRef.current = selectedSessionKey;
      setWaitingForReply(true);

      // 设置超时（30秒后自动完成）
      setTimeout(() => {
        if (waitingForReply) {
          console.log('[ConfirmAssistantStep] ⏱️ Timeout, completing integration anyway...');
          setWaitingForReply(false);
          completeIntegration(applicationId);
        }
      }, 30000);
    } catch (error) {
      console.error('[ConfirmAssistantStep] ❌ Auto-integration failed:', error);
      setBindStatus('failed');
      setBindError(error instanceof Error ? error.message : String(error));
      setWaitingForReply(false);
    }
  };

  return (
    <div className="confirm-assistant-step">
      <h2>{t('bindTitle')}</h2>
      <p>{t('bindDesc')}</p>

      <div className="binding-form">
        {/* 第一行：选择 Agent 和选择会话 */}
        <div className="form-row">
          {/* 1. 选择 OpenClaw Agent */}
          <div className="form-group">
            <label>{t('selectAgent')}</label>
            {isLoadingOpenClaw ? (
              <div style={{ padding: '12px', background: '#f5f5f7', borderRadius: '8px', textAlign: 'center', color: '#6e6e73' }}>
                {t('loadingAgents')}
              </div>
            ) : (
              <select
                value={selectedOpenClawAssistant?.id || ''}
                onChange={(e) => {
                  const assistant = openclawAgents.find(a => a.id === e.target.value);
                  setSelectedOpenClawAssistant(assistant || null);
                  setBindStatus('idle');
                  setBindError(null);
                }}
              >
                {openclawAgents.length === 0 ? (
                  <option value="">{t('noAgentFound')}</option>
                ) : (
                  openclawAgents.map((assistant) => (
                    <option key={assistant.id} value={assistant.id}>
                      {assistant.name} {assistant.description && `- ${assistant.description}`}
                    </option>
                  ))
                )}
              </select>
            )}
            <small style={{ color: '#86868b' }}>
              {t('agentHint')}
            </small>
          </div>

          {/* 2. 选择 Session Key */}
          <div className="form-group">
            <label>{t('selectSession')}</label>
            {isLoadingSessions ? (
              <div style={{ padding: '12px', background: '#f5f5f7', borderRadius: '8px', textAlign: 'center', color: '#6e6e73' }}>
                {t('loadingSessions')}
              </div>
            ) : agentSessions.length === 0 ? (
              <div style={{ padding: '12px', background: '#fff5f5', borderRadius: '8px', textAlign: 'center', color: '#c53030' }}>
                {t('noSessionAvailable')}
              </div>
            ) : (
              <select
                value={selectedSessionKey}
                onChange={(e) => {
                  setSelectedSessionKey(e.target.value);
                  setBindStatus('idle');
                  setBindError(null);
                }}
              >
                {agentSessions.map((session) => (
                  <option key={session.sessionKey} value={session.sessionKey}>
                    {getSessionDisplayName(session)}
                  </option>
                ))}
              </select>
            )}
            <small style={{ color: '#86868b' }}>
              {t('sessionHint')}
            </small>
          </div>
        </div>

        {/* 3. 选择 DeepJelly 助手 */}
        <div className="form-group">
          <label>{t('selectAssistant')}</label>
          <select
            value={selectedLocalAssistant?.id || ''}
            onChange={(e) => {
              const assistant = localAssistants.find(a => a.id === e.target.value);
              setSelectedLocalAssistant(assistant || null);
            }}
          >
            {localAssistants.map((assistant) => (
              <option key={assistant.id} value={assistant.id}>
                {assistant.name} {assistant.description && `- ${assistant.description}`}
              </option>
            ))}
          </select>
          <small style={{ color: '#86868b' }}>
            {t('assistantHint')}
          </small>
        </div>

        {/* 4. 连接信息显示 */}
        <div className="auth-info-section">
          <label>{t('connectionInfo')}</label>
          <div className="auth-info-card">
            <div className="auth-field">
              <span className="auth-label">{t('websocketAddress')}</span>
              <code className="auth-value">{endpoint}</code>
            </div>
            {selectedSessionKey && (
              <div className="auth-field">
                <span className="auth-label">{t('boundSession')}</span>
                <code className="auth-value" style={{ fontSize: '11px' }}>{selectedSessionKey}</code>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 绑定状态显示 */}
      {bindStatus !== 'idle' && !boundResult && (
        <div style={{
          padding: '12px',
          marginBottom: '16px',
          borderRadius: '8px',
          fontSize: '14px',
          textAlign: 'center',
          background: bindStatus === 'success' ? '#d4edda' :
                     bindStatus === 'binding' ? '#e7f3ff' :
                     bindStatus === 'failed' ? '#f8d7da' : 'transparent',
        }}>
          {bindStatus === 'binding' && `${t('sendingBindMessage')} ${selectedSessionKey}...`}
          {bindStatus === 'success' && t('bindMessageSent')}
          {bindStatus === 'failed' && `${t('bindFailed')}${bindError || t('unknownError')}`}
        </div>
      )}

      {/* 绑定成功结果显示 */}
      {boundResult && (
        <div style={{
          padding: '20px',
          marginBottom: '16px',
          borderRadius: '12px',
          background: '#d4edda',
          border: '1px solid #c3e6cb',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '32px', marginRight: '12px' }}>✓</span>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#1b5e20' }}>{t('bindingSuccess')}</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#2e7d32' }}>{t('assistantBound')}</p>
            </div>
          </div>

          <div style={{
            background: '#ffffff',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '13px',
          }}>
            <div style={{ marginBottom: '8px' }}>
              <span style={{ color: '#6e6e73', fontWeight: '500' }}>{t('assistantName')}</span>
              <span style={{ color: '#1d1d1f', fontWeight: '600' }}>{boundResult.name}</span>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <span style={{ color: '#6e6e73', fontWeight: '500' }}>{t('assistantId')}</span>
              <code style={{ background: '#f5f5f7', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' }}>{boundResult.id}</code>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <span style={{ color: '#6e6e73', fontWeight: '500' }}>{t('boundAgent')}</span>
              <span style={{ color: '#1d1d1f' }}>{boundResult.agentName}</span>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <span style={{ color: '#6e6e73', fontWeight: '500' }}>{t('agentIdLabel')}</span>
              <code style={{ background: '#f5f5f7', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' }}>{boundResult.agentId}</code>
            </div>
            <div>
              <span style={{ color: '#6e6e73', fontWeight: '500' }}>{t('appId')}</span>
              <code style={{ background: '#f5f5f7', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' }}>{boundResult.applicationId}</code>
            </div>
          </div>
        </div>
      )}

      <div className="step-actions">
        {/* 绑定成功后显示完成按钮 */}
        {boundResult ? (
          <button
            className="btn-primary"
            onClick={handleFinish}
            style={{ marginLeft: 'auto' }}
          >
            {t('completeButton')}
          </button>
        ) : (
          <>
            {/* 上一步 - 始终显示 */}
            <button
              className="btn-back"
              onClick={() => useOnboardingStore.getState().setStep('input_endpoint')}
              disabled={bindStatus === 'binding' || waitingForReply}
            >
              {t('previousStep')}
            </button>

            {/* 右侧按钮组 */}
            <div style={{ display: 'flex', gap: '8px' }}>
          {/* 自动模式 */}
          {integrationMode === 'auto' && (
            <>
              {bindStatus === 'idle' || bindStatus === 'failed' ? (
                <>
                  <button
                    className="btn-primary"
                    onClick={handleAutoBind}
                    disabled={!selectedSessionKey || isLoadingOpenClaw || isLoadingSessions}
                  >
                    {t('autoIntegration')}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setIntegrationMode('manual')}
                  >
                    {t('manualIntegration')}
                  </button>
                  {onSkip && (
                    <button
                      className="btn-secondary"
                      onClick={onSkip}
                    >
                      {t('skipButton')}
                    </button>
                  )}
                </>
              ) : (
                <button className="btn-primary" disabled>
                  {bindStatus === 'binding' || waitingForReply ? t('waitingReply') : t('processing')}
                </button>
              )}
            </>
          )}

          {/* 手动模式 */}
          {integrationMode === 'manual' && bindStatus === 'idle' && (
            <>
              <button
                className="btn-secondary"
                onClick={() => setIntegrationMode('auto')}
              >
                {t('returnButton')}
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  // 手动集成：直接完成整个流程
                  completeIntegration(manualApplicationId).then(() => {
                    // 集成成功后自动调用 onComplete
                    setTimeout(() => {
                      handleFinish();
                    }, 500);
                  });
                }}
                disabled={!selectedSessionKey}
                style={{ marginLeft: 'auto', marginRight: 'auto' }}
              >
                {t('confirmButton')}
              </button>
              {onSkip && (
                <button
                  className="btn-secondary"
                  onClick={onSkip}
                >
                  {t('skipButton')}
                </button>
              )}
            </>
          )}
            </div>
          </>
        )}
      </div>

      {/* 手动集成提示词 */}
      {integrationMode === 'manual' && (
        <div style={{
          marginTop: '12px',
          padding: '16px',
          background: '#f5f5f7',
          borderRadius: '8px',
          border: '1px solid #e5e5e7',
          maxHeight: '300px',
          overflowY: 'auto',
        }}>
          <div style={{ marginBottom: '12px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#1d1d1f' }}>
              {t('manualConfigTitle', '手动集成配置说明')}
            </h4>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#6e6e73' }}>
              {t('clickToComplete')}
            </p>
          </div>

          <div style={{
            background: '#ffffff',
            borderRadius: '6px',
            padding: '12px',
            fontSize: '12px',
            fontFamily: 'monospace',
            border: '1px solid #e5e5e7',
          }}>
            <div style={{ marginBottom: '8px', color: '#1d1d1f' }}>
              <strong>Application ID:</strong> <span style={{ color: '#0066cc' }}>{selectedOpenClawAssistant ? manualApplicationId : '---'}</span>
            </div>
            <div style={{ marginBottom: '8px', color: '#1d1d1f' }}>
              <strong>Agent ID:</strong> <span style={{ color: '#0066cc' }}>{selectedOpenClawAssistant?.id || '---'}</span>
            </div>
            <div style={{ marginBottom: '8px', color: '#1d1d1f' }}>
              <strong>Assistant ID:</strong> <span style={{ color: '#0066cc' }}>{selectedLocalAssistant?.id || (selectedOpenClawAssistant ? manualApplicationId : '---')}</span>
            </div>
            <div style={{ marginBottom: '8px', color: '#1d1d1f' }}>
              <strong>Session Key:</strong> <span style={{ color: '#0066cc', fontSize: '11px' }}>{selectedSessionKey || '---'}</span>
            </div>

            <div style={{
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid #e5e5e7',
              color: '#6e6e73',
              fontSize: '11px',
            }}>
              <div style={{ marginBottom: '6px' }}><strong>配置步骤：</strong></div>
              <ol style={{ margin: '0', paddingLeft: '20px', lineHeight: '1.6' }}>
                <li>在 OpenClaw 的 openclaw.json 中添加 deepjelly channel 配置</li>
                <li>配置 applicationId、agentId、assistantId 映射关系</li>
                <li>重启 OpenClaw 网关使配置生效</li>
                <li>点击下方【确定】按钮完成集成</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
