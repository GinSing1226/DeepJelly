/**
 * Character Detail View Component
 *
 * 角色详情组件（第二层导航）
 * 显示角色基本信息（可编辑）和形象卡片列表
 * DeepJelly 设计系统 - 米白+深炭黑淡雅风格
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { useCharacterManagementStore } from '@/stores/characterManagementStore';
import { DEFAULT_ACTIONS } from '@/types/character';
import type { Character } from '@/types/character';
import { loadThumbnailWithCache } from '@/utils/thumbnailCache';
import AppearanceModal from './AppearanceModal';
import DeleteConfirmDialog from './DeleteConfirmDialog';

interface CharacterDetailViewProps {
  /** 角色数据 */
  character: Character;
  /** 返回回调 */
  onBack: () => void;
  /** 选择形象回调 */
  onSelectAppearance: (appearanceId: string) => void;
  /** 保存角色信息回调 */
  onSaveCharacter: (updates: { name: string; description?: string }) => void;
  /** 删除角色回调 */
  onDeleteCharacter?: () => void;
  /** 新增形象回调 */
  onAddAppearance?: () => void;
  /** 删除形象回调 */
  onDeleteAppearance?: (appearanceId: string) => void;
  /** 设置默认形象回调 */
  onSetDefaultAppearance?: (appearanceId: string) => void;
}

// SVG Icons - DeepJelly Style
const Icons = {
  Image: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  ),
  Star: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  ),
  ArrowLeft: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19l-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  ),
  Edit: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  ),
};

/**
 * 形象卡片组件
 */
