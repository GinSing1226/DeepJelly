/**
 * Character Management Component
 *
 * 角色管理组件 - 主入口
 * 提供三层导航：助手树 → 角色列表 → 形象详情
 *
 * 遵循需求文档 docs/private_docs/Reqs/4.2.角色管理.md
 */

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useCharacterManagementStore,
  selectAssistantTree,
  selectCurrentCharacters,
  selectCurrentAssistant,
} from '@/stores/characterManagementStore';
import CharacterDetailView from './CharacterDetailView';
import AppearanceDetailView from './AppearanceDetailView';
import AssistantModal from './AssistantModal';
import type { Character } from '@/types/character';
import type { AddActionFormData, EditActionFormData } from '@/types/character';
import './macos.css';

interface CharacterManagementProps {
  /** 是否在独立窗口中显示 */
  isWindow?: boolean;
}

type ViewMode = 'assistant' | 'character-detail' | 'appearance-detail';

/** 右键菜单状态 */
interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  nodeType: 'app' | 'assistant' | null;
  nodeData: { id: string; name: string; appType?: string; agentLabel?: string } | null;
}

/**
 * 助手树节点组件
 */
function AssistantTreeNode({
  node,
  level = 0,
  selectedId,
  onSelect,
  onContextMenu,
}: {
  node: {
    type: 'app' | 'assistant';
    id: string;
    name: string;
    description?: string;
    children?: typeof node[];
    appType?: string;
    agentLabel?: string;
  };
  level?: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, nodeType: 'app' | 'assistant', nodeData: { id: string; name: string; appType?: string; agentLabel?: string }) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(level === 0);
  const hasChildren = node.children && node.children.length > 0;

  const handleContextMenu = (e: React.MouseEvent) => {
    onContextMenu(e, node.type, {
      id: node.id,
      name: node.name,
      appType: node.appType,
      agentLabel: node.agentLabel,
    });
  };

  return (
    <div className="assistant-tree-node">
      <div
        className={`assistant-node-content ${
          selectedId === node.id ? 'selected' : ''
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => {
          if (node.type === 'assistant') {
            onSelect(node.id);
          } else {
            setIsExpanded(!isExpanded);
          }
        }}
        onContextMenu={handleContextMenu}
      >
        {hasChildren && (
          <span className="tree-toggle">
            {isExpanded ? '▼' : '▾'}
          </span>
        )}
        <span className="tree-icon">
          {node.type === 'app' ? '📦' : '🤖'}
        </span>
        <span className="tree-name">{node.name}</span>
      </div>
      {isExpanded && hasChildren && (
        <div className="tree-children">
          {node.children!.map((child) => (
            <AssistantTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 角色卡片组件
 */
function CharacterCard({
  character,
  onClick,
}: {
  character: Character;
  onClick: () => void;
}) {
  const { t } = useTranslation('settings');
  const [imgError, setImgError] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  // 加载封面图：使用 idle 动作的首个资源
  useEffect(() => {
    const loadCoverImage = async () => {
      const firstAppearance = character.appearances?.[0];
      if (!firstAppearance) return;

      // 优先查找 idle 动作（通常是 internal-base-idle）
      const actionKeys = Object.keys(firstAppearance.actions);
      if (actionKeys.length === 0) return;

      // 查找包含 "idle" 的动作键
      const idleActionKey = actionKeys.find(key => key.toLowerCase().includes('idle'));
      const actionKey = idleActionKey || actionKeys[0];

      const firstAction = firstAppearance.actions[actionKey];
      const firstResource = firstAction?.resources?.[0];

      if (!firstResource) return;

      try {
        // 构建资源名称：actionKey/resourceName
        const fullResourceName = `${actionKey}/${firstResource}`;
        // 调用后端获取 base64 data URL (避免 asset.localhost 协议问题)
        const { invoke } = await import('@tauri-apps/api/core');
        const dataUrl = await invoke<string>('load_character_resource', {
          assistantId: character.assistantId,
          characterId: character.id,
          resourceName: fullResourceName,
        });
        setCoverUrl(dataUrl);
      } catch (error) {
        console.error('[CharacterCard] Failed to load cover image:', error);
        setImgError(true);
      }
    };

    loadCoverImage();
  }, [character]);

  return (
    <div className="character-card" onClick={onClick}>
      <div className="card-cover">
        {coverUrl && !imgError ? (
          <img
            src={coverUrl}
            alt={character.name}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="card-placeholder">🎭</div>
        )}
      </div>
      <div className="card-info">
        <div className="card-name">{character.name}</div>
        <div className="card-meta">
          <span className="card-id">{character.id}</span>
          <span className="card-count">{character.appearances?.length || 0} {t('character.appearances')}</span>
        </div>
        {character.description && (
          <div className="card-description">{character.description}</div>
        )}
      </div>
    </div>
  );
}

/**
 * 主组件
 */
export default function CharacterManagement({ isWindow: _isWindow }: CharacterManagementProps) {
  const { t } = useTranslation('settings');
  // Store selectors and actions
  const assistantTree = useCharacterManagementStore(selectAssistantTree);
  const loadAssistants = useCharacterManagementStore(state => state.loadAssistants);
  const loadAllCharacters = useCharacterManagementStore(state => state.loadAllCharacters);
  const selectAssistant = useCharacterManagementStore(state => state.selectAssistant);
  const updateCharacter = useCharacterManagementStore(state => state.updateCharacter);
  const updateAppearance = useCharacterManagementStore(state => state.updateAppearance);
  const characters = useCharacterManagementStore(selectCurrentCharacters);
  const currentAssistant = useCharacterManagementStore(selectCurrentAssistant);
  const searchQuery = useCharacterManagementStore(state => state.searchQuery);
  const setSearchQuery = useCharacterManagementStore(state => state.setSearchQuery);
  const updateAssistant = useCharacterManagementStore(state => state.updateAssistant);
  const assistants = useCharacterManagementStore(state => state.assistants);

  // 判断是否在设置面板中（通过检测父容器）
  const [isEmbedded, setIsEmbedded] = useState(false);
  // 嵌入模式下树节点展开状态
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());

  useEffect(() => {
    // 检测是否在设置面板中
    const checkEmbedded = () => {
      const settingsBody = document.querySelector('.settings-body');
      const charManagement = document.querySelector('.character-management');
      setIsEmbedded(settingsBody?.contains(charManagement) || false);
    };

    checkEmbedded();
    // 延迟检查，确保DOM已渲染
    const timer = setTimeout(checkEmbedded, 100);
    return () => clearTimeout(timer);
  }, []);

  // Local state
  const [viewMode, setViewMode] = useState<ViewMode>('assistant');
  const storeSelectedAssistantId = useCharacterManagementStore(state => state.selectedAssistantId);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [selectedAppearanceId, setSelectedAppearanceId] = useState<string | null>(null);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    nodeType: null,
    nodeData: null,
  });

  // 助手弹窗状态
  const [assistantModal, setAssistantModal] = useState<{
    isOpen: boolean;
    isEdit: boolean;
    assistant: { id: string; name: string; description?: string } | null;
  }>({
    isOpen: false,
    isEdit: false,
    assistant: null,
  });

  // Initialize data on mount
  useEffect(() => {
    loadAssistants();
    loadAllCharacters();
  }, [loadAssistants, loadAllCharacters]);

  // Auto-select first assistant when data loads (only in embedded mode)
  useEffect(() => {
    if (isEmbedded && !storeSelectedAssistantId && assistantTree.length > 0) {
      // Find the first assistant (type === 'assistant') from the tree
      for (const node of assistantTree) {
        if (node.children && node.children.length > 0) {
          const firstAssistant = node.children.find(c => c.type === 'assistant');
          if (firstAssistant) {
            // Auto-expand the parent app node
            setExpandedApps(new Set([node.id]));
            selectAssistant(firstAssistant.id);
            break;
          }
        }
      }
    }
  }, [isEmbedded, storeSelectedAssistantId, assistantTree, selectAssistant]);

  // 关闭右键菜单（点击其他地方）
  useEffect(() => {
    const handleClick = () => {
      if (contextMenu.isOpen) {
        setContextMenu({ isOpen: false, x: 0, y: 0, nodeType: null, nodeData: null });
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu.isOpen]);

  // Derived state
  const selectedCharacter = useMemo(() => {
    if (!selectedCharacterId) return null;
    return characters.find(c => c.id === selectedCharacterId);
  }, [characters, selectedCharacterId]);

  const selectedAppearance = useMemo(() => {
    if (!selectedCharacter || !selectedAppearanceId) return null;
    return selectedCharacter.appearances.find(a => a.id === selectedAppearanceId) || null;
  }, [selectedCharacter, selectedAppearanceId]);

  // Navigation handlers
  const handleSelectAssistant = (assistantId: string) => {
    setSelectedCharacterId(null);
    setSelectedAppearanceId(null);
    selectAssistant(assistantId);
    // 保持 assistant 视图，显示角色卡片列表
  };

  const handleSelectCharacter = (characterId: string) => {
    setSelectedCharacterId(characterId);
    setSelectedAppearanceId(null);
    setViewMode('character-detail');
  };

  const handleSelectAppearance = (appearanceId: string) => {
    setSelectedAppearanceId(appearanceId);
    setViewMode('appearance-detail');
  };

  const handleBackToAssistants = () => {
    setViewMode('assistant');
    setSelectedCharacterId(null);
    setSelectedAppearanceId(null);
  };

  const handleBackToCharacters = () => {
    setViewMode('character-detail');
    setSelectedAppearanceId(null);
  };

  // Character/Appearance update handlers
  const handleSaveCharacter = async (updates: { name: string; description?: string }) => {
    if (selectedCharacter) {
      await updateCharacter(selectedCharacter.id, updates);
      // 重新加载角色列表
      await loadAllCharacters();
    }
  };

  const handleSaveAppearance = async (updates: { name: string; description?: string }) => {
    if (selectedAppearance && selectedCharacter) {
      await updateAppearance(selectedAppearance.id, updates);
      // 重新加载角色列表
      await loadAllCharacters();
    }
  };

  // Action handlers - 调用后端命令
  const handleAddAction = async (data: AddActionFormData) => {
    if (!selectedCharacter) return;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('add_action', {
        characterId: selectedCharacter.id,
        appearanceId: selectedAppearanceId,
        actionKey: `${data.domain}-${data.category}-${data.actionId}`,
        resourceType: data.resourceType,
        loopValue: data.loop,
        description: data.description,
      });
      // 重新加载角色列表
      await loadAllCharacters();
    } catch (error) {
      console.error('Failed to add action:', error);
      throw error;
    }
  };

  const handleEditAction = async (data: EditActionFormData) => {
    if (!selectedCharacter) return;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('update_action', {
        characterId: selectedCharacter.id,
        appearanceId: selectedAppearanceId,
        oldKey: data.currentKey,
        newKey: data.newKey,
        loopValue: data.loop,
        description: data.description,
      });
      // 重新加载角色列表
      await loadAllCharacters();
    } catch (error) {
      console.error('Failed to update action:', error);
      throw error;
    }
  };

  const handleDeleteAction = async (key: string) => {
    if (!selectedCharacter) return;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_action', {
        characterId: selectedCharacter.id,
        appearanceId: selectedAppearanceId,
        actionKey: key,
      });
      // 重新加载角色列表
      await loadAllCharacters();
    } catch (error) {
      console.error('Failed to delete action:', error);
      throw error;
    }
  };

  const handleUpdateResources = async (actionKey: string, resources: string[]) => {
    if (!selectedCharacter) return;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('update_action_resources', {
        characterId: selectedCharacter.id,
        appearanceId: selectedAppearanceId,
        actionKey,
        resources,
      });
      // 重新加载角色列表
      await loadAllCharacters();
    } catch (error) {
      console.error('Failed to update resources:', error);
      throw error;
    }
  };

  // 右键菜单处理函数
  const handleContextMenu = (
    e: React.MouseEvent,
    nodeType: 'app' | 'assistant',
    nodeData: { id: string; name: string; appType?: string; agentLabel?: string }
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      nodeType,
      nodeData,
    });
  };

  const closeContextMenu = () => {
    setContextMenu({
      isOpen: false,
      x: 0,
      y: 0,
      nodeType: null,
      nodeData: null,
    });
  };

  // 编辑助手
  const handleEditAssistant = () => {
    if (!contextMenu.nodeData) return;
    closeContextMenu();
    setAssistantModal({
      isOpen: true,
      isEdit: true,
      assistant: {
        id: contextMenu.nodeData.id,
        name: contextMenu.nodeData.name,
        description: undefined, // 从 store 加载完整数据时会填充
      },
    });
  };

  // 助手弹窗确认 (MVP阶段：只更新名称和描述)
  const handleAssistantModalConfirm = async (data: {
    name: string;
    description: string;
  }) => {
    console.log('[handleAssistantModalConfirm] Starting save:', {
      isEdit: assistantModal.isEdit,
      assistantId: assistantModal.assistant?.id,
      data
    });
    try {
      if (assistantModal.isEdit && assistantModal.assistant) {
        // 编辑模式：只更新名称和描述
        console.log('[handleAssistantModalConfirm] Calling updateAssistant...');
        await updateAssistant(assistantModal.assistant.id, {
          name: data.name,
          description: data.description || undefined,
        });
        console.log('[handleAssistantModalConfirm] updateAssistant completed, calling loadAssistants...');
        await loadAssistants();
        console.log('[handleAssistantModalConfirm] loadAssistants completed');
      }
      setAssistantModal({ isOpen: false, isEdit: false, assistant: null });
    } catch (error) {
      console.error('[handleAssistantModalConfirm] Failed to save assistant:', error);
      alert(t('character.saveError', { error }));
    }
  };

  const handleAssistantModalClose = () => {
    setAssistantModal({ isOpen: false, isEdit: false, assistant: null });
  };

  // Loading state
  const isLoading = useCharacterManagementStore(state => state.isLoading);
  const error = useCharacterManagementStore(state => state.error);

  // Render views
  // 第一层：助手树 + 角色卡片
  if (viewMode === 'assistant') {
    // 嵌入模式：紧凑布局
    if (isEmbedded) {
      return (
        <div className="character-management embedded">
          {/* 主内容区：助手树 + 角色卡 */}
          <div className="cm-layout-embedded">
            {/* 左侧：助手树（紧凑版） */}
            <div className="cm-assistant-tree-compact">
              {/* 区域标题 */}
              <div className="section-title-compact">{t('character.assistantList')}</div>
              <div className="assistant-tree-compact">
                {assistantTree.map(node => (
                  <div key={node.id} className="tree-node-compact">
                    {/* App节点 */}
                    <div
                      className="app-item"
                      onClick={() => {
                        setExpandedApps(prev => {
                          const next = new Set(prev);
                          if (next.has(node.id)) {
                            next.delete(node.id);
                          } else {
                            next.add(node.id);
                          }
                          return next;
                        });
                      }}
                    >
                      <span className={`tree-toggle ${expandedApps.has(node.id) ? 'expanded' : ''}`}>
                        {expandedApps.has(node.id) ? '▼' : '▶'}
                      </span>
                      <span className="assistant-icon">{node.type === 'app' ? '📦' : '🤖'}</span>
                      <span className="app-name">{node.name}</span>
                    </div>
                    {/* 助手子节点 */}
                    {expandedApps.has(node.id) && node.children?.map(child => (
                      <div
                        key={child.id}
                        className={`assistant-item ${storeSelectedAssistantId === child.id ? 'selected' : ''}`}
                        onClick={() => handleSelectAssistant(child.id)}
                      >
                        <span className="assistant-indent"></span>
                        <span className="assistant-icon">{child.type === 'assistant' ? '🤖' : '📦'}</span>
                        <span className="assistant-name">{child.name}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* 右侧：助手信息 + 角色卡片网格 */}
            <div className="cm-character-grid-embedded">
              {/* 助手基本信息区域 */}
              {currentAssistant && (
                <div className="cm-assistant-info-embedded">
                  <div className="assistant-info-header">
                    <span className="assistant-info-name">{currentAssistant.name}</span>
                    <button className="btn-edit-compact" onClick={() => {
                      setAssistantModal({
                        isOpen: true,
                        isEdit: true,
                        assistant: {
                          id: currentAssistant.id,
                          name: currentAssistant.name,
                          description: currentAssistant.description,
                        },
                      });
                    }}>✎</button>
                  </div>
                  <div className="assistant-info-details">
                    <div className="info-row-compact">
                      <span className="info-label">ID:</span>
                      <span className="info-value">{currentAssistant.id}</span>
                    </div>
                    {currentAssistant.description && (
                      <div className="info-row-compact">
                        <span className="info-label">{t('character.description')}:</span>
                        <span className="info-value">{currentAssistant.description}</span>
                      </div>
                    )}
                    <div className="info-row-compact">
                      <span className="info-label">{t('character.appType')}:</span>
                      <span className="info-value">{currentAssistant.appType}</span>
                    </div>
                    {currentAssistant.boundAgentId && (
                      <div className="info-row-compact">
                        <span className="info-label">{t('character.boundAgentId')}:</span>
                        <span className="info-value code">{currentAssistant.boundAgentId}</span>
                      </div>
                    )}
                    <div className="info-row-compact">
                      <span className="info-label">{t('character.sessionKey')}:</span>
                      <span className="info-value code">
                        {currentAssistant.integrations?.[0]?.params?.sessionKeys?.[0] || '-'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 角色卡片网格 */}
              <div className="card-grid-embedded">
                {characters.map(character => (
                  <CharacterCard
                    key={character.id}
                    character={character}
                    onClick={() => handleSelectCharacter(character.id)}
                  />
                ))}
                {characters.length === 0 && (
                  <div className="empty-state-compact">
                    <div className="empty-icon">🎭</div>
                    <div className="empty-text">
                      {storeSelectedAssistantId ? t('character.noAssistantCharacters') : t('character.pleaseSelectAssistant')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 右键菜单 */}
          {contextMenu.isOpen && (
            <div
              className="context-menu"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              {contextMenu.nodeType === 'assistant' && (
                <div className="context-menu-item" onClick={handleEditAssistant}>
                  {t('character.contextMenuEditAssistant')}
                </div>
              )}
            </div>
          )}

          {/* 助手弹窗 */}
          <AssistantModal
            isOpen={assistantModal.isOpen}
            onClose={handleAssistantModalClose}
            onConfirm={handleAssistantModalConfirm}
            assistant={assistantModal.assistant}
            isEdit={assistantModal.isEdit}
          />
        </div>
      );
    }

    // 独立窗口模式：完整布局
    return (
      <div className="character-management">
        {/* Header */}
        <div className="cm-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h2>{t('character.management')}</h2>
            {isLoading && <span className="loading-text">{t('character.loading')}</span>}
            {error && <span className="error-text">{error}</span>}
          </div>
        </div>

        <div className="cm-layout-first">
          {/* 左侧：助手树 */}
          <div className="cm-assistant-tree">
            <div className="tree-header">
              <h3>{t('character.assistants')}</h3>
            </div>
            <div className="tree-search">
              <input
                type="text"
                className="search-input"
                placeholder={t('character.searchAssistant')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {assistantTree.map(node => (
                <AssistantTreeNode
                  key={node.id}
                  node={node}
                  selectedId={storeSelectedAssistantId}
                  onSelect={handleSelectAssistant}
                  onContextMenu={handleContextMenu}
                />
              ))}
            </div>
          </div>

          {/* 右侧：角色卡片列表 */}
          <div className="cm-character-list">
            <div className="list-header">
              <h3>{storeSelectedAssistantId ? t('character.characterList') : t('character.selectAssistant')}</h3>
            </div>
            {/* 助手绑定信息显示 */}
            {currentAssistant && (
              <div style={{
                padding: '12px',
                marginBottom: '16px',
                background: '#f5f5f7',
                borderRadius: '8px',
                fontSize: '13px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{currentAssistant.name}</strong>
                  {currentAssistant.boundAgentId ? (
                    <span style={{
                      padding: '4px 8px',
                      background: '#d4edda',
                      color: '#155724',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      ✓ 已绑定
                    </span>
                  ) : (
                    <span style={{
                      padding: '4px 8px',
                      background: '#fff3cd',
                      color: '#856404',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      未绑定
                    </span>
                  )}
                </div>
                {currentAssistant.boundAgentId && (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#6e6e73' }}>
                    绑定 Agent ID: <code style={{ background: '#fff', padding: '2px 4px', borderRadius: '3px' }}>{currentAssistant.boundAgentId}</code>
                  </div>
                )}
                {currentAssistant.integrations?.[0]?.params?.sessionKeys?.[0] && (
                  <div style={{ fontSize: '11px', color: '#999' }}>
                    Session: {currentAssistant.integrations[0].params.sessionKeys[0]}
                  </div>
                )}
              </div>
            )}
            <div className="card-grid">
              {characters.map(character => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  onClick={() => handleSelectCharacter(character.id)}
                />
              ))}
              {characters.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">🎭</div>
                  <div className="empty-text">
                    {storeSelectedAssistantId ? t('character.noAssistantCharacters') : t('character.pleaseSelectAssistant')}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右键菜单 */}
        {contextMenu.isOpen && (
          <div
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenu.nodeType === 'assistant' && (
              <div className="context-menu-item" onClick={handleEditAssistant}>
                {t('character.contextMenuEditAssistant')}
              </div>
            )}
          </div>
        )}

        {/* 助手弹窗 */}
        <AssistantModal
          isOpen={assistantModal.isOpen}
          onClose={handleAssistantModalClose}
          onConfirm={handleAssistantModalConfirm}
          assistant={assistantModal.assistant}
          isEdit={assistantModal.isEdit}
        />
      </div>
    );
  }

  // 第二层：角色详情
  if (viewMode === 'character-detail' && selectedCharacter) {
    return (
      <CharacterDetailView
        character={selectedCharacter}
        onBack={handleBackToAssistants}
        onSelectAppearance={handleSelectAppearance}
        onSaveCharacter={handleSaveCharacter}
      />
    );
  }

  // 第三层：形象详情
  if (viewMode === 'appearance-detail' && selectedCharacter && selectedAppearance) {
    return (
      <AppearanceDetailView
        character={selectedCharacter}
        appearance={selectedAppearance}
        onBack={handleBackToCharacters}
        onSaveAppearance={handleSaveAppearance}
        onAddAction={handleAddAction}
        onEditAction={handleEditAction}
        onDeleteAction={handleDeleteAction}
        onUpdateResources={handleUpdateResources}
      />
    );
  }

  return null;
}
