/**
 * Resource Grid Component
 *
 * 资源网格组件
 * 显示和管理动作资源文件
 * 支持预览、多选、批量删除
 * 图片懒加载优化
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import AnimationPreviewModal from './AnimationPreviewModal';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import ActionEditModal from './ActionEditModal';
import type { SpriteSheetConfig } from '@/types/character';

interface ResourceGridProps {
  /** 资源列表 */
  resources: string[];
  /** 资源路径前缀 */
  pathPrefix: string;
  /** 助手ID */
  assistantId: string;
  /** 角色ID */
  characterId: string;
  /** 形象ID */
  appearanceId: string;
  /** 动作键 */
  actionKey: string;
  /** 动作数据 */
  action?: {
    type: string;
    fps?: number;
    loop?: boolean;
    resources: string[];
    spritesheet?: SpriteSheetConfig;
  };
  /** 完整动作键（用于预览） */
  actionKeyFull?: string;
  /** 资源更新回调 */
  onUpdate: (resources: string[]) => void;
}

/**
 * Parse pathPrefix to get assistant_id and character_id
 * pathPrefix format: characters/{assistant_id}/{character_id}
 * Note: This is kept for backward compatibility, but characterId is also available as a prop
 */
function parsePathPrefix(pathPrefix: string): { assistantId: string; characterId: string } {
  const parts = pathPrefix.split('/');

  // 新结构：characters/{assistantId}/{characterId}
  const result = {
    assistantId: parts[1] || '',
    characterId: parts[2] || '',
  };

  return result;
}

/**
 * 资源卡片组件（带懒加载）
 */
