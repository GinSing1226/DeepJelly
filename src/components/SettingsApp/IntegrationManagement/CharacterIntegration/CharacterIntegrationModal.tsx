/**
 * Character Integration Modal
 *
 * Meta-Name: Character Integration Modal
 * Meta-Description: Modal for adding/editing character integration bindings, reusing ConfirmAssistantStep UI and logic
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Assistant, Character } from '@/types/character';
import type { AppIntegration, CharacterIntegration } from '@/types/character';
import type { CreateCharacterIntegrationDTO, UpdateCharacterIntegrationDTO } from '@/stores/integrationStore';
import { useBrainStore, SessionInfo } from '@/stores/brainStore';
import { useCharacterManagementStore } from '@/stores/characterManagementStore';
import { useCAPMessage } from '@/hooks/useCAPMessage';
import type { AnyTypedCAPMessage } from '@/types/cap';
import './CharacterIntegrationModal.css';

export interface CharacterIntegrationModalProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 编辑模式：传递要编辑的数据 */
  integration?: CharacterIntegration;
  /** 助手列表 */
  assistants: Assistant[];
  /** 应用集成列表 */
  appIntegrations: AppIntegration[];
  /** 已有的角色集成列表（用于校验） */
  existingIntegrations?: CharacterIntegration[];
  /** 关闭回调 */
  onClose: () => void;
  /** 保存回调 */
  onSave: (data: CreateCharacterIntegrationDTO | UpdateCharacterIntegrationDTO) => Promise<void>;
}

interface OpenClawAssistant {
  id: string;
  name: string;
  description?: string;
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

// 从 WebSocket endpoint 解析 HTTP 端口和地址
function parseHttpConfig(wsEndpoint: string): { host: string; port: number } {
  try {
    const url = new URL(wsEndpoint);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 12260,
    };
  } catch {
    return { host: '127.0.0.1', port: 12260 };
  }
}

