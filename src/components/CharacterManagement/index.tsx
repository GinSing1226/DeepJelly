/**
 * Character Management Component
 *
 * 角色管理组件 - 主入口
 * 提供三层导航：助手树 → 角色列表 → 形象详情
 *
 * 遵循需求文档 docs/private_docs/Reqs/4.2.角色管理.md
 */

import { useState, useEffect, useMemo, useRef } from 'react';
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
import CharacterModal from './CharacterModal';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import type { Character } from '@/types/character';
import type { AddActionFormData, EditActionFormData } from '@/types/character';

// 引入设计系统（确保 CSS tokens 可用）
import '@/styles/design-system.css';
import './styles.css';
import './enhanced.css';

import { loadThumbnailWithCache } from '@/utils/thumbnailCache';

// SVG Icon Components - DeepJelly Style
const Icons = {
  // App/Package Icon
  Package: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  ),
  // Robot/Assistant Icon
  Bot: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  ),
  // Character/Mask Icon
  Mask: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z" />
      <path d="m15 9-6 3" />
      <path d="M9 9.5v.5" />
      <path d="M15 9.5v.5" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    </svg>
  ),
  // Image/Photo Icon
  Image: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  ),
  // Plus/Add Icon
  Plus: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  ),
  // Edit/Pencil Icon
  Edit: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  ),
  // Chevron Right Icon (for tree toggle)
  ChevronRight: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  ),
  // Chevron Down Icon
  ChevronDown: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  // Trash/Delete Icon
  Trash: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  ),
};

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
  const [isExpanded, setIsExpanded] = useState(true);
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
          <span className={`tree-toggle ${isExpanded ? 'expanded' : ''}`}>
            {isExpanded ? <Icons.ChevronDown /> : <Icons.ChevronRight />}
          </span>
        )}
        <span className="tree-icon">
          {node.type === 'app' ? <Icons.Package /> : <Icons.Bot />}
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
  onEdit,
  onDelete,
}: {
  character: Character;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation(['settings', 'common']);
  const [imgError, setImgError] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasStartedLoadingRef = useRef(false);

  // 使用 IntersectionObserver 实现懒加载
  useEffect(() => {
    const cardElement = cardRef.current;
    if (!cardElement) return;

    // 重置加载状态（组件重新挂载时）
    hasStartedLoadingRef.current = false;

    // 加载封面图的函数
    const loadCoverImage = async () => {
      // 避免重复加载
      if (hasStartedLoadingRef.current || coverUrl || imgError) return;
      hasStartedLoadingRef.current = true;

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

      // 创建新的 AbortController
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setIsLoading(true);

      try {
        // 新的目录结构: {character_id}/{appearance_id}/{action_key}/{resource}
        const fullResourceName = `${firstAppearance.id}/${actionKey}/${firstResource}`;

        // 使用缓存加载缩略图
        const dataUrl = await loadThumbnailWithCache({
          assistantId: character.assistantId,
          characterId: character.id,
          resourceName: fullResourceName,
          maxWidth: 300,
          maxHeight: 300,
        });

        // 检查请求是否被取消
        if (signal.aborted) return;

        setCoverUrl(dataUrl);
        setIsLoading(false);
      } catch (error) {
        // 如果是主动取消的错误，不设置为错误状态
        if (signal.aborted) return;

        const errorMsg = error instanceof Error ? error.message : String(error);
        // 如果是文件过大，静默处理，显示占位符
        if (errorMsg.includes('文件过大') || errorMsg.includes('超过')) {
          setIsLoading(false);
          return;
        }

        console.error('[CharacterCard] Failed to load cover image:', error);
        setImgError(true);
        setIsLoading(false);
      }
    };

    // 创建观察器，当卡片进入视口时才开始加载
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasStartedLoadingRef.current) {
            // 卡片进入视口，开始加载图片
            loadCoverImage();
          }
        });
      },
      { rootMargin: '50px' } // 提前50px开始加载
    );

    observer.observe(cardElement);

    return () => {
      observer.disconnect();
      // 取消正在进行的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [character.id, character.appearances]); // 只依赖必要的字段

  return (
    <div ref={cardRef} className="character-card" onClick={onClick}>
      <div className="card-cover">
        {isLoading ? (
          <div className="card-loading">
            <div className="loading-spinner" />
          </div>
        ) : coverUrl && !imgError ? (
          <img
            src={coverUrl}
            alt={character.name}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="card-placeholder"><Icons.Mask /></div>
        )}
      </div>
      <div className="card-info">
        <div className="card-name">{character.name}</div>
        <div className="card-meta">
          <span className="card-id">{character.id}</span>
          <span className="card-count">{character.appearances?.length || 0} {t('character.appearances')}</span>
        </div>
        {character.description && (
          <div className="card-description-wrapper" title={character.description}>
            <div className="card-description">{character.description}</div>
          </div>
        )}
        {(onEdit || onDelete) && (
          <div className="card-actions">
            {onEdit && (
              <button
                className="btn-edit-card"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                title={t('common:edit')}
              >
                <Icons.Edit />
              </button>
            )}
            {onDelete && (
              <button
                className="btn-delete-card"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                title={t('common:delete')}
              >
                <Icons.Trash />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 角色列表面板组件（右侧内容区）
 */
interface CharacterListPanelProps {
  currentAssistant: { id: string; name: string; description?: string; appType?: string; boundAgentId?: string } | null;
  characters: Character[];
  storeSelectedAssistantId: string | null;
  onSelectCharacter: (id: string) => void;
  onAddCharacter: () => void;
  onEditAssistant: (assistant: { id: string; name: string; description?: string }) => void;
  onEditCharacter?: (character: Character) => void;
  onDeleteCharacter?: (character: Character) => void;
  t: (key: string) => string;
}

function CharacterListPanel({
  currentAssistant,
  characters,
  storeSelectedAssistantId,
  onSelectCharacter,
  onAddCharacter,
  onEditAssistant,
  onEditCharacter,
  onDeleteCharacter,
  t,
}: CharacterListPanelProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9; // 3x3 网格

  // 分页计算
  const totalPages = Math.ceil(characters.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedCharacters = characters.slice(startIndex, startIndex + pageSize);

  // 数据变化时重置页码
  useEffect(() => {
    setCurrentPage(1);
  }, [storeSelectedAssistantId]);

  return (
    <div className="cm-character-grid-embedded">
      {/* 头部标题栏 - 包含名称、ID、描述、编辑按钮 */}
      {currentAssistant && (
        <div className="cm-list-header-bar">
          <div className="cm-list-title-section">
            <div className="cm-list-title-row">
              <h3 className="cm-list-title">
                <span className="icon"><Icons.Package /></span>
                {currentAssistant.name}
                <span className="cm-list-count">{characters.length}</span>
              </h3>
            </div>
            {/* ID 和描述放在名称下方 */}
            <div className="cm-assistant-meta-inline">
              <span className="cm-assistant-id">{currentAssistant.id}</span>
              {currentAssistant.description && (
                <span className="cm-assistant-description">{currentAssistant.description}</span>
              )}
              {currentAssistant.boundAgentId && (
                <span className="bound-badge">已绑定</span>
              )}
            </div>
          </div>
          <div className="cm-list-actions">
            <button
              className="btn-edit-header"
              onClick={() => onEditAssistant({
                id: currentAssistant.id,
                name: currentAssistant.name,
                description: currentAssistant.description,
              })}
              title="编辑助手"
            >
              <Icons.Edit />
            </button>
          </div>
        </div>
      )}

      {/* 新增角色按钮区域 */}
      {currentAssistant && (
        <div className="cm-add-character-bar">
          <button className="btn-add-character-full" onClick={onAddCharacter}>
            <span>+</span>
            {t('character.addCharacter')}
          </button>
        </div>
      )}

      {/* 角色卡片网格 */}
      <div className="card-grid-embedded">
        {paginatedCharacters.map(character => (
          <CharacterCard
            key={character.id}
            character={character}
            onClick={() => onSelectCharacter(character.id)}
            onEdit={onEditCharacter ? () => onEditCharacter(character) : undefined}
            onDelete={onDeleteCharacter ? () => onDeleteCharacter(character) : undefined}
          />
        ))}
        {characters.length === 0 && (
          <div className="empty-state-compact full-width">
            <div className="empty-icon"><Icons.Mask /></div>
            <div className="empty-text">
              {storeSelectedAssistantId ? t('character.noAssistantCharacters') : t('character.pleaseSelectAssistant')}
            </div>
            {storeSelectedAssistantId && (
              <button className="btn-add-first-inline" onClick={onAddCharacter}>
                + {t('character.addFirstCharacter')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 分页控制器 */}
      {totalPages > 1 && (
        <div className="cm-pagination">
          <button
            className="pagination-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          >
            ←
          </button>
          <span className="pagination-info">
            {currentPage} / {totalPages}
          </span>
          <button
            className="pagination-btn"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 主组件
 */
export default function CharacterManagement({ isWindow: _isWindow }: CharacterManagementProps) {
  const { t } = useTranslation(['settings', 'common']);
  // Store selectors and actions
  const assistantTree = useCharacterManagementStore(selectAssistantTree);
  const loadAssistants = useCharacterManagementStore(state => state.loadAssistants);
  const loadAllCharacters = useCharacterManagementStore(state => state.loadAllCharacters);
  const selectAssistant = useCharacterManagementStore(state => state.selectAssistant);
  const updateCharacter = useCharacterManagementStore(state => state.updateCharacter);
  const updateAppearance = useCharacterManagementStore(state => state.updateAppearance);
  const setDefaultAppearance = useCharacterManagementStore(state => state.setDefaultAppearance);
  const characters = useCharacterManagementStore(selectCurrentCharacters);
  const currentAssistant = useCharacterManagementStore(selectCurrentAssistant);
  const searchQuery = useCharacterManagementStore(state => state.searchQuery);
  const setSearchQuery = useCharacterManagementStore(state => state.setSearchQuery);
  const updateAssistant = useCharacterManagementStore(state => state.updateAssistant);
  const addAssistant = useCharacterManagementStore(state => state.addAssistant);
  const deleteAssistant = useCharacterManagementStore(state => state.deleteAssistant);
  const addAppearance = useCharacterManagementStore(state => state.addAppearance);
  const deleteAppearance = useCharacterManagementStore(state => state.deleteAppearance);
  const loadCharacters = useCharacterManagementStore(state => state.loadCharacters);

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

  // 角色弹窗状态
  const [characterModal, setCharacterModal] = useState<{
    isOpen: boolean;
    isEdit: boolean;
    character: { id: string; name: string; description?: string } | null;
  }>({
    isOpen: false,
    isEdit: false,
    character: null,
  });

  // 删除确认对话框状态
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    itemName: string;
    itemType: 'assistant' | 'character' | 'appearance';
    itemId: string;
    warning?: string;
  }>({
    isOpen: false,
    itemName: '',
    itemType: 'assistant',
    itemId: '',
  });

  // Store methods
  const addCharacter = useCharacterManagementStore(state => state.addCharacter);
  const deleteCharacter = useCharacterManagementStore(state => state.deleteCharacter);

  // Initialize data on mount
  useEffect(() => {
    loadAssistants();
    loadAllCharacters();
  }, [loadAssistants, loadAllCharacters]);

  // Auto-select first assistant when data loads
  useEffect(() => {
    if (!storeSelectedAssistantId && assistantTree.length > 0) {
      // Find the first assistant (type === 'assistant') from the tree
      for (const node of assistantTree) {
        if (node.children && node.children.length > 0) {
          const firstAssistant = node.children.find(c => c.type === 'assistant');
          if (firstAssistant) {
            selectAssistant(firstAssistant.id);
            break;
          }
        }
      }
    }
  }, [storeSelectedAssistantId, assistantTree, selectAssistant]);

  // Auto-expand all assistant tree nodes
  useEffect(() => {
    if (assistantTree.length > 0) {
      const allNodeIds = new Set(assistantTree.map(node => node.id));
      setExpandedApps(allNodeIds);
    }
  }, [assistantTree]);

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

  // 删除角色处理函数
  const handleDeleteCharacter = async () => {
    if (!selectedCharacter) return;

    try {
      await deleteCharacter(selectedCharacter.id);
      await loadAllCharacters();
      // 返回助手列表视图
      handleBackToAssistants();
    } catch (error) {
      console.error('[handleDeleteCharacter] Failed to delete character:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      alert(t('character.deleteError', { error: errorMsg }));
    }
  };

  // 设置默认形象处理函数
  const handleSetDefaultAppearance = async (appearanceId: string) => {
    if (!selectedCharacter) return;

    try {
      // 更新后端：设置默认形象
      await setDefaultAppearance(selectedCharacter.id, appearanceId);
      // 重新加载角色列表
      await loadAllCharacters();
    } catch (error) {
      console.error('[handleSetDefaultAppearance] Failed to set default appearance:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      alert(`设置默认形象失败: ${errorMsg}`);
    }
  };

  // 新增形象处理函数
  const handleAddAppearance = async () => {
    if (!selectedCharacter) return;

    try {
      await addAppearance(selectedCharacter.id, {
        name: `${t('character.newAppearance')} ${selectedCharacter.appearances.length + 1}`,
        isDefault: selectedCharacter.appearances.length === 0,
        actions: {},
      });
      // 重新加载角色列表
      await loadCharacters(storeSelectedAssistantId!);
    } catch (error) {
      console.error('[handleAddAppearance] Failed to add appearance:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      alert(t('character.addAppearanceError', { error: errorMsg }));
    }
  };

  // 删除形象处理函数
  const handleDeleteAppearance = async (appearanceId: string) => {
    if (!selectedCharacter) return;

    try {
      await deleteAppearance(appearanceId);
      // 重新加载角色列表
      await loadCharacters(storeSelectedAssistantId!);
    } catch (error) {
      console.error('[handleDeleteAppearance] Failed to delete appearance:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      alert(t('character.deleteAppearanceError', { error: errorMsg }));
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

  const handleUpdateResources = async (actionKey: string, resources: string[] | null) => {
    if (!selectedCharacter) {
      console.error('[handleUpdateResources] No selected character, skipping update');
      return;
    }

    try {
      // 如果 resources 是 null，表示这是一个"刷新数据"信号
      // 后端命令（如 data_add_action_resources）已经更新了配置文件
      // 我们只需要重新加载数据即可
      if (resources === null) {
        await loadAllCharacters();
        return;
      }

      // 否则，这是传统的资源更新流程（现在不常用，但保留兼容性）
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('data_update_action_resources', {
        characterId: selectedCharacter.id,
        appearanceId: selectedAppearanceId,
        actionKey,
        resources,
      });
      // 新命令直接更新 assistants.json，需要重新加载以获取最新数据
      await loadAllCharacters();
    } catch (error) {
      console.error('[handleUpdateResources] Failed:', error);
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

  // 删除助手 - 使用确认对话框
  const handleDeleteAssistant = () => {
    if (!contextMenu.nodeData) return;
    const assistantId = contextMenu.nodeData.id;
    const assistantName = contextMenu.nodeData.name;

    closeContextMenu();

    // 检查是否有角色
    const assistantCharacters = characters.filter(c => c.assistantId === assistantId);
    if (assistantCharacters.length > 0) {
      setDeleteConfirm({
        isOpen: true,
        itemName: assistantName,
        itemType: 'assistant',
        itemId: assistantId,
        warning: `该助手下还有 ${assistantCharacters.length} 个角色，请先删除所有角色后再删除助手`,
      });
      return;
    }

    // 显示删除确认对话框
    setDeleteConfirm({
      isOpen: true,
      itemName: assistantName,
      itemType: 'assistant',
      itemId: assistantId,
    });
  };

  // 确认删除助手
  const handleConfirmDelete = async () => {
    const { itemId, itemType } = deleteConfirm;

    try {
      if (itemType === 'assistant') {
        await deleteAssistant(itemId);
        await loadAssistants();
        // 如果删除的是当前选中的助手，清除选中状态
        if (storeSelectedAssistantId === itemId) {
          selectAssistant(null);
        }
      } else if (itemType === 'character') {
        await deleteCharacter(itemId);
        await loadAllCharacters();
        handleBackToAssistants();
      }
    } catch (error) {
      console.error('[handleConfirmDelete] Failed to delete:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      alert(t('character.deleteError', { error: errorMsg }));
    }
  };

  // 新增助手
  const handleAddAssistant = () => {
    setAssistantModal({
      isOpen: true,
      isEdit: false,
      assistant: null,
    });
  };

  // 新增角色
  const handleAddCharacter = () => {
    if (!storeSelectedAssistantId) return;
    setCharacterModal({
      isOpen: true,
      isEdit: false,
      character: null,
    });
  };

  // 助手弹窗确认
  const handleAssistantModalConfirm = async (data: {
    id?: string;
    name: string;
    description: string;
  }) => {
    try {
      if (assistantModal.isEdit && assistantModal.assistant) {
        // 编辑模式：只更新名称和描述
        await updateAssistant(assistantModal.assistant.id, {
          name: data.name,
          description: data.description || undefined,
        });
        await loadAssistants();
      } else {
        // 新增模式：创建新助手
        const newAssistant = await addAssistant({
          id: data.id,
          name: data.name,
          description: data.description || undefined,
          appType: 'openclaw', // 默认使用 openclaw 应用类型
          agentLabel: undefined,
          characters: [],
        });
        // 重新加载助手列表
        await loadAssistants();
        // 自动选中新增的助手
        selectAssistant(newAssistant.id);
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

  // 角色弹窗确认
  const handleCharacterModalConfirm = async (data: {
    id?: string;
    name: string;
    description?: string;
  }) => {
    if (!storeSelectedAssistantId) return;

    try {
      if (characterModal.isEdit && characterModal.character) {
        // 编辑模式：更新角色
        await updateCharacter(characterModal.character.id, {
          name: data.name,
          description: data.description,
        });
        await loadAllCharacters();
      } else {
        // 新增模式：创建新角色
        await addCharacter(storeSelectedAssistantId, {
          name: data.name,
          description: data.description,
        });
        // 角色列表会自动更新
      }
      setCharacterModal({ isOpen: false, isEdit: false, character: null });
    } catch (error) {
      console.error('[handleCharacterModalConfirm] Failed to save character:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      alert(t('character.saveError', { error: errorMsg }));
    }
  };

  const handleCharacterModalClose = () => {
    setCharacterModal({ isOpen: false, isEdit: false, character: null });
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
              {/* 区域标题 + 新增按钮 */}
              <div className="section-header-compact" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span className="section-title-compact">{t('character.assistantList')}</span>
                <button
                  className="btn-add-compact"
                  onClick={handleAddAssistant}
                  style={{
                    padding: '6px 14px',
                    fontSize: '13px',
                    background: '#1A1A1A',
                    color: '#FAF9F6',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '500',
                  }}
                  title="新增助手"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#4A4A4A';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#1A1A1A';
                  }}
                >
                  + {t('character.addAssistant')}
                </button>
              </div>
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
                        {expandedApps.has(node.id) ? <Icons.ChevronDown /> : <Icons.ChevronRight />}
                      </span>
                      <span className="assistant-icon">{node.type === 'app' ? <Icons.Package /> : <Icons.Bot />}</span>
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
                        <span className="assistant-icon">{child.type === 'assistant' ? <Icons.Bot /> : <Icons.Package />}</span>
                        <span className="assistant-name">{child.name}</span>
                        <div className="assistant-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="assistant-action-btn"
                            onClick={() => setAssistantModal({
                              isOpen: true,
                              isEdit: true,
                              assistant: { id: child.id, name: child.name, description: child.description },
                            })}
                            title={t('character.contextMenuEditAssistant')}
                          >
                            <Icons.Edit />
                          </button>
                          <button
                            className="assistant-action-btn assistant-action-delete"
                            onClick={() => {
                              const assistantChars = characters.filter(c => c.assistantId === child.id);
                              if (assistantChars.length > 0) {
                                setDeleteConfirm({
                                  isOpen: true,
                                  itemName: child.name,
                                  itemType: 'assistant',
                                  itemId: child.id,
                                  warning: `该助手下还有 ${assistantChars.length} 个角色，请先删除所有角色后再删除助手`,
                                });
                                return;
                              }
                              setDeleteConfirm({
                                isOpen: true,
                                itemName: child.name,
                                itemType: 'assistant',
                                itemId: child.id,
                              });
                            }}
                            title={t('character.contextMenuDeleteAssistant')}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* 右侧：助手信息 + 角色卡片网格 */}
            <CharacterListPanel
              currentAssistant={currentAssistant}
              characters={characters}
              storeSelectedAssistantId={storeSelectedAssistantId}
              onSelectCharacter={handleSelectCharacter}
              onAddCharacter={handleAddCharacter}
              onEditAssistant={(assistant) => setAssistantModal({
                isOpen: true,
                isEdit: true,
                assistant: {
                  id: assistant.id,
                  name: assistant.name,
                  description: assistant.description,
                },
              })}
              onEditCharacter={(character) => setCharacterModal({
                isOpen: true,
                isEdit: true,
                character: character,
              })}
              onDeleteCharacter={(character) => setDeleteConfirm({
                isOpen: true,
                itemName: character.name,
                itemType: 'character',
                itemId: character.id,
              })}
              t={t}
            />
          </div>

          {/* 右键菜单 */}
          {contextMenu.isOpen && (
            <div
              className="context-menu"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              {contextMenu.nodeType === 'assistant' && (
                <>
                  <div className="context-menu-item" onClick={handleEditAssistant}>
                    {t('character.contextMenuEditAssistant')}
                  </div>
                  <div className="context-menu-item" onClick={handleDeleteAssistant}>
                    {t('character.contextMenuDeleteAssistant')}
                  </div>
                </>
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

          {/* 角色弹窗 */}
          <CharacterModal
            isOpen={characterModal.isOpen}
            onClose={handleCharacterModalClose}
            onConfirm={handleCharacterModalConfirm}
            character={characterModal.character}
            isEdit={characterModal.isEdit}
          />

          {/* 删除确认对话框 */}
          <DeleteConfirmDialog
            isOpen={deleteConfirm.isOpen}
            onClose={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
            onConfirm={handleConfirmDelete}
            itemName={deleteConfirm.itemName}
            itemType={deleteConfirm.itemType}
            warning={deleteConfirm.warning}
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
                  <div className="empty-icon"><Icons.Mask /></div>
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
              <>
                <div className="context-menu-item" onClick={handleEditAssistant}>
                  {t('character.contextMenuEditAssistant')}
                </div>
                <div className="context-menu-item" onClick={handleDeleteAssistant}>
                  {t('character.contextMenuDeleteAssistant')}
                </div>
              </>
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

        {/* 角色弹窗 */}
        <CharacterModal
          isOpen={characterModal.isOpen}
          onClose={handleCharacterModalClose}
          onConfirm={handleCharacterModalConfirm}
          character={characterModal.character}
          isEdit={characterModal.isEdit}
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
        onDeleteCharacter={handleDeleteCharacter}
        onAddAppearance={handleAddAppearance}
        onDeleteAppearance={handleDeleteAppearance}
        onSetDefaultAppearance={handleSetDefaultAppearance}
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