function ResourceCard({
  resource,
  pathPrefix,
  assistantId,
  characterId,
  isSelected,
  isPreview,
  isDeleting,
  onSelect,
  onDelete,
  onPreview,
  t,
  appearanceId,
  actionKey,
}: {
  resource: string;
  pathPrefix: string;
  assistantId: string;
  characterId: string;
  isSelected: boolean;
  isPreview?: boolean;
  isDeleting: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onPreview: () => void;
  t: (key: string) => string;
  appearanceId: string;
  actionKey: string;
}) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [imgError, setImgError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(resource);

  // 加载图片
  const loadImage = useCallback(async () => {
    if (!isImage || hasLoaded) return;

    setIsLoading(true);
    const parsedPath = parsePathPrefix(pathPrefix);
    // 新的目录结构: characters/{assistant_id}/{character_id}/{appearance_id}/{action_key}/{resource}
    const resourceName = `${appearanceId}/${actionKey}/${resource}`;

    // 优先使用 props 传入的值，如果为空则使用解析值
    const finalAssistantId = assistantId || parsedPath.assistantId;
    const finalCharacterId = characterId || parsedPath.characterId;

    try {
      const resourceMap = await invoke<Record<string, string>>('load_character_resources', {
        assistantId: finalAssistantId,
        characterId: finalCharacterId,
        resourceNames: [resourceName],
      });
      const dataUrl = resourceMap[resourceName];
      if (!dataUrl) {
        throw new Error(`Resource ${resourceName} not found. Available: ${Object.keys(resourceMap).join(', ')}`);
      }
      setImageSrc(dataUrl);
      setHasLoaded(true);
    } catch (err) {
      console.error('[ResourceCard] Failed to load resource:', err);
      setImgError(true);
    } finally {
      setIsLoading(false);
    }
  }, [resource, pathPrefix, assistantId, characterId, appearanceId, actionKey, isImage, hasLoaded]);

  // Intersection Observer 懒加载 - 观察卡片容器（始终可见）
  useEffect(() => {
    if (!isImage || hasLoaded) return;

    const element = cardRef.current;
    if (!element) {
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadImage();
            if (observerRef.current) {
              observerRef.current.disconnect();
            }
          }
        });
      },
      { rootMargin: '50px' }
    );

    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [isImage, hasLoaded, loadImage, resource]);

  const handleClick = (_e: React.MouseEvent) => {
    if (isPreview) {
      onPreview();
    } else {
      onSelect();
    }
  };

  return (
    <div
      ref={cardRef}
      className={`resource-card ${isSelected ? 'selected' : ''} ${isPreview ? 'preview-card' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={isPreview ? undefined : handleClick}
    >
      {isPreview ? (
        // 预览卡片：显示预览按钮
        <div className="resource-card-preview">
          <div className="preview-icon">🎬</div>
          <button
            className="btn-preview"
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
          >
            点击预览
          </button>
        </div>
      ) : isImage ? (
        <>
          {isLoading && !imgError && (
            <div className="resource-card-loading">加载中...</div>
          )}
          {imageSrc && !imgError ? (
            <img
              src={imageSrc}
              alt={resource}
              onError={() => {
                console.error('[ResourceCard] Image onError fired for:', resource, 'src length:', imageSrc.length);
                setImgError(true);
              }}
              onLoad={() => {
                setHasLoaded(true);
              }}
              style={{ display: 'block' }}
            />
          ) : null}
          {imgError && (
            <div className="resource-card-placeholder">❌</div>
          )}
        </>
      ) : (
        <div className="resource-card-placeholder">📄</div>
      )}

      {/* 复选框 - hover时显示或选中时显示 */}
      {!isPreview && (hovered || isSelected) && (
        <div className="resource-checkbox" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          {isSelected ? '☑' : '☐'}
        </div>
      )}

      {/* 删除按钮 - 仅非预览卡片 */}
      {!isPreview && hovered && (
        <button
          className="resource-remove"
          onClick={(e) => {
            e.stopPropagation();
            if (!isDeleting) {
              onDelete();
            }
          }}
          title={t('character.deleteResource')}
          disabled={isDeleting}
          style={{ opacity: isDeleting ? 0.5 : 1, cursor: isDeleting ? 'not-allowed' : 'pointer' }}
        >
          {isDeleting ? '…' : '×'}
        </button>
      )}

      <div className="resource-card-name">{isPreview ? (pathPrefix.split('/').pop() || '预览') : resource}</div>
    </div>
  );
}

/**
 * 资源网格主组件
 */
export default function ResourceGrid({
  resources,
  pathPrefix,
  assistantId,
  characterId,
  appearanceId,
  actionKey,
  action,
  actionKeyFull,
  onUpdate,
}: ResourceGridProps) {
  const { t } = useTranslation('settings');
  const [uploading, setUploading] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showActionEditModal, setShowActionEditModal] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  // 删除确认弹窗状态
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    itemName: string;
    itemType: 'assistant' | 'character' | 'appearance';
    isBatch: boolean;
    index?: number;
  }>({
    isOpen: false,
    itemName: '',
    itemType: 'appearance',
    isBatch: false,
  });

  const isAllSelected = selectedIndices.size === resources.length && resources.length > 0;
  const isDeleting = deletingIndex !== null;

  // 重置选中状态当资源变化时
  useEffect(() => {
    setSelectedIndices(new Set());
  }, [resources]);

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(resources.map((_, i) => i)));
    }
  };

  const handleInvertSelection = () => {
    const newSet = new Set<number>();
    resources.forEach((_, i) => {
      if (!selectedIndices.has(i)) {
        newSet.add(i);
      }
    });
    setSelectedIndices(newSet);
  };

  const handleToggleSelect = (index: number) => {
    const newSet = new Set(selectedIndices);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedIndices(newSet);
  };

  // 打开批量删除确认弹窗
  const handleBatchDeleteConfirm = () => {
    if (selectedIndices.size === 0) return;
    if (isDeleting) {
      alert('有删除操作正在进行中，请稍后再试');
      return;
    }

    setDeleteConfirm({
      isOpen: true,
      itemName: `${selectedIndices.size} 个资源`,
      itemType: 'appearance',
      isBatch: true,
    });
  };

  // 执行批量删除
  const handleBatchDelete = async () => {
    if (selectedIndices.size === 0) return;

    setDeletingIndex(-1);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const indices = Array.from(selectedIndices).sort((a, b) => b - a);

      for (const index of indices) {
        const resourceToDelete = resources[index];
        await invoke('data_remove_action_resource', {
          characterId,
          appearanceId,
          actionKey,
          resourceName: resourceToDelete,
        });
      }
      // remove_action_resource 已经保存了 config.json
      // 只需要触发数据刷新即可
      onUpdate(null as unknown as string[]);
      setSelectedIndices(new Set());
    } catch (error) {
      console.error('[ResourceGrid] Failed to batch delete resources:', error);
      alert('批量删除失败');
    } finally {
      setDeletingIndex(null);
      setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleSelectFiles = async () => {
    // Prevent adding files during deletion
    if (isDeleting) {
      alert('有删除操作正在进行中，请稍后再试');
      return;
    }

    setUploading(true);
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: t('character.imageFilter'),
            extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']
          },
        ]
      });

      if (selected && selected.length > 0) {
        const { invoke } = await import('@tauri-apps/api/core');

        // data_add_action_resources 会：
        // 1. 复制文件到目标目录
        // 2. 保存更新后的 config.json
        // 3. 返回新添加的资源文件名
        await invoke<string[]>('data_add_action_resources', {
          characterId,
          appearanceId,
          actionKey,
          filePaths: selected,
        });

        // 通知父组件刷新数据（传递特殊标记表示需要从后端重新加载）
        // 使用 null 作为特殊标记，表示"从后端刷新"而不是"设置这些资源"
        await onUpdate(null as unknown as string[]);
      }
    } catch (error) {
      console.error('[ResourceGrid] Failed to select files:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      alert(`添加资源失败: ${errorMsg}`);
    } finally {
      setUploading(false);
    }
  };

  // 打开单个删除确认弹窗
  const handleDeleteResource = (index: number) => {
    if (isDeleting) {
      return;
    }

    const resourceToDelete = resources[index];

    setDeleteConfirm({
      isOpen: true,
      itemName: resourceToDelete,
      itemType: 'appearance',
      isBatch: false,
      index,
    });
  };

  // 执行单个删除
  const handleConfirmDelete = async () => {
    if (deleteConfirm.index === undefined) return;

    const index = deleteConfirm.index;
    const resourceToDelete = resources[index];

    setDeletingIndex(index);

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('data_remove_action_resource', {
        characterId,
        appearanceId,
        actionKey,
        resourceName: resourceToDelete,
      });
      // data_remove_action_resource 已经保存了 config.json
      // 只需要触发数据刷新即可
      onUpdate(null as unknown as string[]);
    } catch (error) {
      console.error('[ResourceGrid] Failed to delete resource:', error);
      alert('删除失败');
    } finally {
      setDeletingIndex(null);
      setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
    }
  };

  return (
    <>
      <div className="resource-grid">
        {/* 标题栏 */}
        <div className="rg-header">
          <h4>{t('character.resourceList')}</h4>
          {resources.length > 0 && (
            <span className="rg-count">({resources.length})</span>
          )}
        </div>

        {/* 操作栏 */}
        {resources.length > 0 && (
          <div className="rg-actions">
            {selectedIndices.size > 0 && (
              <>
                <button className="btn-danger" onClick={handleBatchDeleteConfirm}>
                  批量删除 ({selectedIndices.size})
                </button>
                <button className="btn-text" onClick={handleSelectAll}>
                  {isAllSelected ? '取消全选' : '全选'}
                </button>
                <button className="btn-text" onClick={handleInvertSelection}>
                  反选
                </button>
              </>
            )}
            <button className="btn-text" onClick={() => setShowActionEditModal(true)}>
              ⚙ {t('character.editAction') || '编辑参数'}
            </button>
            <button className="btn-add" onClick={handleSelectFiles} disabled={uploading || isDeleting}>
              {uploading ? '添加中...' : isDeleting ? '删除中...' : '+ 添加资源'}
            </button>
          </div>
        )}

        {/* 空状态 */}
        {resources.length === 0 ? (
          <div className="rg-empty">
            <div className="empty-icon">📁</div>
            <div className="empty-text">{t('character.noResources')}</div>
            <button
              className="btn-add-first"
              onClick={handleSelectFiles}
              disabled={uploading || isDeleting}
            >
              {uploading ? '添加中...' : isDeleting ? '删除中...' : '+ 添加第一个资源'}
            </button>
          </div>
        ) : (
          /* 资源网格 - 包含预览卡片 */
          <div className="resource-grid-cards">
            {/* 预览卡片 - 第一列 */}
            {action && actionKeyFull && (
              <ResourceCard
                key="__preview__"
                resource=""
                pathPrefix={pathPrefix}
                assistantId={assistantId}
                characterId={characterId}
                isSelected={false}
                isPreview={true}
                isDeleting={false}
                onSelect={() => {}}
                onDelete={() => {}}
                onPreview={() => setShowPreviewModal(true)}
                t={t}
                appearanceId={appearanceId}
                actionKey={actionKeyFull}
              />
            )}

            {/* 资源卡片 */}
            {resources.map((resource, index) => (
              <ResourceCard
                key={index}
                resource={resource}
                pathPrefix={pathPrefix}
                assistantId={assistantId}
                characterId={characterId}
                isSelected={selectedIndices.has(index)}
                isDeleting={deletingIndex === index || deletingIndex === -1}
                onSelect={() => handleToggleSelect(index)}
                onDelete={() => handleDeleteResource(index)}
                onPreview={() => {}}
                t={t}
                appearanceId={appearanceId}
                actionKey={actionKey}
              />
            ))}
          </div>
        )}
      </div>

      {/* 预览弹窗 */}
      {showPreviewModal && action && (
        <AnimationPreviewModal
          action={action}
          actionKey={actionKeyFull || ''}
          pathPrefix={pathPrefix}
          assistantId={assistantId}
          appearanceId={appearanceId}
          onClose={() => setShowPreviewModal(false)}
        />
      )}

      {/* 删除确认弹窗 */}
      <DeleteConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
        onConfirm={deleteConfirm.isBatch ? handleBatchDelete : handleConfirmDelete}
        itemName={deleteConfirm.itemName}
        itemType="appearance"
      />

      {/* 动作编辑弹窗 */}
      {showActionEditModal && action && (
        <ActionEditModal
          isOpen={showActionEditModal}
          onClose={() => setShowActionEditModal(false)}
          onConfirm={() => {
            setShowActionEditModal(false);
          }}
          assistantId={assistantId}
          characterId={characterId}
          appearanceId={appearanceId}
          action={action}
          actionKey={actionKey}
        />
      )}
    </>
  );
}