export function CharacterIntegrationModal({
  isOpen,
  integration,
  assistants,
  appIntegrations,
  existingIntegrations = [],
  onClose,
  onSave,
}: CharacterIntegrationModalProps) {
  const { t } = useTranslation(['settings', 'common', 'onboarding']);
  const isEditMode = !!integration;

  // Brain Store for OpenClaw integration
  const { assistants: openclawAgents, getAgents, getAgentSessions, connected, connect } = useBrainStore();
  const { loadAssistants, characters, loadCharacters, updateAssistant } = useCharacterManagementStore();

  // 集成模式：'auto' | 'manual'
  const [integrationMode, setIntegrationMode] = useState<'auto' | 'manual'>('auto');
  const [bindStatus, setBindStatus] = useState<'idle' | 'binding' | 'success' | 'failed'>('idle');
  const [bindError, setBindError] = useState<string | null>(null);

  const [selectedAppIntegrationId, setSelectedAppIntegrationId] = useState('');
  const [selectedOpenClawAssistant, setSelectedOpenClawAssistant] = useState<OpenClawAssistant | null>(null);
  const [selectedSessionKey, setSelectedSessionKey] = useState<string>('');
  const [selectedLocalAssistant, setSelectedLocalAssistant] = useState<Assistant | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [agentSessions, setAgentSessions] = useState<SessionInfo[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingOpenClaw, setIsLoadingOpenClaw] = useState(true);
  const [isConnectingToApp, setIsConnectingToApp] = useState(false);
  const [appConnected, setAppConnected] = useState(false);

  // 用于等待回复的标志
  const [waitingForReply, setWaitingForReply] = useState(false);
  const waitingForSessionKeyRef = useRef<string>('');
  const isWaitingRef = useRef(false); // 直接用 false 作为初始值
  const autoApplicationIdRef = useRef<string>(''); // 存储自动集成的 applicationId
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null); // 超时定时器
  const startTimeRef = useRef<number>(0); // 记录开始等待的时间戳

  // 生成并缓存 applicationId（手动模式使用，作为后备）
  const manualApplicationId = useMemo(() => generateApplicationId(), []);

  // 获取当前选中的应用集成
  const selectedAppIntegration = useMemo(() => {
    return appIntegrations.find(i => i.id === selectedAppIntegrationId);
  }, [appIntegrations, selectedAppIntegrationId]);

  // 获取助手已有绑定的约束（同一个助手只能绑定同一个应用和agent）
  const assistantBindingConstraint = useMemo(() => {
    if (!selectedLocalAssistant) return null;
    // 查找该助手已有的绑定（排除当前正在编辑的绑定）
    const existingBindings = existingIntegrations.filter(
      i => i.assistantId === selectedLocalAssistant.id && i.id !== integration?.id
    );
    if (existingBindings.length === 0) return null;

    // 该助手已有绑定，返回约束信息
    const firstBinding = existingBindings[0];
    return {
      applicationId: firstBinding.integration.applicationId,
      agentId: firstBinding.integration.agentId,
      provider: firstBinding.integration.provider,
      integrationId: firstBinding.integration.integrationId,
    };
  }, [selectedLocalAssistant, existingIntegrations, integration]);

  // 初始化表单数据
  // 编辑模式：当数据加载完成后恢复状态
  useEffect(() => {
    if (integration) {
      // 首先恢复应用集成ID
      setSelectedAppIntegrationId(integration.integration.integrationId);

      // 恢复 OpenClaw 相关选择
      if (integration.integration.provider === 'openclaw') {
        const agentId = integration.integration.agentId;
        const sessionKey = (integration.integration.params.sessionKeys as string[] | undefined)?.[0]
          || integration.integration.params.sessionKey as string
          || '';

        // 尝试恢复 OpenClaw Agent
        const foundAgent = openclawAgents.find((a: OpenClawAssistant) => a.id === agentId);
        setSelectedOpenClawAssistant(foundAgent || null);
        setSelectedSessionKey(sessionKey);

        // 尝试恢复本地助手和角色
        // 先检查 assistants 是否已加载
        const assistant = assistants.find(a => a.id === integration.assistantId);
        if (assistant) {
          setSelectedLocalAssistant(assistant);

          // 检查该助手的角色是否已加载
          const assistantCharacters = characters[assistant.id];
          if (assistantCharacters && assistantCharacters.length > 0) {
            const character = assistantCharacters.find(c => c.id === integration.characterId);
            setSelectedCharacter(character || null);
          } else {
          }
        } else {
        }
      }
    } else {
    }
  }, [integration, openclawAgents, assistants]);

  // 新增模式：重置所有状态
  useEffect(() => {
    if (!integration && isOpen) {
      setSelectedAppIntegrationId('');
      setSelectedOpenClawAssistant(null);
      setSelectedSessionKey('');
      setSelectedLocalAssistant(null);
      setSelectedCharacter(null);
      setAgentSessions([]);
      setBindStatus('idle');
      setBindError(null);
      setIntegrationMode('auto');
      isWaitingRef.current = false;
      waitingForSessionKeyRef.current = '';
      setWaitingForReply(false);
    }
  }, [integration, isOpen]);

  // 当助手有约束时，不再自动填充，只显示提示
  // 用户需要手动选择正确的应用和agent

  // 加载 OpenClaw 助手列表 - 注意：需要先连接成功才能获取 agents
  // 这个逻辑移到连接成功的回调中处理，见下方的 connectToSelectedApp useEffect

  // 加载 OpenClaw agent 列表的函数
  const loadOpenClawAgents = async () => {
    setIsLoadingOpenClaw(true);
    try {
      await getAgents();
    } catch (error) {
      console.error('[CharacterIntegrationModal] ❌ Failed to load OpenClaw agents:', error);
    } finally {
      setIsLoadingOpenClaw(false);
    }
  };

  // 当选择 OpenClaw 应用后，连接到该应用（新增和编辑模式都需要）
  useEffect(() => {
    const connectToSelectedApp = async () => {
      // 获取目标 endpoint
      const targetAppIntegration = selectedAppIntegration || appIntegrations.find(i => i.id === integration?.integration.integrationId);
      if (!targetAppIntegration || targetAppIntegration.provider !== 'openclaw') {
        setAppConnected(false);
        return;
      }

      // 检查是否已经连接到相同的 endpoint
      // 使用 brainStore 的 url 来判断当前连接的 endpoint
      const currentUrl = useBrainStore.getState().url;
      const targetEndpoint = targetAppIntegration.endpoint;
      const isSameEndpoint = currentUrl === targetEndpoint || currentUrl === targetEndpoint.replace('ws://', 'ws://').replace('wss://', 'wss://');

      if (connected && isSameEndpoint) {
        setAppConnected(true);
        // 已连接，直接加载 agents
        await loadOpenClawAgents();
        return;
      }

      // 如果连接到了不同的 endpoint，需要断开并重新连接
      if (connected && !isSameEndpoint) {
      }
      setIsConnectingToApp(true);
      try {
        await connect(targetEndpoint);
        setAppConnected(true);
        // 连接成功后加载 agents
        await loadOpenClawAgents();
      } catch (error) {
        console.error('[CharacterIntegrationModal] ❌ Failed to connect to OpenClaw app:', error);
        setAppConnected(false);
      } finally {
        setIsConnectingToApp(false);
      }
    };

    // 编辑模式：检查 integration 的 provider
    // 新增模式：检查 selectedAppIntegration 的 provider
    const provider = integration?.integration.provider || selectedAppIntegration?.provider;
    if (provider === 'openclaw') {
      connectToSelectedApp();
    }
  // 注意：loadOpenClawAgents 不需要作为依赖，因为它内部使用了 getAgents
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAppIntegration, integration, appIntegrations, connect, connected]);

  // 加载本地预设助手列表
  useEffect(() => {
    const loadLocalAssistants = async () => {
      try {
        await loadAssistants();
      } catch (error) {
        console.error('[CharacterIntegrationModal] ❌ Failed to load local assistants:', error);
      }
    };

    loadLocalAssistants();
  }, [loadAssistants]);

  // 当选择助手时，重置角色选择
  useEffect(() => {
    if (selectedLocalAssistant) {
      setSelectedCharacter(null);
    }
  }, [selectedLocalAssistant]);

  // 加载选中助手的角色
  useEffect(() => {
    const loadAssistantCharacters = async () => {
      if (selectedLocalAssistant) {
        try {
          await loadCharacters(selectedLocalAssistant.id);
        } catch (error) {
          console.error('[CharacterIntegrationModal] ❌ Failed to load characters:', error);
        }
      }
    };

    loadAssistantCharacters();
  }, [selectedLocalAssistant, loadCharacters]);

  // 新增模式：角色列表加载后自动选中第一个角色
  useEffect(() => {
    // 只在新增模式下自动选中
    if (isEditMode) {
      return;
    }

    if (selectedLocalAssistant && characters[selectedLocalAssistant.id]) {
      const assistantCharacters = characters[selectedLocalAssistant.id];
      if (assistantCharacters.length > 0 && !selectedCharacter) {
        setSelectedCharacter(assistantCharacters[0]);
      }
    }
  }, [selectedLocalAssistant, characters, isEditMode]);

  // 新增模式：Agent 列表加载后自动选中第一个
  useEffect(() => {
    if (isEditMode) {
      return;
    }

    if (selectedAppIntegration?.provider === 'openclaw' && openclawAgents.length > 0 && !selectedOpenClawAssistant) {
      setSelectedOpenClawAssistant(openclawAgents[0]);
    }
  }, [selectedAppIntegration, openclawAgents, isEditMode, selectedOpenClawAssistant]);

  // 新增模式：Session 列表加载后自动选中第一个
  useEffect(() => {
    if (isEditMode) {
      return;
    }

    if (agentSessions.length > 0 && !selectedSessionKey) {
      const firstSessionKey = agentSessions[0].sessionKey || agentSessions[0].key || '';
      setSelectedSessionKey(firstSessionKey);
    }
  }, [agentSessions, isEditMode, selectedSessionKey]);

  // 新增模式：助手列表加载后自动选中第一个助手
  useEffect(() => {
    if (isEditMode) {
      return;
    }

    if (assistants.length > 0 && !selectedLocalAssistant) {
      setSelectedLocalAssistant(assistants[0]);
    }
  }, [assistants, isEditMode, selectedLocalAssistant]);

  // 当选择 Agent 后，获取该 Agent 的所有 Session
  useEffect(() => {
    const loadAgentSessions = async () => {
      if (!selectedOpenClawAssistant) {
        setAgentSessions([]);
        // 编辑模式下不要清空，因为可能已经从回显设置了值
        if (!isEditMode) {
          setSelectedSessionKey('');
        }
        return;
      }
      setIsLoadingSessions(true);
      try {
        const sessions = await getAgentSessions(selectedOpenClawAssistant.id);
        setAgentSessions(sessions);

        // 编辑模式下不清空，保持回显的值；新增模式下让用户手动选择
        if (!isEditMode) {
          setSelectedSessionKey('');
        }
      } catch (error) {
        console.error('[CharacterIntegrationModal] ❌ Failed to load agent sessions:', error);
        setAgentSessions([]);
        if (!isEditMode) {
          setSelectedSessionKey('');
        }
      } finally {
        setIsLoadingSessions(false);
      }
    };

    loadAgentSessions();
  }, [selectedOpenClawAssistant, getAgentSessions, isEditMode]);

  // 完成集成的通用逻辑
  const completeIntegration = async (applicationIdOverride?: string) => {
    if (!selectedAppIntegration || !selectedLocalAssistant || !selectedCharacter) {
      console.error('[CharacterIntegrationModal] ❌ Missing required info');
      setBindStatus('failed');
      setBindError('缺少必要信息');
      return;
    }

    if (selectedAppIntegration.provider === 'openclaw') {
      if (!selectedSessionKey || !selectedOpenClawAssistant) {
        console.error('[CharacterIntegrationModal] ❌ Missing OpenClaw info');
        setBindStatus('failed');
        setBindError('缺少 OpenClaw 信息');
        return;
      }
    }

    try {
      // 使用传入的 applicationId（自动集成）或使用应用集成的 applicationId
      const finalApplicationId = applicationIdOverride || selectedAppIntegration.applicationId;
      const data: CreateCharacterIntegrationDTO | UpdateCharacterIntegrationDTO = {
        characterId: selectedCharacter.id,
        characterName: selectedCharacter.name,
        assistantId: selectedLocalAssistant.id,
        assistantName: selectedLocalAssistant.name,
        integration: {
          integrationId: selectedAppIntegration.id,
          provider: selectedAppIntegration.provider,
          applicationId: finalApplicationId,
          agentId: selectedAppIntegration.provider === 'openclaw'
            ? selectedOpenClawAssistant!.id
            : integration?.integration.agentId || '',
          params: selectedAppIntegration.provider === 'openclaw' && selectedSessionKey
            ? { sessionKeys: [selectedSessionKey] }
            : integration?.integration.params || {},
        },
        enabled: true,
      };

      // 保存角色集成
      await onSave(data);

      // 同时更新 assistants.json（与引导页保持一致）
      if (selectedAppIntegration.provider === 'openclaw' && selectedOpenClawAssistant && selectedSessionKey) {
        const openclawIntegration = {
          provider: 'openclaw',
          params: {
            applicationId: finalApplicationId,
            agentId: selectedOpenClawAssistant.id,
            sessionKeys: [selectedSessionKey],
          },
          enabled: true,
          createdAt: Date.now(),
        };

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
      }

      setBindStatus('success');
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      console.error('[CharacterIntegrationModal] ❌ Failed to complete integration:', error);
      setBindStatus('failed');
      setBindError(error instanceof Error ? error.message : String(error));
    }
  };

  // 监听会话消息，用于自动集成时等待回复
  // 同步 isWaitingRef 到最新状态
  useEffect(() => {
    isWaitingRef.current = waitingForReply;
  }, [waitingForReply]);

  // 使用 ref 存储 completeIntegration 函数，避免闭包陷阱
  const completeIntegrationRef = useRef(completeIntegration);
  useEffect(() => {
    completeIntegrationRef.current = completeIntegration;
  }, [completeIntegration]);

  // 创建稳定的 onSession 处理器 - 使用 useCallback 和 ref 避免闭包问题
  const handleSessionMessage = useCallback((message: AnyTypedCAPMessage & { type: 'session' }) => {
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
        isWaitingRef.current = false; // 同步重置 ref
        waitingForSessionKeyRef.current = '';
        setWaitingForReply(false);

        // 清除超时定时器
        if (timeoutIdRef.current) {
          clearTimeout(timeoutIdRef.current);
          timeoutIdRef.current = null;
        }

        // 使用存储的 applicationId（而不是重新生成）
        const applicationIdToUse = autoApplicationIdRef.current || manualApplicationId;
        completeIntegrationRef.current(applicationIdToUse);
      } else {
      }
    } else {
    }
  }, []);

  // 创建稳定的 onBehaviorMental 处理器 - 处理行为/心理消息
  const handleBehaviorMentalMessage = useCallback((message: AnyTypedCAPMessage & { type: 'behavior_mental' }) => {
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
        isWaitingRef.current = false; // 同步重置 ref
        waitingForSessionKeyRef.current = '';
        setWaitingForReply(false);

        // 清除超时定时器
        if (timeoutIdRef.current) {
          clearTimeout(timeoutIdRef.current);
          timeoutIdRef.current = null;
        }

        // 使用存储的 applicationId（而不是重新生成）
        const applicationIdToUse = autoApplicationIdRef.current || manualApplicationId;
        completeIntegrationRef.current(applicationIdToUse);
      } else {
      }
    } else {
    }
  }, []);

  useCAPMessage({
    onSession: handleSessionMessage,
    onBehaviorMental: handleBehaviorMentalMessage,
  });

  // 组件卸载时清理超时定时器
  useEffect(() => {
    return () => {
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    };
  }, []);

  // 生成显示名称
  const getSessionDisplayName = (session: SessionInfo): string => {
    const sessionKey = session.sessionKey || session.key || '';
    if (session.label || session.displayName) {
      return `${session.label || session.displayName} (${sessionKey})`;
    }
    // 从 sessionKey 解析友好的名称
    const parts = sessionKey.split(':');
    if (parts[0] === 'agent' && parts.length >= 3) {
      const agentId = parts[1];
      if (parts[2] === 'main') {
        return `${agentId} - ${t('onboarding:mainSession')}`;
      }
      // channel:peer 格式
      if (parts.length >= 4) {
        const channel = parts[2];
        const peer = parts[3];
        return `${agentId} - ${channel}:${peer}`;
      }
    }
    return sessionKey;
  };

  // 验证表单
  const isFormValid = (() => {
    const baseValid = !!selectedAppIntegrationId && !!selectedLocalAssistant && !!selectedCharacter;
    let result = baseValid;
    if (selectedAppIntegration?.provider === 'openclaw') {
      result = !!(baseValid && selectedOpenClawAssistant && selectedSessionKey);
    }
    return result;
  })();

  // 约束违反检查
  // 1. 同一个助手只能绑定同一个 App + Agent
  // 2. 同一个助手的不同角色只能绑定不同的 Session
  const constraintCheck = useMemo(() => {
    if (!selectedLocalAssistant || !selectedAppIntegration) {
      return { isViolated: false, warnings: [] };
    }

    const warnings: string[] = [];

    // 检查1: 同一个助手只能绑定同一个 App + Agent
    if (assistantBindingConstraint) {
      const appMatch = selectedAppIntegration.applicationId === assistantBindingConstraint.applicationId;
      let agentMatch = true;

      if (selectedAppIntegration.provider === 'openclaw' && selectedOpenClawAssistant) {
        agentMatch = selectedOpenClawAssistant.id === assistantBindingConstraint.agentId;
      }
      if (!appMatch || !agentMatch) {
        warnings.push(
          `该助手已绑定到应用: ${assistantBindingConstraint.applicationId}` +
          (selectedAppIntegration.provider === 'openclaw' ? ` / Agent: ${assistantBindingConstraint.agentId}` : '')
        );
      }
    }

    // 检查2: 同一个助手的不同角色只能绑定不同的 Session
    if (selectedAppIntegration.provider === 'openclaw' && selectedSessionKey) {
      // 查找该助手的其他绑定是否使用了相同的 session
      // 支持两种数据格式: sessionKey (单个字符串) 和 sessionKeys (数组)
      const sessionConflict = existingIntegrations.find(i => {
        if (i.assistantId !== selectedLocalAssistant.id || i.id === integration?.id) {
          return false;
        }
        // 检查 sessionKey (单个字符串格式)
        if (i.integration.params?.sessionKey === selectedSessionKey) {
          return true;
        }
        // 检查 sessionKeys (数组格式)
        const sessionKeys = i.integration.params?.sessionKeys as string[] | undefined;
        if (Array.isArray(sessionKeys) && sessionKeys.includes(selectedSessionKey)) {
          return true;
        }
        return false;
      });
      if (sessionConflict) {
        warnings.push(
          `该 Session 已被角色 "${sessionConflict.characterName}" 使用，同一助手的不同角色只能绑定不同的 Session`
        );
      }
    }
    return {
      isViolated: warnings.length > 0,
      warnings,
    };
  }, [selectedLocalAssistant, selectedAppIntegration, selectedOpenClawAssistant, selectedSessionKey, assistantBindingConstraint, existingIntegrations, integration, selectedCharacter]);

  // 自动集成
  const handleAutoBind = async () => {
    // 验证必要的选项
    if (!selectedAppIntegration) {
      console.error('[CharacterIntegrationModal] ❌ No app integration selected');
      alert(t('onboarding:pleaseSelectAgent'));
      return;
    }

    if (selectedAppIntegration.provider === 'openclaw') {
      if (!selectedOpenClawAssistant) {
        console.error('[CharacterIntegrationModal] ❌ No OpenClaw assistant selected');
        alert(t('onboarding:pleaseSelectAgent'));
        setBindStatus('failed');
        setBindError(t('onboarding:noAgentSelected'));
        return;
      }

      if (!selectedSessionKey) {
        console.error('[CharacterIntegrationModal] ❌ No session key selected');
        alert(t('onboarding:pleaseSelectSession'));
        return;
      }

      // 检查 sessionKey 是否包含 undefined
      if (selectedSessionKey.includes('undefined')) {
        console.error('[CharacterIntegrationModal] ❌ Session key contains "undefined":', selectedSessionKey);
        alert(`${t('onboarding:sessionKeyInvalid')}: ${selectedSessionKey}`);
        setBindStatus('failed');
        setBindError(`${t('onboarding:invalidSessionKey')}: ${selectedSessionKey}`);
        return;
      }

      // 检查是否已连接
      if (!appConnected) {
        console.error('[CharacterIntegrationModal] ❌ App not connected, appConnected:', appConnected);
        alert(t('onboarding:pleaseConnectFirst'));
        setBindStatus('failed');
        setBindError(t('onboarding:notConnected'));
        return;
      }
    }

    // 检查是否已选择角色
    if (!selectedCharacter) {
      console.error('[CharacterIntegrationModal] ❌ No character selected!');
      alert(t('settings:pleaseSelectCharacter'));
      setBindStatus('failed');
      setBindError(t('settings:pleaseSelectCharacter'));
      return;
    }
    if (selectedAppIntegration.provider === 'openclaw') {
      // OpenClaw 自动集成：发送消息
      setBindStatus('binding');
      setBindError(null);

      // 使用选中的应用集成的 applicationId（与引导页保持一致）
      const applicationId = selectedAppIntegration.applicationId;
      // 存储到 ref，确保处理器使用同一个 ID
      autoApplicationIdRef.current = applicationId;

      const assistantId = selectedLocalAssistant?.id || applicationId;
      const characterId = selectedCharacter?.id || assistantId;
      const agentId = selectedOpenClawAssistant?.id || '';

      // 解析 HTTP 配置
      const httpConfig = parseHttpConfig(selectedAppIntegration.endpoint);
      const deepjellyToken = selectedAppIntegration.deepjellyToken || '';

      // 构建绑定消息
      const bindMessage = `# 任务
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

## 步骤2：将以下结构体更新到 bindings 模块
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

      try {
        // ⚠️ 关键：必须在发送消息之前设置等待状态！
        // 因为 OpenClaw 可能在 invoke 返回之前就发送回复
        isWaitingRef.current = true;
        waitingForSessionKeyRef.current = selectedSessionKey;
        startTimeRef.current = Date.now(); // 记录开始等待的时间戳
        setWaitingForReply(true);
        // 发送绑定消息到 OpenClaw，直接使用 invoke（与引导页面一致）
        const { invoke } = await import('@tauri-apps/api/core');
        const params = { sessionId: selectedSessionKey, content: bindMessage };
        await invoke('send_message', params);
        // 设置2分钟超时
        if (timeoutIdRef.current) {
          clearTimeout(timeoutIdRef.current);
        }
        timeoutIdRef.current = setTimeout(() => {
          isWaitingRef.current = false; // 同步重置 ref
          waitingForSessionKeyRef.current = '';
          setWaitingForReply(false);
          setBindStatus('failed');
          setBindError('等待回复超时，请重试');
        }, 2 * 60 * 1000); // 2分钟
      } catch (error) {
        console.error('[CharacterIntegrationModal] ❌ Failed to send bind message:', error);
        isWaitingRef.current = false; // 同步重置 ref
        waitingForSessionKeyRef.current = '';
        setBindStatus('failed');
        setBindError(error instanceof Error ? error.message : String(error));
        setWaitingForReply(false);
      }
    } else {
      // 非 OpenClaw：直接保存
      completeIntegration();
    }
  };

  // 手动集成
  const handleManualBind = () => {
    // 使用选中的应用集成的 applicationId（与引导页保持一致）
    const applicationIdToUse = selectedAppIntegration?.applicationId || manualApplicationId;
    completeIntegration(applicationIdToUse);
  };

  if (!isOpen) return null;

  const isAppOpenClaw = selectedAppIntegration?.provider === 'openclaw';

  return (
    <div className="modal-overlay">
      <div className="character-integration-modal">
        {/* Header - MAC Style */}
        <div className="modal-header-mac">
          <div className="modal-title">
            {isEditMode ? t('integration.editBinding') : t('integration.newBinding')}
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body - MAC Style */}
        <div className="modal-body-mac">
          {/* 0. Select Application */}
          <div className="form-group-mac">
            <label className="form-label-mac">
              {t('integration.selectApplication')}
              <span className="form-required">*</span>
            </label>
            <select
              className="form-select-mac"
              value={selectedAppIntegrationId}
              onChange={(e) => {
                const newAppIntegrationId = e.target.value;
                setSelectedAppIntegrationId(newAppIntegrationId);
                setSelectedOpenClawAssistant(null);
                setSelectedSessionKey('');
                setAgentSessions([]);
              }}
              disabled={isEditMode}
            >
              <option value="">{t('integration.selectIntegration')}</option>
              {appIntegrations.map(appInt => (
                <option key={appInt.id} value={appInt.id}>
                  {appInt.name}{appInt.description ? ` (${appInt.description})` : ''}
                </option>
              ))}
            </select>
            <div className="form-hint-mac">
              {isEditMode ? t('integration.applicationReadOnlyHint') : t('integration.selectIntegrationHint')}
            </div>
          </div>

          {/* OpenClaw Fields */}
          {isAppOpenClaw && (
            <>
              {/* 1. Select Agent */}
              <div className="form-group-mac">
                <label className="form-label-mac">
                  {t('onboarding:selectAgent')}
                  <span className="form-required">*</span>
                </label>
                {isLoadingOpenClaw ? (
                  <div className="form-select-disabled">
                    <div className="spinner" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }}></div>
                    {t('onboarding:loadingAgents')}
                  </div>
                ) : (
                  <select
                    className="form-select-mac"
                    value={selectedOpenClawAssistant?.id || ''}
                    onChange={(e) => {
                      const assistant = openclawAgents.find((a: OpenClawAssistant) => a.id === e.target.value);
                      setSelectedOpenClawAssistant(assistant || null);
                      setBindStatus('idle');
                      setBindError(null);
                    }}
                    disabled={isEditMode}
                  >
                    {openclawAgents.length === 0 ? (
                      <option value="">{t('onboarding:noAgentFound')}</option>
                    ) : (
                      openclawAgents.map((agent: OpenClawAssistant) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name} {agent.description && `- ${agent.description}`}
                        </option>
                      ))
                    )}
                  </select>
                )}
                <div className="form-hint-mac">{t('onboarding:agentHint')}</div>
              </div>

              {/* 2. Select Session */}
              <div className="form-group-mac">
                <label className="form-label-mac">
                  {t('onboarding:selectSession')}
                  <span className="form-required">*</span>
                </label>
                {isLoadingSessions ? (
                  <div className="form-select-disabled">
                    <div className="spinner" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }}></div>
                    {t('onboarding:loadingSessions')}
                  </div>
                ) : agentSessions.length === 0 ? (
                  <div className="form-select-disabled">{t('onboarding:noSessionAvailable')}</div>
                ) : (
                  <select
                    className="form-select-mac"
                    value={selectedSessionKey}
                    onChange={(e) => {
                      setSelectedSessionKey(e.target.value);
                      setBindStatus('idle');
                      setBindError(null);
                    }}
                    disabled={isEditMode || !selectedOpenClawAssistant}
                  >
                    {agentSessions.map((session) => {
                      const sessionKey = session.sessionKey || session.key || '';
                      return (
                        <option key={sessionKey} value={sessionKey}>
                          {getSessionDisplayName(session)}
                        </option>
                      );
                    })}
                  </select>
                )}
                <div className="form-hint-mac">{t('onboarding:sessionHint')}</div>
              </div>

              {/* Connection Status */}
              <div className={`status-message ${isConnectingToApp ? 'warning' : appConnected ? 'success' : 'error'}`}>
                {isConnectingToApp
                  ? '正在连接到 OpenClaw...'
                  : appConnected
                    ? '已连接到 OpenClaw'
                    : '未连接到 OpenClaw'}
              </div>

              {/* Connection Info Card */}
              {selectedSessionKey && (
                <div className="info-card-mac">
                  <div className="info-row-mac">
                    <span className="info-label-mac">{t('onboarding:websocketAddress')}</span>
                    <code className="info-value-mac">{selectedAppIntegration?.endpoint}</code>
                  </div>
                  <div className="info-row-mac">
                    <span className="info-label-mac">{t('onboarding:boundSession')}</span>
                    <code className="info-value-mac">{selectedSessionKey}</code>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 3. Select Assistant */}
          <div className="form-group-mac">
            <label className="form-label-mac">
              {t('onboarding:selectAssistant')}
              <span className="form-required">*</span>
            </label>
            <select
              className="form-select-mac"
              value={selectedLocalAssistant?.id || ''}
              onChange={(e) => {
                const assistant = assistants.find(a => a.id === e.target.value);
                setSelectedLocalAssistant(assistant || null);
                setSelectedCharacter(null);
              }}
              disabled={isEditMode}
            >
              {assistants.map(assistant => (
                <option key={assistant.id} value={assistant.id}>
                  {assistant.name} {assistant.description && `- ${assistant.description}`}
                </option>
              ))}
            </select>
            <div className="form-hint-mac">{t('onboarding:assistantHint')}</div>
          </div>

          {/* 4. Select Character */}
          <div className="form-group-mac">
            <label className="form-label-mac">
              {t('onboarding:selectCharacter')}
              <span className="form-required">*</span>
            </label>
            {!selectedLocalAssistant ? (
              <div className="form-select-disabled">{t('settings:pleaseSelectAssistant')}</div>
            ) : !characters[selectedLocalAssistant.id] || characters[selectedLocalAssistant.id].length === 0 ? (
              <div className="form-select-disabled">{t('settings:noAssistantCharacters')}</div>
            ) : (
              <select
                className="form-select-mac"
                value={selectedCharacter?.id || ''}
                onChange={(e) => {
                  const character = characters[selectedLocalAssistant.id].find(c => c.id === e.target.value);
                  setSelectedCharacter(character || null);
                }}
              >
                {characters[selectedLocalAssistant.id].map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name} {character.description && `- ${character.description}`}
                  </option>
                ))}
              </select>
            )}
            <div className="form-hint-mac">{t('onboarding:characterHint')}</div>
          </div>

          {/* Bind Status */}
          {bindStatus !== 'idle' && (
            <div className={`status-message ${bindStatus === 'success' ? 'success' : bindStatus === 'failed' ? 'error' : 'warning'}`}>
              {bindStatus === 'binding' && `${t('onboarding:sendingBindMessage')} ${selectedSessionKey}...`}
              {bindStatus === 'success' && t('onboarding:bindMessageSent')}
              {bindStatus === 'failed' && `${t('onboarding:bindFailed')}${bindError || t('onboarding:unknownError')}`}
            </div>
          )}

          {/* Constraint Warning */}
          {constraintCheck.isViolated && (
            <div className="status-message warning">
              ⚠️ {constraintCheck.warnings.join('；')}
            </div>
          )}

          {/* 手动集成配置说明 */}
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
                  {t('onboarding:manualConfigTitle', '手动集成配置说明')}
                </h4>
                <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#6e6e73' }}>
                  {t('onboarding:manualConfigDesc', '请按照以下步骤手动配置 OpenClaw，然后点击【确定】完成集成')}
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
                  <strong>{t('onboarding:applicationId')}:</strong> <span style={{ color: '#0066cc' }}>{selectedOpenClawAssistant ? manualApplicationId : '---'}</span>
                </div>
                <div style={{ marginBottom: '8px', color: '#1d1d1f' }}>
                  <strong>{t('onboarding:agentId')}:</strong> <span style={{ color: '#0066cc' }}>{selectedOpenClawAssistant?.id || '---'}</span>
                </div>
                <div style={{ marginBottom: '8px', color: '#1d1d1f' }}>
                  <strong>{t('onboarding:assistantId')}:</strong> <span style={{ color: '#0066cc' }}>{selectedLocalAssistant?.id || (selectedOpenClawAssistant ? manualApplicationId : '---')}</span>
                </div>
                <div style={{ marginBottom: '8px', color: '#1d1d1f' }}>
                  <strong>{t('onboarding:characterId', '角色ID')}:</strong> <span style={{ color: '#0066cc' }}>{selectedCharacter?.id || (selectedLocalAssistant?.id || (selectedOpenClawAssistant ? manualApplicationId : '---'))}</span>
                </div>
                <div style={{ color: '#1d1d1f' }}>
                  <strong>{t('onboarding:sessionKey')}:</strong> <span style={{ color: '#0066cc', fontSize: '11px' }}>{selectedSessionKey || '---'}</span>
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
                  {t('onboarding:configSteps', '配置步骤')}:
                </div>
                <ol style={{ margin: '0', paddingLeft: '20px', lineHeight: '1.8', color: '#6e6e73' }}>
                  <li>{t('onboarding:step1', '打开 OpenClaw 的配置文件 openclaw.json')}</li>
                  <li>{t('onboarding:step2', '在 channels 模块中添加 deepjelly channel 配置（见下方示例）')}</li>
                  <li>{t('onboarding:step2b', '在 bindings 模块中添加 agent 与 deepjelly 的绑定配置（见下方示例）')}</li>
                  <li>{t('onboarding:step3', '根据你的部署场景选择配置（本地开发或局域网部署）')}</li>
                  <li>{t('onboarding:step4', '保存配置文件')}</li>
                  <li>{t('onboarding:step5', '重启 OpenClaw 网关使配置生效')}</li>
                  <li>{t('onboarding:step6', '点击下方【确定】按钮完成集成')}</li>
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
                  {t('onboarding:localDev', '本地开发（同一台机器）')}:
                </div>
                <div style={{ marginBottom: '4px', color: '#6e6e73' }}>
                  <strong>{t('onboarding:firewall')}:</strong> {t('onboarding:noFirewallNeeded', '无需配置')}
                </div>
                <div style={{ marginBottom: '4px', color: '#6e6e73' }}>
                  <strong>{t('onboarding:connectionEndpoint')}:</strong> ws://127.0.0.1:18790
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
                  {t('onboarding:lanDeploy', '局域网部署（不同机器）')}:
                </div>
                <div style={{ marginBottom: '4px', color: '#6e6e73' }}>
                  <strong>{t('onboarding:firewall')}:</strong> {t('onboarding:firewallDesc', '需要允许 18790 端口入站连接')}
                </div>
                <div style={{ marginBottom: '4px', color: '#6e6e73' }}>
                  <strong>{t('onboarding:connectionEndpoint')}:</strong> ws://{'<OpenClaw_IP>'}:18790
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

        {/* Footer - MAC Style */}
        <div className="modal-footer-mac">
          <button className="btn-mac btn-mac-secondary" onClick={onClose} disabled={bindStatus === 'binding' || waitingForReply}>
            {t('common:cancel')}
          </button>
          {isAppOpenClaw && (
            <button
              className="btn-mac btn-mac-secondary"
              onClick={() => setIntegrationMode(integrationMode === 'auto' ? 'manual' : 'auto')}
              disabled={bindStatus === 'binding' || waitingForReply}
            >
              {integrationMode === 'auto' ? t('integration.switchToManual') : t('integration.switchToAuto')}
            </button>
          )}
          <button
            className="btn-mac btn-mac-primary"
            onClick={isAppOpenClaw && integrationMode === 'auto' ? handleAutoBind : handleManualBind}
            disabled={!isFormValid || constraintCheck.isViolated || bindStatus === 'binding' || waitingForReply}
          >
            {bindStatus === 'binding' || waitingForReply
              ? t('integration.waitingBindReply')
              : isAppOpenClaw && integrationMode === 'auto'
                ? isEditMode ? t('integration.reBind') : t('integration.autoBind')
                : isEditMode ? t('common:update') : t('common:confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
