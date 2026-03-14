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
import { useIntegrationStore } from '@/stores/integrationStore';
import { useLocaleStore } from '@/stores/localeStore';
import { useCAPMessage } from '@/hooks/useCAPMessage';
import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import type { BoundAssistant, AssistantIntegration, AppIntegration } from '@/types/appConfig';
import type { AnyTypedCAPMessage } from '@/types/cap';
import type { Character } from '@/types/character';
import '@/components/CharacterManagement/styles.css';

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
  integrations?: AssistantIntegration[];
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

// 生成随机应用ID
function generateApplicationId(): string {
  const charset = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

// 生成32位 DeepJelly Token
function generateDeepjellyToken(): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

// 从 WebSocket endpoint 解析 HTTP 端口和地址
function parseHttpConfig(wsEndpoint: string): { host: string; port: number } {
  try {
    // ws://192.168.10.128:18790 -> 192.168.10.128, 18790
    const url = new URL(wsEndpoint);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 12260, // 默认端口
    };
  } catch {
    return { host: '127.0.0.1', port: 12260 };
  }
}

export function ConfirmAssistantStep({ onComplete, onSkip }: ConfirmAssistantStepProps) {
  const { t } = useTranslation('onboarding');
  const { assistants: openclawAgents, getAgents, getAgentSessions, connected, config } = useBrainStore();
  const { endpoint, selectedAppType, setStep } = useOnboardingStore();
  const { addIntegration, currentIntegration } = useAppIntegrationStore();
  const { assistants: localAssistants, addAssistant, updateAssistant, loadAssistants, characters, loadCharacters } = useCharacterManagementStore();
  const { addCharacterIntegration } = useIntegrationStore();
  const { locale } = useLocaleStore();

  // 从 brainStore config 获取 authToken
  const authToken = config?.auth_token || '';

  // 集成模式：'auto' | 'manual'
  const [integrationMode, setIntegrationMode] = useState<'auto' | 'manual'>('auto');
  const [bindStatus, setBindStatus] = useState<'idle' | 'binding' | 'success' | 'failed'>('idle');
  const [bindError, setBindError] = useState<string | null>(null);

  const [selectedOpenClawAssistant, setSelectedOpenClawAssistant] = useState<OpenClawAssistant | null>(null);
  const [selectedSessionKey, setSelectedSessionKey] = useState<string>('');
  const [selectedLocalAssistant, setSelectedLocalAssistant] = useState<LocalAssistant | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [agentSessions, setAgentSessions] = useState<AgentSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingOpenClaw, setIsLoadingOpenClaw] = useState(true);

  // 用于等待回复的标志
  const [waitingForReply, setWaitingForReply] = useState(false);
  const waitingForSessionKeyRef = useRef<string>('');
  const isWaitingRef = useRef(false);
  const completeIntegrationRef = useRef<(applicationId: string) => Promise<void>>(() => Promise.resolve());
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0); // 记录开始等待的时间戳
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const boundAssistantRef = useRef<BoundAssistant | null>(null);
  const autoApplicationIdRef = useRef<string>(''); // 存储自动集成的 applicationId

  // 生成并缓存 applicationId（手动模式使用）
  const manualApplicationId = useMemo(() => generateApplicationId(), []);

  // DeepJelly Token - 进入页面时生成32位随机数
  const [deepjellyToken] = useState(() => generateDeepjellyToken());

  // 提示词折叠状态
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // 🔍 组件挂载时同步获取 currentIntegration 的最新值
  useEffect(() => {
    // Debug: track currentIntegration changes
    void currentIntegration;
  }, [currentIntegration]);

  // 加载 OpenClaw 助手列表
  useEffect(() => {
    const loadOpenClawAgents = async () => {
      setIsLoadingOpenClaw(true);
      try {
        await getAgents();
      } catch (error) {
        console.error('[ConfirmAssistantStep] Failed to load OpenClaw agents:', error);
      } finally {
        setIsLoadingOpenClaw(false);
      }
    };

    loadOpenClawAgents();
  }, [getAgents]);

  // 加载本地预设助手列表
  useEffect(() => {
    const loadLocalAssistants = async () => {
      try {
        await loadAssistants();
      } catch (error) {
        console.error('[ConfirmAssistantStep] ❌ Failed to load local assistants:', error);
      }
    };

    loadLocalAssistants();
  }, [loadAssistants]);

  // 加载本地预设助手（从 store）
  useEffect(() => {
    if (localAssistants.length > 0 && !selectedLocalAssistant) {
      // 重新集成：查找已绑定的本地助手
      if (currentIntegration) {
        const existingAssistant = localAssistants.find(assistant =>
          assistant.integrations?.some(integration =>
            integration.provider === 'openclaw' &&
            integration.params.applicationId === currentIntegration.applicationId
          )
        );
        if (existingAssistant) {
          setSelectedLocalAssistant(existingAssistant);
          return;
        }
      }

      // 首次集成：选择第一个助手
      setSelectedLocalAssistant(localAssistants[0]);
    }
  }, [localAssistants, selectedLocalAssistant, currentIntegration]);

  // 加载选中助手的角色
  useEffect(() => {
    const loadAssistantCharacters = async () => {
      if (selectedLocalAssistant) {
        try {
          await loadCharacters(selectedLocalAssistant.id);
        } catch (error) {
          console.error('[ConfirmAssistantStep] Failed to load characters:', error);
        }
      }
    };

    loadAssistantCharacters();
  }, [selectedLocalAssistant, loadCharacters]);

  // 自动选择第一个角色（首次集成）或回显已选择的角色（重新集成）
  useEffect(() => {
    if (selectedLocalAssistant && characters[selectedLocalAssistant.id]?.length > 0 && !selectedCharacter) {
      // 重新集成：查找已绑定的角色
      if (currentIntegration) {
        const existingAssistant = localAssistants.find(assistant =>
          assistant.integrations?.some(integration =>
            integration.provider === 'openclaw' &&
            integration.params.applicationId === currentIntegration.applicationId &&
            // 找到匹配当前选中助手的记录
            assistant.id === selectedLocalAssistant.id
          )
        );
        if (existingAssistant?.integrations) {
          const openclawIntegration = existingAssistant.integrations.find(i => i.provider === 'openclaw');
          if (openclawIntegration?.params.characterId) {
            const matchedCharacter = characters[selectedLocalAssistant.id].find(c => c.id === openclawIntegration.params.characterId);
            if (matchedCharacter) {
              setSelectedCharacter(matchedCharacter);
              return;
            }
          }
        }
      }

      // 首次集成：选择第一个角色
      const firstCharacter = characters[selectedLocalAssistant.id][0];
      setSelectedCharacter(firstCharacter);
    }
  }, [characters, selectedLocalAssistant, selectedCharacter, currentIntegration, localAssistants]);

  // 默认选择第一个 OpenClaw Agent（首次集成）或回显已选择的 Agent（重新集成）
  useEffect(() => {
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
              setSelectedOpenClawAssistant(matchedAgent);
              return;
            }
          }
        }
      }

      // 首次集成：选择第一个 agent
      const firstAgent = openclawAgents[0];
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
      setIsLoadingSessions(true);
      try {
        const sessions = await getAgentSessions(selectedOpenClawAssistant.id);
        // Check for invalid session keys
        const invalidSessions = sessions.filter((s) => s.sessionKey.includes('undefined'));
        if (invalidSessions.length > 0) {
          console.error('[ConfirmAssistantStep] ❌ Found sessions with "undefined" in key:', invalidSessions);
          console.error('[ConfirmAssistantStep] 💡 This means OpenClaw agents don\'t have proper IDs configured');
        }

        setAgentSessions(sessions as AgentSession[]);

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
              const sessionExists = sessions.find((s) => s.sessionKey === previousSessionKey);
              if (sessionExists) {
                setSelectedSessionKey(previousSessionKey);
                setIsLoadingSessions(false);
                return;
              }
            }
          }
        }

        // 默认选择 main 会话（但跳过包含 undefined 的）
        const validSessions = sessions.filter((s) => !s.sessionKey.includes('undefined'));
        const mainSession = validSessions.find((s) => s.sessionKey.endsWith(':main'));

        if (mainSession) {
          setSelectedSessionKey(mainSession.sessionKey);  // ✅ 使用 sessionKey
        } else if (validSessions.length > 0) {
          setSelectedSessionKey(validSessions[0].sessionKey);  // ✅ 使用 sessionKey
        } else {
          setSelectedSessionKey('');
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
  // 同步 isWaitingRef 到最新状态
  useEffect(() => {
    isWaitingRef.current = waitingForReply;
  }, [waitingForReply]);

  // 创建稳定的 onSession 处理器 - 使用 useCallback 和 ref 避免闭包问题
  const handleSessionMessage = useCallback((message: AnyTypedCAPMessage & { type: 'session' }) => {
    // 如果正在等待回复，检查是否是目标回复
    if (isWaitingRef.current && waitingForSessionKeyRef.current) {
      const messageSessionKey = message.sender.routing?.sessionKey || '';
      const hookType = (message.payload as any).app_params?.hookType;
      // 计算经过的时间
      const elapsedTime = Date.now() - startTimeRef.current;
      // 判断成功条件：
      // 1. routing.sessionKey 匹配
      const sessionKeyMatch = messageSessionKey === waitingForSessionKeyRef.current;

      // 2. 根据时间判断验证策略：
      // - 30秒内：需要 hookType === 'agent_end'
      // - 30秒-2分钟：只要 sessionKey 匹配即可
      const isFirst30Seconds = elapsedTime < 30 * 1000;
      const isAgentEnd = hookType === 'agent_end';
      const shouldAccept = sessionKeyMatch && (!isFirst30Seconds || isAgentEnd);
      if (shouldAccept) {
        setWaitingForReply(false);

        // 清除超时定时器
        if (timeoutIdRef.current) {
          clearTimeout(timeoutIdRef.current);
          timeoutIdRef.current = null;
        }

        // 使用存储的 applicationId（而不是重新生成）
        const applicationIdToUse = autoApplicationIdRef.current || generateApplicationId();
        completeIntegrationRef.current(applicationIdToUse);
      } else {
      }
    } else {
    }
  }, []); // 空依赖数组 - 所有动态值通过 ref 访问

  // 创建稳定的 onBehaviorMental 处理器 - 处理行为/心理消息
  const handleBehaviorMental = useCallback((message: AnyTypedCAPMessage & { type: 'behavior_mental' }) => {
    // 如果正在等待回复，检查是否是目标回复
    if (isWaitingRef.current && waitingForSessionKeyRef.current) {
      const messageSessionKey = message.sender.routing?.sessionKey || '';
      const hookType = (message.payload as any).app_params?.hookType;
      // 新的验证逻辑：
      // 1. 30秒内：只校验 hookType=agent_end + sessionKey 匹配
      // 2. 30秒-2分钟：只校验 sessionKey 匹配
      const sessionKeyMatch = messageSessionKey === waitingForSessionKeyRef.current;
      const elapsedTime = Date.now() - startTimeRef.current;
      const isFirst30Seconds = elapsedTime < 30 * 1000;
      const isAgentEnd = hookType === 'agent_end';
      const shouldAccept = sessionKeyMatch && (!isFirst30Seconds || isAgentEnd);
      if (shouldAccept) {
        setWaitingForReply(false);

        // 清除超时定时器
        if (timeoutIdRef.current) {
          clearTimeout(timeoutIdRef.current);
          timeoutIdRef.current = null;
        }

        // 使用存储的 applicationId（而不是重新生成）
        const applicationIdToUse = autoApplicationIdRef.current || generateApplicationId();
        completeIntegrationRef.current(applicationIdToUse);
      } else {
      }
    } else {
    }
  }, []);

  useCAPMessage({
    onSession: handleSessionMessage,
    onBehaviorMental: handleBehaviorMental,
  });

  // 完成集成的通用逻辑
  const completeIntegration = async (applicationId: string) => {
    if (!selectedSessionKey || !selectedOpenClawAssistant) {
      console.error('[ConfirmAssistantStep] ❌ Missing required info:', {
        hasSelectedSessionKey: !!selectedSessionKey,
        hasSelectedOpenClawAssistant: !!selectedOpenClawAssistant,
      });
      setBindStatus('failed');
      setBindError('缺少必要信息');
      return;
    }

    // 🔥 关键检查：必须有选中的角色
    if (!selectedCharacter) {
      console.error('[ConfirmAssistantStep] ❌ No character selected! Aborting integration.');
      alert('错误：未选择角色，无法完成集成');
      setBindStatus('failed');
      setBindError('未选择角色');
      return;
    }

    try {
      // 直接从 store 获取最新的 currentIntegration
      const store = useAppIntegrationStore.getState();
      const latestCurrentIntegration = store.currentIntegration;
      // 1. 获取集成配置
      let integrationConfig: AppIntegration;

      if (latestCurrentIntegration) {
        // 第三步已创建集成，直接使用
        integrationConfig = latestCurrentIntegration;
        // 如果传进来的 applicationId 与实际的不一致，使用实际的（因为 OpenClaw 收到的是实际的）
        if (applicationId !== integrationConfig.applicationId) {
        }
      } else {
        // 第三步没有创建集成（异常情况），查找或创建
        // 尝试查找匹配的集成
        const existingIntegration = store.integrations.find(i => i.applicationId === applicationId);
        if (existingIntegration) {
          integrationConfig = existingIntegration;
        } else {
          // 创建新集成（最后手段）
          integrationConfig = await addIntegration({
            name: `OpenClaw (${selectedOpenClawAssistant.name})`,
            provider: 'openclaw',
            endpoint: endpoint,
            authToken: authToken,
            deepjellyToken: deepjellyToken, // 保存 DeepJelly Token
            enabled: true,
          });
        }
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

      // 判断是否是重新集成模式：存在匹配的已绑定助手
      const isReintegration = !!existingAssistant;

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
          characters: [],
        });
        boundAssistantId = created.id;
        boundAssistantName = selectedOpenClawAssistant.name;
        boundAssistantDescription = selectedOpenClawAssistant.description;
      }
      setBindStatus('success');

      // 3.5. 创建角色集成绑定（如果选择了角色）
      if (selectedCharacter) {
        try {
          const characterIntegrationData = {
            id: crypto.randomUUID(), // 🔥 必须提供临时 ID，否则后端反序列化会失败
            characterId: selectedCharacter.id,
            characterName: selectedCharacter.name,
            assistantId: boundAssistantId,
            assistantName: boundAssistantName,
            integration: {
              integrationId: integrationConfig.id,
              provider: 'openclaw' as const,
              applicationId: integrationConfig.applicationId,
              agentId: selectedOpenClawAssistant.id,
              params: {
                sessionKeys: [selectedSessionKey],
              },
            },
            enabled: true,
          };
          await addCharacterIntegration(characterIntegrationData);
        } catch (error) {
          console.error('[ConfirmAssistantStep] ❌ Failed to create character integration:', error);
          console.error('[ConfirmAssistantStep] ❌ Error details:', {
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          // 继续执行，角色集成失败不应阻止整个流程
        }
      } else {
        console.warn('[ConfirmAssistantStep] ⚠️ No character selected, skipping character integration');
        console.warn('[ConfirmAssistantStep] ⚠️ Debug info:', {
          charactersAvailable: selectedLocalAssistant ? characters[selectedLocalAssistant.id]?.length || 0 : 0,
          selectedLocalAssistantId: selectedLocalAssistant?.id,
        });
      }

      // 4. Emit event 通知其他窗口刷新
      await emit('onboarding:complete', { integration: integrationConfig });

      // 5. 准备绑定信息
      const boundAssistant = {
        id: boundAssistantId,
        name: boundAssistantName,
        description: boundAssistantDescription,
        integrations: [{
          provider: 'openclaw',
          params: {
            applicationId: integrationConfig.applicationId,
            agentId: selectedOpenClawAssistant.id,
            sessionKeys: [selectedSessionKey],
          },
          enabled: true,
          createdAt: Date.now(),
        }],
      };

      // 6. 提示用户集成成功
      boundAssistantRef.current = boundAssistant;
      setShowSuccessModal(true);
    } catch (error) {
      console.error('[ConfirmAssistantStep] ❌ Failed to complete integration:', error);
      setBindStatus('failed');
      setBindError(error instanceof Error ? error.message : String(error));
    }
  };

  // 成功弹窗确认处理
  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    if (boundAssistantRef.current) {
      onComplete(boundAssistantRef.current);
      boundAssistantRef.current = null;
    }
  };

  // 更新 completeIntegrationRef，确保 onSession 处理器始终能访问最新版本
  useEffect(() => {
    completeIntegrationRef.current = completeIntegration;
  }, [completeIntegration, selectedSessionKey, selectedOpenClawAssistant, selectedCharacter, endpoint, authToken, currentIntegration]);

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

  // 生成用于复制的提示词
  const generateCopyPrompt = useMemo(() => {
    const agentId = selectedOpenClawAssistant?.id || '';
    const assistantId = selectedLocalAssistant?.id || manualApplicationId;
    const characterId = selectedCharacter?.id || selectedLocalAssistant?.id || manualApplicationId;
    const httpConfig = parseHttpConfig(endpoint);

    if (locale === 'en') {
      return `# Task
Help me modify openclaw.json configuration for deepjelly integration. Do it directly as I say, no need to confirm with me.

## Step 1: Configure the following structure to the channels module.
### Configuration notes:
1. \`applicationId\`: Application integration ID (e.g., \`${autoApplicationIdRef.current || manualApplicationId}\`)
2. \`selectedSessionKey\`: Session ID selected in DeepJelly configuration interface, i.e., sessionKey (e.g., \`${selectedSessionKey}\`)
3. \`assistantId\`: Deepjelly assistant ID (e.g., \`${assistantId}\`)
4. \`characterId\`: Deepjelly assistant character ID (e.g., \`${characterId}\`)
5. If the same sessionKey does not exist under deepjelly channel, add \`assistantId\` and \`characterId\` under accounts
6. If the same sessionKey exists under deepjelly channel, overwrite the \`assistantId\` and \`characterId\` for that sessionKey

### Structure
\`\`\`json
"deepjelly": {
  "enabled": true,
  "serverHost": "ENTER_YOUR_LAN_IP_HERE (if value exists, no need to update)",
  "serverPort": 18790,
  "autoStart": true,
  "applicationId": "${autoApplicationIdRef.current || manualApplicationId}",
  "accounts": {
    "${selectedSessionKey}": {
      "assistantId": "${assistantId}",
      "characterId": "${characterId}"
    }
  }
}
\`\`\`

## Step 2: Update the following structure to the bindings module
### Configuration notes
1. \`agentId\`: OpenClaw agentId bound to deepjelly (e.g., \`${agentId}\`)
2. \`channel\`: Fixed as deepjelly
3. If the same \`agentId\` already exists in bindings, no need to update

### Structure
\`\`\`json
{
  "agentId": "${agentId}",
  "match": {
    "channel": "deepjelly"
  }
}
\`\`\`

## Step 3: Remember the following DeepJelly API information
You will need this information when calling DeepJelly's HTTP API:
- DeepJelly API Token: \`${deepjellyToken}\`
- DeepJelly HTTP Address: http://${httpConfig.host}:${httpConfig.port}
- Port: ${httpConfig.port}

Please save this information. When you need to control DeepJelly via HTTP API, use:
- Authorization: Bearer ${deepjellyToken}
- URL: http://${httpConfig.host}:${httpConfig.port}/api/...

## Step 4: Reply to me
After completing and saving the configuration, please reply "Configuration successful" first.
Then execute a command: automatically restart gateway in 20s.
In other words: reply first, then set the command, and finally end.`;
    } else if (locale === 'ja') {
      return `# タスク
openclaw.json設定を変更して、deepjelly統合を行ってください。私の言う通りに直接実行してください、確認は不要です。

## ステップ1：以下の構造をchannelsモジュールに設定してください。
### 設定説明：
1. \`applicationId\`: アプリケーション統合ID（例：\`${autoApplicationIdRef.current || manualApplicationId}\`）
2. \`selectedSessionKey\`: DeepJelly設定画面で選択したセッションID、つまりsessionKey（例：\`${selectedSessionKey}\`）
3. \`assistantId\`: deepjellyアシスタントID（例：\`${assistantId}\`）
4. \`characterId\`: deepjellyアシスタントのキャラクターID（例：\`${characterId}\`）
5. deepjellyチャンネルに同じsessionKeyがない場合、accountsに\`assistantId\`と\`characterId\`を追加してください
6. deepjellyチャンネルに同じsessionKeyがある場合、そのsessionKeyの\`assistantId\`と\`characterId\`を上書きしてください

### 構造
\`\`\`json
"deepjelly": {
  "enabled": true,
  "serverHost": "ここにLAN IPアドレスを入力（既に値がある場合は更新不要）",
  "serverPort": 18790,
  "autoStart": true,
  "applicationId": "${autoApplicationIdRef.current || manualApplicationId}",
  "accounts": {
    "${selectedSessionKey}": {
      "assistantId": "${assistantId}",
      "characterId": "${characterId}"
    }
  }
}
\`\`\`

## ステップ2：以下の構造をbindingsモジュールに更新してください
### 設定説明
1. \`agentId\`: deepjellyにバインドされたOpenClawのagentId（例：\`${agentId}\`）
2. \`channel\`: 固定でdeepjelly
3. bindingsに同じ\`agentId\`が既に存在する場合、更新は不要です

### 構造
\`\`\`json
{
  "agentId": "${agentId}",
  "match": {
    "channel": "deepjelly"
  }
}
\`\`\`

## ステップ3：以下のDeepJelly API情報を記憶してください
DeepJellyのHTTP APIを呼び出す際にこの情報が必要です：
- DeepJelly APIトークン: \`${deepjellyToken}\`
- DeepJelly HTTPアドレス: http://${httpConfig.host}:${httpConfig.port}
- ポート: ${httpConfig.port}

この情報を保存してください。HTTP API経由でDeepJellyを制御する場合は、以下を使用します：
- Authorization: Bearer ${deepjellyToken}
- URL: http://${httpConfig.host}:${httpConfig.port}/api/...

## ステップ4：返信してください
設定の保存が完了したら、まず「設定成功」と返信してください。
その後、コマンドを実行してください：20秒後にgatewayを自動的に再起動します。
つまり、まず返信し、次にコマンドを設定し、最後に終了します。`;
    } else {
      // 中文（默认）
      return `# 任务
帮我修改 openclaw.json 配置，用于集成deepjelly。按我说的直接做，无需再向我确认。

## 步骤1：将以下结构体配置到 channels 模块。
### 配置说明：
1. \`applicationId\`: 应用集成的 ID（如 \`${autoApplicationIdRef.current || manualApplicationId}\`）
2. \`selectedSessionKey\`: 我在 deepJelly 配置界面选中的会话 ID，即 sessionKey （如 \`${selectedSessionKey}\`）
3. \`assistantId\`: deepjelly助手的 ID（如 \`${assistantId}\`）
4. \`characterId\`: deepjelly助手的角色 ID（如 \`${characterId}\`）
5. 如果 deepjelly channel 下没有相同的 sessionKey ，你就在 accounts 下新增 \`assistantId\` 和 \`characterId\`
6. 如果 deepjelly channel 下存在相同的 sessionKey ，你就将本次输入的 \`assistantId\` 和 \`characterId\` 覆盖对应  sessionKey 的 accounts

### 结构体
\`\`\`json
"deepjelly": {
  "enabled": true,
  "serverHost": "将你的局域网ip地址填写到此，如果存在值，不必更新",
  "serverPort": 18790,
  "autoStart": true,
  "applicationId": "${autoApplicationIdRef.current || manualApplicationId}",
  "accounts": {
    "${selectedSessionKey}": {
      "assistantId": "${assistantId}",
      "characterId": "${characterId}"
    }
  }
}
\`\`\`

##  步骤2：将以下结构体更新到 bindings 模块
### 配置说明
1. \`agentId\`：openclaw 与 deepjelly 绑定的agentId（如 \`${agentId}\`）
2. \`channel\`：固定是deepjelly
3. 如果 bindings 里，已经存在相同\`agentId\`，则无需更新

### 结构体
\`\`\`json
{
  "agentId": "${agentId}",
  "match": {
    "channel": "deepjelly"
  }
}
\`\`\`

## 步骤3：记住以下 DeepJelly API 信息
你在调用 DeepJelly 的 HTTP API 时需要这些信息：
- DeepJelly API 令牌: \`${deepjellyToken}\`
- DeepJelly HTTP 地址: http://${httpConfig.host}:${httpConfig.port}
- 端口: ${httpConfig.port}

请保存这些信息。当你需要通过 HTTP API 控制 DeepJelly 时，使用：
- Authorization: Bearer ${deepjellyToken}
- URL: http://${httpConfig.host}:${httpConfig.port}/api/...

## 步骤4：回复我
保存完成配置后，请务必先向我回复配置成功。
然后再执行一个命令：20s后自动重启gateway。
也就是，先回复我，再设置命令，最后结束。`;
    }
  }, [locale, selectedOpenClawAssistant, selectedLocalAssistant, selectedCharacter, selectedSessionKey, endpoint, deepjellyToken, manualApplicationId, t]);

  // 复制提示词处理
  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(generateCopyPrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch (error) {
      console.error('[ConfirmAssistantStep] Copy failed:', error);
    }
  };

  // 自动集成
  const handleAutoBind = async () => {
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

    // 🔥 关键检查：必须有选中的角色
    if (!selectedCharacter) {
      console.error('[ConfirmAssistantStep] ❌ No character selected!');
      alert('请先选择一个角色');
      setBindStatus('failed');
      setBindError('未选择角色');
      return;
    }
    setBindStatus('binding');
    setBindError(null);

    try {
      // 直接从 store 获取最新的 currentIntegration
      const store = useAppIntegrationStore.getState();
      const latestCurrentIntegration = store.currentIntegration;
      // 生成或复用 applicationId
      let applicationId: string;
      if (latestCurrentIntegration) {
        // 第三步已创建集成，使用其 applicationId
        applicationId = latestCurrentIntegration.applicationId;
      } else {
        // 异常情况：第三步没有创建集成（不应该发生）
        applicationId = generateApplicationId();
      }
      // 存储到 ref，确保处理器使用同一个 ID
      autoApplicationIdRef.current = applicationId;

      const agentId = selectedOpenClawAssistant.id;
      const assistantId = selectedLocalAssistant?.id || applicationId;

      const characterId = selectedCharacter?.id || assistantId;

      // 解析 HTTP 配置
      const httpConfig = parseHttpConfig(endpoint);

      // 根据语言生成不同的集成消息
      let bindMessage: string;

      if (locale === 'en') {
        bindMessage = `# Task
Help me modify openclaw.json configuration for deepjelly integration. Do it directly as I say, no need to confirm with me.

## Step 1: Configure the following structure to the channels module.
### Configuration notes:
1. \`applicationId\`: Application integration ID (e.g., \`${applicationId}\`)
2. \`selectedSessionKey\`: Session ID selected in DeepJelly configuration interface, i.e., sessionKey (e.g., \`${selectedSessionKey}\`)
3. \`assistantId\`: Deepjelly assistant ID (e.g., \`${assistantId}\`)
4. \`characterId\`: Deepjelly assistant character ID (e.g., \`${characterId}\`)
5. If the same sessionKey does not exist under deepjelly channel, add \`assistantId\` and \`characterId\` under accounts
6. If the same sessionKey exists under deepjelly channel, overwrite the \`assistantId\` and \`characterId\` for that sessionKey

### Structure
\`\`\`json
"deepjelly": {
  "enabled": true,
  "serverHost": "ENTER_YOUR_LAN_IP_HERE (if value exists, no need to update)",
  "serverPort": 18790,
  "autoStart": true,
  "applicationId": "${applicationId}",
  "accounts": {
    "${selectedSessionKey}": {
      "assistantId": "${assistantId}",
      "characterId": "${characterId}"
    }
  }
}
\`\`\`

## Step 2: Update the following structure to the bindings module
### Configuration notes
1. \`agentId\`: OpenClaw agentId bound to deepjelly (e.g., \`${agentId}\`)
2. \`channel\`: Fixed as deepjelly
3. If the same \`agentId\` already exists in bindings, no need to update

### Structure
\`\`\`json
{
  "agentId": "${agentId}",
  "match": {
    "channel": "deepjelly"
  }
}
\`\`\`

## Step 3: Remember the following DeepJelly API information
You will need this information when calling DeepJelly's HTTP API:
- DeepJelly API Token: \`${deepjellyToken}\`
- DeepJelly HTTP Address: http://${httpConfig.host}:${httpConfig.port}
- Port: ${httpConfig.port}

Please save this information. When you need to control DeepJelly via HTTP API, use:
- Authorization: Bearer ${deepjellyToken}
- URL: http://${httpConfig.host}:${httpConfig.port}/api/...

## Step 4: Reply to me
After completing and saving the configuration, please reply "Configuration successful" first.
Then execute a command: automatically restart gateway in 20s.
In other words: reply first, then set the command, and finally end.`;
      } else if (locale === 'ja') {
        bindMessage = `# タスク
openclaw.json設定を変更して、deepjelly統合を行ってください。私の言う通りに直接実行してください、確認は不要です。

## ステップ1：以下の構造をchannelsモジュールに設定してください。
### 設定説明：
1. \`applicationId\`: アプリケーション統合ID（例：\`${applicationId}\`）
2. \`selectedSessionKey\`: DeepJelly設定画面で選択したセッションID、つまりsessionKey（例：\`${selectedSessionKey}\`）
3. \`assistantId\`: deepjellyアシスタントID（例：\`${assistantId}\`）
4. \`characterId\`: deepjellyアシスタントのキャラクターID（例：\`${characterId}\`）
5. deepjellyチャンネルに同じsessionKeyがない場合、accountsに\`assistantId\`と\`characterId\`を追加してください
6. deepjellyチャンネルに同じsessionKeyがある場合、そのsessionKeyの\`assistantId\`と\`characterId\`を上書きしてください

### 構造
\`\`\`json
"deepjelly": {
  "enabled": true,
  "serverHost": "ここにLAN IPアドレスを入力（既に値がある場合は更新不要）",
  "serverPort": 18790,
  "autoStart": true,
  "applicationId": "${applicationId}",
  "accounts": {
    "${selectedSessionKey}": {
      "assistantId": "${assistantId}",
      "characterId": "${characterId}"
    }
  }
}
\`\`\`

## ステップ2：以下の構造をbindingsモジュールに更新してください
### 設定説明
1. \`agentId\`: deepjellyにバインドされたOpenClawのagentId（例：\`${agentId}\`）
2. \`channel\`: 固定でdeepjelly
3. bindingsに同じ\`agentId\`が既に存在する場合、更新は不要です

### 構造
\`\`\`json
{
  "agentId": "${agentId}",
  "match": {
    "channel": "deepjelly"
  }
}
\`\`\`

## ステップ3：以下のDeepJelly API情報を記憶してください
DeepJellyのHTTP APIを呼び出す際にこの情報が必要です：
- DeepJelly APIトークン: \`${deepjellyToken}\`
- DeepJelly HTTPアドレス: http://${httpConfig.host}:${httpConfig.port}
- ポート: ${httpConfig.port}

この情報を保存してください。HTTP API経由でDeepJellyを制御する場合は、以下を使用します：
- Authorization: Bearer ${deepjellyToken}
- URL: http://${httpConfig.host}:${httpConfig.port}/api/...

## ステップ4：返信してください
設定の保存が完了したら、まず「設定成功」と返信してください。
その後、コマンドを実行してください：20秒後にgatewayを自動的に再起動します。
つまり、まず返信し、次にコマンドを設定し、最後に終了します。`;
      } else {
        // 中文（默认）
        bindMessage = `# 任务
帮我修改 openclaw.json 配置，用于集成deepjelly。按我说的直接做，无需再向我确认。

## 步骤1：将以下结构体配置到 channels 模块。
### 配置说明：
1. \`applicationId\`: 应用集成的 ID（如 \`${applicationId}\`）
2. \`selectedSessionKey\`: 我在 deepJelly 配置界面选中的会话 ID，即 sessionKey （如 \`${selectedSessionKey}\`）
3. \`assistantId\`: deepjelly助手的 ID（如 \`${assistantId}\`）
4. \`characterId\`: deepjelly助手的角色 ID（如 \`${characterId}\`）
5. 如果 deepjelly channel 下没有相同的 sessionKey ，你就在 accounts 下新增 \`assistantId\` 和 \`characterId\`
6. 如果 deepjelly channel 下存在相同的 sessionKey ，你就将本次输入的 \`assistantId\` 和 \`characterId\` 覆盖对应  sessionKey 的 accounts

### 结构体
\`\`\`json
"deepjelly": {
  "enabled": true,
  "serverHost": "将你的局域网ip地址填写到此，如果存在值，不必更新",
  "serverPort": 18790,
  "autoStart": true,
  "applicationId": "${applicationId}",
  "accounts": {
    "${selectedSessionKey}": {
      "assistantId": "${assistantId}",
      "characterId": "${characterId}"
    }
  }
}
\`\`\`

##  步骤2：将以下结构体更新到 bindings 模块
### 配置说明
1. \`agentId\`：openclaw 与 deepjelly 绑定的agentId（如 \`${agentId}\`）
2. \`channel\`：固定是deepjelly
3. 如果 bindings 里，已经存在相同\`agentId\`，则无需更新

### 结构体
\`\`\`json
{
  "agentId": "${agentId}",
  "match": {
    "channel": "deepjelly"
  }
}
\`\`\`

## 步骤3：记住以下 DeepJelly API 信息
你在调用 DeepJelly 的 HTTP API 时需要这些信息：
- DeepJelly API 令牌: \`${deepjellyToken}\`
- DeepJelly HTTP 地址: http://${httpConfig.host}:${httpConfig.port}
- 端口: ${httpConfig.port}

请保存这些信息。当你需要通过 HTTP API 控制 DeepJelly 时，使用：
- Authorization: Bearer ${deepjellyToken}
- URL: http://${httpConfig.host}:${httpConfig.port}/api/...

## 步骤4：回复我
保存完成配置后，请务必先向我回复配置成功。
然后再执行一个命令：20s后自动重启gateway。
也就是，先回复我，再设置命令，最后结束。`;
      }
      // ⚠️ 关键：必须在发送消息之前设置等待状态！
      // 因为 OpenClaw 可能在 invoke 返回之前就发送回复
      waitingForSessionKeyRef.current = selectedSessionKey;
      isWaitingRef.current = true;
      startTimeRef.current = Date.now(); // 记录开始等待的时间戳
      setWaitingForReply(true);
      // 清除之前的超时（如果有）
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }

      // 设置超时（2分钟后超时失败）
      timeoutIdRef.current = setTimeout(() => {
        if (isWaitingRef.current) {
          setWaitingForReply(false);
          setBindStatus('failed');
          setBindError('自动集成超时（2分钟未收到回复），请检查网络连接后重新点击【自动集成】按钮');
        }
        timeoutIdRef.current = null;
      }, 120000);

      // 现在发送消息
      const params = { sessionId: selectedSessionKey, content: bindMessage };
      await invoke('send_message', params);
    } catch (error) {
      console.error('[ConfirmAssistantStep] ❌ Auto-integration failed:', error);
      setBindStatus('failed');
      setBindError(error instanceof Error ? error.message : String(error));
      setWaitingForReply(false);
    }
  };

  return (
    <div className="confirm-assistant-step">
      <div className="step-content-wrapper">
        <h2>{t('selectCharacterTitle', '选择角色')}</h2>
        <p>{t('selectCharacterDesc', '选择应用和角色，完成集成配置')}</p>

        <div className="binding-form">
          {/* 0. 提示词折叠区域 (第一个字段) */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <div style={{
              background: '#f5f5f7',
              borderRadius: '8px',
              border: '1px solid #e5e5e7',
              overflow: 'hidden',
            }}>
              {/* 折叠标题栏 */}
              <div
                onClick={() => setPromptExpanded(!promptExpanded)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  userSelect: 'none',
                }}
              >
                <span style={{ fontWeight: '500', color: '#1d1d1f' }}>
                  📋 {t('integrationPromptTitle', '集成配置提示词')}
                </span>
                <span style={{ fontSize: '12px', color: '#6e6e73' }}>
                  {promptExpanded ? '▼' : '▶'}
                </span>
              </div>

              {/* 折叠内容 */}
              {promptExpanded && (
                <div style={{
                  padding: '16px',
                  borderTop: '1px solid #e5e5e7',
                  background: '#ffffff',
                }}>
                  {/* DeepJelly Token 显示 */}
                  <div style={{
                    marginBottom: '12px',
                    padding: '10px 12px',
                    background: '#f0f9ff',
                    borderRadius: '6px',
                    border: '1px solid #bae6fd',
                    fontSize: '12px',
                  }}>
                    <div style={{ fontWeight: '600', color: '#0369a1', marginBottom: '4px' }}>
                      🔑 DeepJelly API Token
                    </div>
                    <div style={{
                      fontFamily: 'monospace',
                      color: '#0c4a6e',
                      wordBreak: 'break-all',
                      fontSize: '11px',
                    }}>
                      {deepjellyToken}
                    </div>
                  </div>

                  {/* HTTP 配置信息 */}
                  {(() => {
                    const httpConfig = parseHttpConfig(endpoint);
                    return (
                      <div style={{
                        marginBottom: '12px',
                        padding: '10px 12px',
                        background: '#fef3c7',
                        borderRadius: '6px',
                        border: '1px solid #fde68a',
                        fontSize: '12px',
                      }}>
                        <div style={{ fontWeight: '600', color: '#92400e', marginBottom: '4px' }}>
                          🌐 DeepJelly HTTP API
                        </div>
                        <div style={{ color: '#78350f', fontSize: '11px', lineHeight: '1.6' }}>
                          <div>地址: http://{httpConfig.host}:{httpConfig.port}</div>
                          <div>端口: {httpConfig.port}</div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 提示词预览 */}
                  <div style={{
                    background: '#1e1e1e',
                    borderRadius: '6px',
                    padding: '12px',
                    maxHeight: '300px',
                    overflow: 'auto',
                  }}>
                    <pre style={{
                      margin: 0,
                      fontSize: '11px',
                      color: '#d4d4d4',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}>{generateCopyPrompt}</pre>
                  </div>

                  {/* 复制提示词按钮 */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyPrompt();
                    }}
                    style={{
                      marginTop: '12px',
                      width: '100%',
                      padding: '10px 16px',
                      background: copiedPrompt ? '#22c55e' : '#007aff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    {copiedPrompt ? (
                      <>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                          <path d="M13.33 4.67l-8 8M5.33 12.67l8-8" />
                        </svg>
                        {t('copied', '已复制')}
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                          <rect x="3" y="5" width="10" height="8" rx="1" />
                          <path d="M5.5 5V3.5a2.5 2.5 0 0 1 5 0V5" />
                        </svg>
                        {t('copyPrompt', '复制提示词')}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 1. 选择应用 (只读，显示当前集成) */}
          <div className="form-group">
            <label>{t('selectApplication', '选择应用')}</label>
            <div style={{
              padding: '12px',
              background: '#f5f5f7',
              borderRadius: '8px',
              color: '#1d1d1f',
              fontWeight: '500',
              border: '1px solid #e5e5e7',
              cursor: 'not-allowed',
            }}>
              {currentIntegration?.name || (selectedAppType === 'openclaw' ? 'OpenClaw' : 'Application')}
              {currentIntegration?.description && <span style={{ color: '#6e6e73', marginLeft: '8px' }}>({currentIntegration.description})</span>}
            </div>
            <small style={{ color: '#86868b' }}>
              {t('applicationReadOnlyHint', '通过集成引导流程自动设置，不可修改')}
            </small>
          </div>

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
                      <option key={assistant.id} value={assistant.id} title={`${assistant.name}${assistant.description ? ` - ${assistant.description}` : ''}`}>
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
                    <option key={session.sessionKey} value={session.sessionKey} title={getSessionDisplayName(session)}>
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
                setSelectedCharacter(null); // 重置角色选择
              }}
            >
              {localAssistants.map((assistant) => (
                <option key={assistant.id} value={assistant.id} title={`${assistant.name}${assistant.description ? ` - ${assistant.description}` : ''}`}>
                  {assistant.name} {assistant.description && `- ${assistant.description}`}
                </option>
              ))}
            </select>
            <small style={{ color: '#86868b' }}>
              {t('assistantHint')}
            </small>
          </div>

          {/* 4. 选择角色 */}
          <div className="form-group">
            <label>{t('selectCharacter')}</label>
            {!selectedLocalAssistant ? (
              <div style={{ padding: '12px', background: '#f5f5f7', borderRadius: '8px', textAlign: 'center', color: '#6e6e73' }}>
                {t('pleaseSelectAssistant')}
              </div>
            ) : !characters[selectedLocalAssistant.id] || characters[selectedLocalAssistant.id].length === 0 ? (
              <div style={{ padding: '12px', background: '#fff5f5', borderRadius: '8px', textAlign: 'center', color: '#c53030' }}>
                {t('noAssistantCharacters')}
              </div>
            ) : (
              <select
                value={selectedCharacter?.id || ''}
                onChange={(e) => {
                  const character = characters[selectedLocalAssistant.id].find(c => c.id === e.target.value);
                  setSelectedCharacter(character || null);
                }}
              >
                {characters[selectedLocalAssistant.id].map((character) => (
                  <option key={character.id} value={character.id} title={`${character.name}${character.description ? ` - ${character.description}` : ''}`}>
                    {character.name} {character.description && `- ${character.description}`}
                  </option>
                ))}
              </select>
            )}
            <small style={{ color: '#86868b' }}>
              {t('characterHint')}
            </small>
            {/* 角色选择状态提示 */}
            {selectedLocalAssistant && characters[selectedLocalAssistant.id] && characters[selectedLocalAssistant.id].length > 0 && (
              <div style={{
                marginTop: '8px',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                background: selectedCharacter ? '#d4edda' : '#fff3cd',
                color: selectedCharacter ? '#155724' : '#856404',
                border: `1px solid ${selectedCharacter ? '#c3e6cb' : '#ffeaa7'}`,
              }}>
                {selectedCharacter ? (
                  <span>✅ 已选择角色: <strong>{selectedCharacter.name}</strong></span>
                ) : (
                  <span>⚠️ 请选择一个角色以继续集成</span>
                )}
              </div>
            )}
          </div>

          {/* 5. 连接信息显示 */}
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
        {bindStatus !== 'idle' && (
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

        {/* 手动集成配置说明 - 移到内容区 */}
        {integrationMode === 'manual' && (
          <div style={{
            marginTop: '16px',
            padding: '16px',
            background: '#f5f5f7',
            borderRadius: '8px',
            border: '1px solid #e5e5e7',
          }}>
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#1d1d1f' }}>
                {t('manualConfigTitle', '手动集成配置说明')}
              </h4>
              <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#6e6e73' }}>
                {t('manualConfigDesc', '请按照以下步骤手动配置 OpenClaw，然后点击【确定】完成集成')}
              </p>
            </div>

            {/* 关键信息 */}
            <div style={{
              background: '#ffffff',
              borderRadius: '6px',
              padding: '12px',
              fontSize: '12px',
              fontFamily: 'monospace',
              border: '1px solid #e5e5e7',
              marginBottom: '12px',
            }}>
              <div style={{ marginBottom: '8px', color: '#1d1d1f' }}>
                <strong>{t('applicationId')}:</strong> <span style={{ color: '#0066cc' }}>{selectedOpenClawAssistant ? manualApplicationId : '---'}</span>
              </div>
              <div style={{ marginBottom: '8px', color: '#1d1d1f' }}>
                <strong>{t('agentId')}:</strong> <span style={{ color: '#0066cc' }}>{selectedOpenClawAssistant?.id || '---'}</span>
              </div>
              <div style={{ marginBottom: '8px', color: '#1d1d1f' }}>
                <strong>{t('assistantId')}:</strong> <span style={{ color: '#0066cc' }}>{selectedLocalAssistant?.id || (selectedOpenClawAssistant ? manualApplicationId : '---')}</span>
              </div>
              <div style={{ marginBottom: '8px', color: '#1d1d1f' }}>
                <strong>角色ID:</strong> <span style={{ color: '#0066cc' }}>{selectedCharacter?.id || (selectedLocalAssistant?.id || (selectedOpenClawAssistant ? manualApplicationId : '---'))}</span>
              </div>
              <div style={{ color: '#1d1d1f' }}>
                <strong>{t('sessionKey')}:</strong> <span style={{ color: '#0066cc', fontSize: '11px' }}>{selectedSessionKey || '---'}</span>
              </div>
            </div>

            {/* 配置说明 */}
            <div style={{
              background: '#ffffff',
              borderRadius: '6px',
              padding: '12px',
              fontSize: '11px',
              border: '1px solid #e5e5e7',
              marginBottom: '12px',
            }}>
              <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#1d1d1f' }}>
                {t('configSteps', '配置步骤')}:
              </div>
              <ol style={{ margin: '0', paddingLeft: '20px', lineHeight: '1.8', color: '#6e6e73' }}>
                <li>{t('step1', '打开 OpenClaw 的配置文件 openclaw.json')}</li>
                <li>{t('step2', '在 channels 模块中添加 deepjelly channel 配置（见下方示例）')}</li>
                <li>{t('step2b', '在 bindings 模块中添加 agent 与 deepjelly 的绑定配置（见下方示例）')}</li>
                <li>{t('step3', '根据你的部署场景选择配置（本地开发或局域网部署）')}</li>
                <li>{t('step4', '保存配置文件')}</li>
                <li>{t('step5', '重启 OpenClaw 网关使配置生效')}</li>
                <li>{t('step6', '点击下方【确定】按钮完成集成')}</li>
              </ol>
            </div>

            {/* 本地开发配置 */}
            <div style={{
              background: '#ffffff',
              borderRadius: '6px',
              padding: '12px',
              fontSize: '11px',
              border: '1px solid #e5e5e7',
              marginBottom: '12px',
            }}>
              <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#1d1d1f' }}>
                {t('localDev', '本地开发（同一台机器）')}:
              </div>
              <div style={{ marginBottom: '4px', color: '#6e6e73' }}>
                <strong>{t('firewall')}:</strong> {t('noFirewallNeeded', '无需配置')}
              </div>
              <div style={{ marginBottom: '4px', color: '#6e6e73' }}>
                <strong>{t('connectionEndpoint')}:</strong> ws://127.0.0.1:18790
              </div>
              <pre style={{
                margin: '8px 0 0 0',
                padding: '8px',
                background: '#1e1e1e',
                color: '#d4d4d4',
                borderRadius: '4px',
                fontSize: '10px',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>{`{
  "channels": {
    "deepjelly": {
      "enabled": true,
      "serverHost": "127.0.0.1",
      "serverPort": 18790,
      "autoStart": true,
      "applicationId": "${selectedOpenClawAssistant ? manualApplicationId : '...'}",
      "accounts": {
        "${selectedOpenClawAssistant?.id || 'agent-id'}": {
          "assistantId": "${selectedLocalAssistant?.id || (selectedOpenClawAssistant ? manualApplicationId : '...')}",
          "characterId": "${selectedCharacter?.id || (selectedLocalAssistant?.id || (selectedOpenClawAssistant ? manualApplicationId : '...'))}",
          "characterName": "${selectedCharacter?.name || '默认角色'}"
        }
      }
    }
  },
  "bindings": [
    {
      "agentId": "${selectedOpenClawAssistant?.id || 'agent-id'}",
      "match": {
        "channel": "deepjelly"
      }
    }
  ]
}`}</pre>
            </div>

            {/* 局域网部署配置 */}
            <div style={{
              background: '#ffffff',
              borderRadius: '6px',
              padding: '12px',
              fontSize: '11px',
              border: '1px solid #e5e5e7',
            }}>
              <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: 'bold', color: '#1d1d1f' }}>
                {t('lanDeploy', '局域网部署（不同机器）')}:
              </div>
              <div style={{ marginBottom: '4px', color: '#6e6e73' }}>
                <strong>{t('firewall')}:</strong> {t('firewallDesc', '需要允许 18790 端口入站连接')}
              </div>
              <div style={{ marginBottom: '4px', color: '#6e6e73' }}>
                <strong>{t('connectionEndpoint')}:</strong> ws://{'<OpenClaw_IP>'}:18790
              </div>
              <pre style={{
                margin: '8px 0 0 0',
                padding: '8px',
                background: '#1e1e1e',
                color: '#d4d4d4',
                borderRadius: '4px',
                fontSize: '10px',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>{`{
  "channels": {
    "deepjelly": {
      "enabled": true,
      "serverHost": "0.0.0.0",
      "serverPort": 18790,
      "autoStart": true,
      "applicationId": "${selectedOpenClawAssistant ? manualApplicationId : '...'}",
      "accounts": {
        "${selectedOpenClawAssistant?.id || 'agent-id'}": {
          "assistantId": "${selectedLocalAssistant?.id || (selectedOpenClawAssistant ? manualApplicationId : '...')}",
          "characterId": "${selectedCharacter?.id || (selectedLocalAssistant?.id || (selectedOpenClawAssistant ? manualApplicationId : '...'))}",
          "characterName": "${selectedCharacter?.name || '默认角色'}"
        }
      }
    }
  },
  "bindings": [
    {
      "agentId": "${selectedOpenClawAssistant?.id || 'agent-id'}",
      "match": {
        "channel": "deepjelly"
      }
    }
  ]
}`}</pre>
            </div>
          </div>
        )}
      </div>

      <div className="step-actions">
        {/* 上一步 - 始终可用，点击时清理状态 */}
        <button
          className="btn-back"
          onClick={() => {
            // 清理等待状态
            if (waitingForReply) {
              setWaitingForReply(false);
              waitingForSessionKeyRef.current = '';
            }
            // 重置绑定状态
            setBindStatus('idle');
            setBindError(null);
            // 返回上一步
            setStep('input_endpoint');
          }}
        >
          {t('previousStep')}
        </button>

        {/* 右侧按钮组 */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* 复制提示词按钮 - 在所有模式下都显示 */}
          <button
            className="btn-secondary"
            onClick={handleCopyPrompt}
            disabled={!selectedSessionKey}
            title={t('copyPromptHint', '复制集成配置提示词')}
          >
            {copiedPrompt ? `✓ ${t('copied', '已复制')}` : `📋 ${t('copyPrompt', '复制提示词')}`}
          </button>

          {/* 自动模式 */}
          {integrationMode === 'auto' && (
            <>
              {bindStatus === 'idle' || bindStatus === 'failed' ? (
                <>
                  <button
                    className="btn-primary"
                    onClick={handleAutoBind}
                    disabled={!selectedSessionKey || !selectedCharacter || isLoadingOpenClaw || isLoadingSessions}
                  >
                    {t('autoIntegration')}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setIntegrationMode('manual')}
                    disabled={!selectedCharacter}
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
                  // 手动集成：使用 Step 3 创建的 applicationId（如果存在）
                  const store = useAppIntegrationStore.getState();
                  const latestCurrentIntegration = store.currentIntegration;
                  const applicationIdToUse = latestCurrentIntegration?.applicationId || manualApplicationId;
                  completeIntegration(applicationIdToUse);
                }}
                disabled={!selectedSessionKey || !selectedCharacter}
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
      </div>

      {/* 成功弹窗 */}
      {showSuccessModal && (
        <div className="modal-overlay">
          <div className="assistant-modal-content" style={{ width: '380px' }}>
            {/* Header */}
            <div className="modal-header-mac">
              <div className="modal-title">集成成功</div>
              <button className="modal-close-btn" onClick={handleSuccessModalClose}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="modal-body-mac">
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  margin: '0 auto 16px',
                  borderRadius: '50%',
                  background: 'var(--dj-success-bg, rgba(34, 197, 94, 0.1))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{
                    width: '32px',
                    height: '32px',
                    color: 'var(--dj-success, #22c55e)',
                  }}>
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3 style={{
                  margin: '0 0 8px',
                  fontSize: '18px',
                  fontWeight: '600',
                  color: 'var(--dj-text-primary, #1d1d1f)',
                }}>
                  OpenClaw 集成成功！
                </h3>
                <p style={{
                  margin: '0',
                  fontSize: '14px',
                  color: 'var(--dj-text-secondary, #6e6e73)',
                  lineHeight: '1.5',
                }}>
                  已成功连接到 OpenClaw，现在可以开始使用角色助对话功能了。
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="modal-footer-mac">
              <button className="btn-mac btn-mac-primary" onClick={handleSuccessModalClose} style={{ width: '100%' }}>
                开始使用
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