function AppearanceCard({
  appearance,
  isDefault,
  onClick,
  t,
  character,
  onEdit,
  onSetDefault,
  onDelete,
}: {
  appearance: Character['appearances'][0];
  isDefault: boolean;
  onClick: () => void;
  t: (key: string) => string;
  character: Character;
  onEdit?: () => void;
  onSetDefault?: () => void;
  onDelete?: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const actionCount = Object.keys(appearance.actions).length;
  const cardRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasStartedLoadingRef = useRef(false);

  // 使用 IntersectionObserver 实现懒加载
  useEffect(() => {
    const cardElement = cardRef.current;
    if (!cardElement) return;

    // 重置加载状态
    hasStartedLoadingRef.current = false;

    // 加载封面图的函数
    const loadCoverImage = async () => {
      // 避免重复加载
      if (hasStartedLoadingRef.current || coverUrl || imgError) return;
      hasStartedLoadingRef.current = true;

      const actionKeys = Object.keys(appearance.actions);
      if (actionKeys.length === 0) return;

      // 优先查找 idle 动作（通常是 internal-base-idle）
      const idleActionKey = actionKeys.find(key => key.toLowerCase().includes('idle'));
      const actionKey = idleActionKey || actionKeys[0];

      const firstAction = appearance.actions[actionKey];
      const firstResource = firstAction?.resources?.[0];

      if (!firstResource) return;

      // 创建新的 AbortController
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setIsLoading(true);

      try {
        // 新的目录结构: {character_id}/{appearance_id}/{action_key}/{resource}
        const fullResourceName = `${appearance.id}/${actionKey}/${firstResource}`;

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
        // 如果是文件过大，不显示错误状态，直接用占位符
        if (errorMsg.includes('文件过大') || errorMsg.includes('超过')) {
          setIsLoading(false);
          return;
        }

        console.error('[AppearanceCard] Failed to load cover image:', error);
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
      { rootMargin: '50px' }
    );

    observer.observe(cardElement);

    return () => {
      observer.disconnect();
      // 取消正在进行的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [appearance.id, appearance.actions, character.id, character.assistantId]);

  return (
    <div ref={cardRef} className="character-card appearance-card" onClick={onClick}>
      <div className="card-cover">
        {isLoading ? (
          <div className="card-loading">
            <div className="loading-spinner" />
          </div>
        ) : coverUrl && !imgError ? (
          <img
            src={coverUrl}
            alt={appearance.name}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="card-placeholder"><Icons.Image /></div>
        )}
        {isDefault && (
          <div className="card-badge">{t('character.default')}</div>
        )}
      </div>
      <div className="card-info">
        <div className="card-name">{appearance.name}</div>
        <div className="card-meta">
          <span className="card-id">{appearance.id}</span>
          <span className="card-count">{actionCount} {t('character.actions')}</span>
        </div>
        {appearance.description && (
          <div className="card-description-wrapper" title={appearance.description}>
            <div className="card-description">{appearance.description}</div>
          </div>
        )}
        <div className="card-actions">
          {onEdit && (
            <button
              className="btn-edit-appearance"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              title={t('character.edit') || '编辑'}
            >
              <Icons.Edit />
            </button>
          )}
          {!isDefault && onSetDefault && (
            <button
              className="btn-set-default"
              onClick={(e) => {
                e.stopPropagation();
                onSetDefault();
              }}
              title={t('character.setDefault') || '设为默认'}
            >
              <Icons.Star />
            </button>
          )}
          {onDelete && (
            <button
              className="btn-delete-appearance"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title={t('character.delete') || '删除'}
            >
              <Icons.Trash />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 描述Tooltip组件
 */
function DescriptionTooltip({ description }: { description: string }) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <span
      className="cd-info-tooltip-trigger"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="cd-info-icon">ⓘ</span>
      {showTooltip && (
        <div className="cd-info-tooltip">
          <div className="tooltip-content">{description}</div>
        </div>
      )}
    </span>
  );
}

/**
 * 统一头部工具栏 - 包含返回、名称、ID、操作按钮在一行
 */
function UnifiedHeader({
  character,
  onBack,
  onSave,
  t,
  onDelete,
}: {
  character: Character;
  onBack: () => void;
  onSave: (updates: { name: string; description?: string }) => void;
  t: (key: string) => string;
  onDelete?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(character.name);
  const [description, setDescription] = useState(character.description || '');

  const handleSave = () => {
    onSave({ name, description: description || undefined });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setName(character.name);
    setDescription(character.description || '');
    setIsEditing(false);
  };

  return (
    <div className="cd-unified-header">
      <div className="cd-header-left">
        <button className="cd-btn-back" onClick={onBack} title={t('character.back')}>
          <Icons.ArrowLeft />
        </button>

        {isEditing ? (
          <div className="cd-header-edit-row">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="cd-header-input"
              placeholder={t('character.name')}
              autoFocus
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="cd-header-input desc"
              placeholder={t('character.description')}
            />
          </div>
        ) : (
          <div className="cd-header-info-row">
            <span className="cd-header-name">{character.name}</span>
            {character.description && (
              <DescriptionTooltip description={character.description} />
            )}
            <span className="cd-header-id">{character.id}</span>
          </div>
        )}
      </div>

      <div className="cd-header-actions">
        {isEditing ? (
          <>
            <button className="cd-btn-save" onClick={handleSave}>{t('character.save')}</button>
            <button className="cd-btn-cancel" onClick={handleCancel}>{t('character.cancel')}</button>
          </>
        ) : (
          <>
            <button
              className="cd-btn-edit"
              onClick={() => setIsEditing(true)}
              title={t('character.edit') || '编辑'}
            >
              <Icons.Edit />
            </button>
            {onDelete && (
              <button className="cd-btn-delete" onClick={onDelete} title={t('character.delete')}>
                <Icons.Trash />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 形象列表面板组件（带分页）
 */
function AppearanceListPanel({
  appearances,
  defaultAppearanceId,
  character,
  onSelectAppearance,
  onOpenAddAppearance,
  onOpenEditAppearance,
  onSetDefaultAppearance,
  onDeleteAppearance,
  t,
}: {
  appearances: Character['appearances'];
  defaultAppearanceId: string | undefined;
  character: Character;
  onSelectAppearance: (id: string) => void;
  onOpenAddAppearance: () => void;
  onOpenEditAppearance: (appearance: Character['appearances'][0]) => void;
  onSetDefaultAppearance: (id: string) => void;
  onDeleteAppearance: (appearance: Character['appearances'][0]) => void;
  t: (key: string) => string;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8; // 4x2 网格

  const totalPages = Math.ceil(appearances.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedAppearances = appearances.slice(startIndex, startIndex + pageSize);

  // 数据变化时重置页码
  useEffect(() => {
    setCurrentPage(1);
  }, [appearances.length]);

  return (
    <div className="cd-appearances-panel">
      {/* 标题栏 - 与应用集成/展示管理风格一致 */}
      <div className="cd-appearances-header">
        <div className="cd-appearances-title-section">
          <h3 className="cd-appearances-title">
            <span className="icon"><Icons.Image /></span>
            {t('character.appearanceList')}
            <span className="cd-appearances-count">{appearances.length}</span>
          </h3>
        </div>
        <button className="cd-btn-add-appearance" onClick={onOpenAddAppearance}>
          <span>+</span>
          {t('character.addAppearance')}
        </button>
      </div>

      {/* 形象卡片网格 - 一行3个 */}
      <div className="cd-appearances-grid">
        {paginatedAppearances.map((appearance) => (
          <AppearanceCard
            key={appearance.id}
            appearance={appearance}
            isDefault={appearance.id === defaultAppearanceId}
            onClick={() => onSelectAppearance(appearance.id)}
            t={t}
            character={character}
            onEdit={() => onOpenEditAppearance(appearance)}
            onSetDefault={
              appearance.id !== defaultAppearanceId
                ? () => onSetDefaultAppearance(appearance.id)
                : undefined
            }
            onDelete={() => onDeleteAppearance(appearance)}
          />
        ))}
        {appearances.length === 0 && (
          <div className="cd-empty-appearances full-width">
            <div className="empty-icon"><Icons.Image /></div>
            <div className="empty-text">{t('character.noAppearances')}</div>
            <button className="cd-btn-add-first-appearance" onClick={onOpenAddAppearance}>
              + {t('character.addFirstAppearance')}
            </button>
          </div>
        )}
      </div>

      {/* 分页控制器 */}
      {totalPages > 1 && (
        <div className="cd-appearances-pagination">
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
 * 角色详情主组件
 */
export default function CharacterDetailView({
  character,
  onBack,
  onSelectAppearance,
  onSaveCharacter,
  onDeleteCharacter,
  onAddAppearance: _onAddAppearance,
  onDeleteAppearance: _onDeleteAppearance,
  onSetDefaultAppearance: _onSetDefaultAppearance,
}: CharacterDetailViewProps) {
  const { t } = useTranslation('settings');

  // 形象弹窗状态
  const [appearanceModal, setAppearanceModal] = useState<{
    isOpen: boolean;
    mode: 'add' | 'edit';
    appearance?: Character['appearances'][0];
  }>({
    isOpen: false,
    mode: 'add',
  });

  // 删除确认状态
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    itemName: string;
    itemType: 'assistant' | 'character' | 'appearance';
    itemId: string;
    warning?: string;
  }>({
    isOpen: false,
    itemName: '',
    itemType: 'appearance',
    itemId: '',
  });

  // 打开删除角色确认弹窗
  const handleDelete = () => {
    if (onDeleteCharacter) {
      // 检查是否有形象
      if (character.appearances.length > 0) {
        alert(t('character.deleteCharacterHasAppearances', { count: character.appearances.length }));
        return;
      }
      // 打开删除确认弹窗
      setDeleteConfirm({
        isOpen: true,
        itemName: character.name,
        itemType: 'character',
        itemId: character.id,
      });
    }
  };

  // 确认删除角色
  const handleConfirmDeleteCharacter = () => {
    if (onDeleteCharacter) {
      onDeleteCharacter();
    }
    setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
  };

  // 打开新增形象弹窗
  const handleOpenAddAppearance = useCallback(() => {
    setAppearanceModal({
      isOpen: true,
      mode: 'add',
    });
  }, []);

  // 打开编辑形象弹窗
  const handleOpenEditAppearance = useCallback((appearance: Character['appearances'][0]) => {
    setAppearanceModal({
      isOpen: true,
      mode: 'edit',
      appearance,
    });
  }, []);

  // 处理形象弹窗确认
  const handleAppearanceModalConfirm = useCallback(async (data: {
    id?: string;
    name: string;
    description: string;
    isDefault: boolean;
  }) => {
    try {
      if (appearanceModal.mode === 'add') {
        // 新增形象 - 使用默认动作列表
        await invoke('data_add_appearance', {
          characterId: character.id,
          dto: {
            id: data.id,
            name: data.name,
            description: data.description || undefined,
            is_default: data.isDefault,
            actions: JSON.parse(JSON.stringify(DEFAULT_ACTIONS)),
          },
        });
        // 刷新角色列表（直接调用 store，不调用 onAddAppearance）
        await useCharacterManagementStore.getState().loadAllCharacters();
      } else if (appearanceModal.appearance) {
        // 编辑形象
        await invoke('data_update_appearance', {
          characterId: character.id,
          appearanceId: appearanceModal.appearance.id,
          dto: {
            name: data.name,
            description: data.description || undefined,
          },
        });
        // 刷新角色列表
        await useCharacterManagementStore.getState().loadAllCharacters();
      }
      setAppearanceModal({ isOpen: false, mode: 'add' });
    } catch (error) {
      console.error('[CharacterDetailView] Failed to save appearance:', error);
      alert(t('character.saveError', { error: String(error) }) || '保存形象失败');
    }
  }, [appearanceModal.mode, appearanceModal.appearance, character.id, t]);

  // 处理删除形象
  const handleDeleteAppearance = useCallback(async (appearance: Character['appearances'][0]) => {
    // 检查形象是否在展示槽位中使用
    try {
      const result = await invoke<any[]>('get_display_slots');
      const isUsedInSlot = result.some((slot: any) => slot.appearanceId === appearance.id);

      if (isUsedInSlot) {
        alert('该形象正在展示槽位中使用，请先移除或更换槽位中的形象后再删除');
        return;
      }
    } catch (error) {
      console.error('[CharacterDetailView] Failed to check display slots:', error);
      // 即使检查失败也允许删除，避免阻塞用户操作
    }

    // 允许删除任何形象（包括默认形象和最后一个形象）
    setDeleteConfirm({
      isOpen: true,
      itemName: appearance.name,
      itemType: 'appearance',
      itemId: appearance.id,
      warning: undefined,
    });
  }, [t]);

  // 确认删除形象
  const handleConfirmDeleteAppearance = useCallback(async () => {
    try {
      await invoke('data_delete_appearance', {
        characterId: character.id,
        appearanceId: deleteConfirm.itemId,
      });
      setDeleteConfirm({ isOpen: false, itemName: '', itemType: 'appearance', itemId: '' });
      // 刷新角色列表（直接调用 store，不调用 onDeleteAppearance 避免重复操作）
      await useCharacterManagementStore.getState().loadAllCharacters();
    } catch (error) {
      console.error('[CharacterDetailView] Failed to delete appearance:', error);
      alert(t('character.deleteError', { error: String(error) }) || '删除形象失败');
    }
  }, [character.id, deleteConfirm.itemId, t]);

  // 处理设置默认形象
  const handleSetDefaultAppearance = useCallback(async (appearanceId: string) => {
    try {
      await invoke('data_update_appearance', {
        characterId: character.id,
        appearanceId: appearanceId,
        dto: {
          is_default: true,
        },
      });
      // 刷新角色列表（直接调用 store，不调用 onSetDefaultAppearance 避免重复操作）
      await useCharacterManagementStore.getState().loadAllCharacters();
    } catch (error) {
      console.error('[CharacterDetailView] Failed to set default appearance:', error);
      alert(t('character.setDefaultError', { error: String(error) }) || '设置默认形象失败');
    }
  }, [character.id, t]);

  return (
    <div className="character-detail-view">
      {/* 统一头部工具栏 - 返回、名称、ID、操作按钮在一行 */}
      <UnifiedHeader
        character={character}
        onBack={onBack}
        onSave={onSaveCharacter}
        onDelete={onDeleteCharacter ? handleDelete : undefined}
        t={t}
      />

      <div className="cd-content">
        {/* 形象列表面板 */}
        <AppearanceListPanel
          appearances={character.appearances}
          defaultAppearanceId={character.defaultAppearanceId}
          character={character}
          onSelectAppearance={onSelectAppearance}
          onOpenAddAppearance={handleOpenAddAppearance}
          onOpenEditAppearance={handleOpenEditAppearance}
          onSetDefaultAppearance={handleSetDefaultAppearance}
          onDeleteAppearance={handleDeleteAppearance}
          t={t}
        />
      </div>

      {/* 形象编辑弹窗 */}
      <AppearanceModal
        isOpen={appearanceModal.isOpen}
        onClose={() => setAppearanceModal({ isOpen: false, mode: 'add' })}
        onConfirm={handleAppearanceModalConfirm}
        appearance={appearanceModal.appearance}
        isEdit={appearanceModal.mode === 'edit'}
        isFirst={character.appearances.length === 0}
      />

      {/* 删除确认对话框 */}
      <DeleteConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, itemName: '', itemType: 'appearance', itemId: '' })}
        onConfirm={deleteConfirm.itemType === 'character' ? handleConfirmDeleteCharacter : handleConfirmDeleteAppearance}
        itemName={deleteConfirm.itemName}
        itemType={deleteConfirm.itemType}
      />
    </div>
  );
}
