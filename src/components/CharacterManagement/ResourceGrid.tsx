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

interface ResourceGridProps {
  /** 资源列表 */
  resources: string[];
  /** 资源路径前缀 */
  pathPrefix: string;
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
  };
  /** 完整动作键（用于预览） */
  actionKeyFull?: string;
  /** 资源更新回调 */
  onUpdate: (resources: string[]) => void;
}

/**
 * Parse pathPrefix to get assistant_id, character_id, action_key
 * pathPrefix format: characters/{assistant_id}/{character_id}/{action_key}
 */
function parsePathPrefix(pathPrefix: string): { assistantId: string; characterId: string; actionKey: string } {
  const parts = pathPrefix.split('/');
  console.log('[parsePathPrefix] Input pathPrefix:', pathPrefix);
  console.log('[parsePathPrefix] Split parts:', parts);

  const result = {
    assistantId: parts[1],
    characterId: parts[2],
    actionKey: parts[3],
  };

  console.log('[parsePathPrefix] Parsed result:', result);
  return result;
}

/**
 * 资源卡片组件（带懒加载）
 */
function ResourceCard({
  resource,
  pathPrefix,
  isSelected,
  isPreview,
  isDeleting,
  onSelect,
  onDelete,
  onPreview,
  t,
}: {
  resource: string;
  pathPrefix: string;
  isSelected: boolean;
  isPreview?: boolean;
  isDeleting: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onPreview: () => void;
  t: (key: string) => string;
}) {
  console.log('[ResourceCard] Component rendered for resource:', resource);

  const [imageSrc, setImageSrc] = useState<string>('');
  const [imgError, setImgError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(resource);

  console.log('[ResourceCard] isImage:', isImage, 'resource:', resource);

  // 加载图片
  const loadImage = useCallback(async () => {
    if (!isImage || hasLoaded) return;

    console.log('[ResourceCard] Starting load:', resource);
    setIsLoading(true);
    const { assistantId, characterId, actionKey } = parsePathPrefix(pathPrefix);
    const resourceName = `${actionKey}/${resource}`;

    console.log('[ResourceCard] Parsed path:', { assistantId, characterId, actionKey, resourceName });

    try {
      console.log('[ResourceCard] Invoking load_character_resources (batch, single item)...');
      console.log('[ResourceCard] Request params:', { assistantId, characterId, resourceNames: [resourceName] });
      const resourceMap = await invoke<Record<string, string>>('load_character_resources', {
        assistantId,
        characterId,
        resourceNames: [resourceName],
      });
      console.log('[ResourceCard] Response map keys:', Object.keys(resourceMap));
      console.log('[ResourceCard] Response map:', resourceMap);
      const dataUrl = resourceMap[resourceName];
      console.log('[ResourceCard] Looking for key:', resourceName, 'Found:', !!dataUrl);
      if (!dataUrl) {
        throw new Error(`Resource ${resourceName} not found in response. Available keys: ${Object.keys(resourceMap).join(', ')}`);
      }
      console.log('[ResourceCard] Load success, data URL length:', dataUrl.length, 'prefix:', dataUrl.substring(0, 50));
      setImageSrc(dataUrl);
      setHasLoaded(true);
    } catch (err) {
      console.error('[ResourceCard] Failed to load resource:', resourceName, err);
      setImgError(true);
    } finally {
      setIsLoading(false);
    }
  }, [resource, pathPrefix, isImage, hasLoaded]);

  // Intersection Observer 懒加载 - 观察卡片容器（始终可见）
  useEffect(() => {
    if (!isImage || hasLoaded) return;

    const element = cardRef.current;
    if (!element) {
      console.log('[ResourceCard] cardRef is null, skipping observer setup');
      return;
    }

    console.log('[ResourceCard] Setting up IntersectionObserver for:', resource);

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            console.log('[ResourceCard] Card is visible, loading:', resource);
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
              onError={(e) => {
                console.error('[ResourceCard] Image onError fired for:', resource, 'src length:', imageSrc.length);
                setImgError(true);
              }}
              onLoad={() => {
                console.log('[ResourceCard] Image onLoad fired for:', resource);
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
              console.log('[ResourceCard] Delete button clicked for:', resource);
              onDelete();
            } else {
              console.log('[ResourceCard] Delete already in progress, ignoring click');
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
  characterId,
  appearanceId,
  actionKey,
  action,
  actionKeyFull,
  onUpdate,
}: ResourceGridProps) {
  console.log('[ResourceGrid] ===== COMPONENT RENDER =====');
  console.log('[ResourceGrid] props:', {
    resourcesCount: resources.length,
    resources,
    pathPrefix,
    characterId,
    appearanceId,
    actionKey,
    actionKeyFull,
  });

  const { t } = useTranslation('settings');
  const [uploading, setUploading] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  const isAllSelected = selectedIndices.size === resources.length && resources.length > 0;
  const isDeleting = deletingIndex !== null;

  // 组件挂载时的日志
  useEffect(() => {
    console.log('[ResourceGrid] Component mounted with props:', {
      resourcesCount: resources.length,
      resources,
      pathPrefix,
      characterId,
      appearanceId,
      actionKey,
    });
  }, [resources.length, pathPrefix, characterId, appearanceId, actionKey]);

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

  const handleBatchDelete = async () => {
    if (selectedIndices.size === 0) return;

    // Prevent batch deletion if a single deletion is in progress
    if (isDeleting) {
      console.log('[ResourceGrid] Single deletion in progress, batch delete blocked');
      alert('有删除操作正在进行中，请稍后再试');
      return;
    }

    const count = selectedIndices.size;
    console.log('[ResourceGrid] Batch delete requested for', count, 'resources');

    const confirmed = confirm(`确定要删除选中的 ${count} 个资源吗？`);
    console.log('[ResourceGrid] Batch delete confirmed:', confirmed);

    if (!confirmed) {
      console.log('[ResourceGrid] Batch delete cancelled by user');
      return;
    }

    // Set batch deletion state
    setDeletingIndex(-1); // Use -1 to indicate batch deletion
    console.log('[ResourceGrid] Starting batch deletion');

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      // 从后往前删除，避免索引变化
      const indices = Array.from(selectedIndices).sort((a, b) => b - a);

      for (const index of indices) {
        const resourceToDelete = resources[index];
        console.log('[ResourceGrid] Deleting resource:', resourceToDelete);
        await invoke('remove_action_resource', {
          characterId,
          appearanceId,
          actionKey,
          resourceName: resourceToDelete,
        });
      }

      console.log('[ResourceGrid] Batch deletion successful');
      const newResources = resources.filter((_, i) => !selectedIndices.has(i));
      onUpdate(newResources);
      setSelectedIndices(new Set());
    } catch (error) {
      console.error('[ResourceGrid] Failed to batch delete resources:', error);
      alert('批量删除失败');
    } finally {
      // Always clear deleting state
      console.log('[ResourceGrid] Clearing batch deletion state');
      setDeletingIndex(null);
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
        const newResources = await invoke<string[]>('add_action_resources', {
          characterId,
          actionKey,
          filePaths: selected,
        });

        const updatedResources = [...resources, ...newResources];
        onUpdate(updatedResources);
      }
    } catch (error) {
      console.error('Failed to select files:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteResource = async (index: number) => {
    // Prevent deletion if another deletion is in progress
    if (isDeleting) {
      console.log('[ResourceGrid] Deletion already in progress, ignoring request');
      return;
    }

    const resourceToDelete = resources[index];

    console.log('[ResourceGrid] Delete requested for:', resourceToDelete);

    // 使用更可靠的确认方式
    const confirmed = confirm(`确定要删除资源 "${resourceToDelete}" 吗？`);
    console.log('[ResourceGrid] User confirmed:', confirmed);

    if (!confirmed) {
      console.log('[ResourceGrid] Delete cancelled by user');
      return;
    }

    // Set deleting state before starting async operation
    setDeletingIndex(index);
    console.log('[ResourceGrid] Set deleting state for index:', index);

    try {
      console.log('[ResourceGrid] Proceeding with deletion...');
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('remove_action_resource', {
        characterId,
        appearanceId,
        actionKey,
        resourceName: resourceToDelete,
      });

      console.log('[ResourceGrid] Backend deletion successful');
      const newResources = resources.filter((_, i) => i !== index);
      onUpdate(newResources);
    } catch (error) {
      console.error('[ResourceGrid] Failed to delete resource:', error);
      alert('删除失败');
    } finally {
      // Always clear deleting state, even on error
      console.log('[ResourceGrid] Clearing deleting state');
      setDeletingIndex(null);
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
                <button className="btn-danger" onClick={handleBatchDelete}>
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
                isSelected={false}
                isPreview={true}
                isDeleting={false}
                onSelect={() => {}}
                onDelete={() => {}}
                onPreview={() => setShowPreviewModal(true)}
                t={t}
              />
            )}

            {/* 资源卡片 */}
            {resources.map((resource, index) => (
              <ResourceCard
                key={index}
                resource={resource}
                pathPrefix={pathPrefix}
                isSelected={selectedIndices.has(index)}
                isDeleting={deletingIndex === index || deletingIndex === -1}
                onSelect={() => handleToggleSelect(index)}
                onDelete={() => handleDeleteResource(index)}
                onPreview={() => {}}
                t={t}
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
          onClose={() => setShowPreviewModal(false)}
        />
      )}
    </>
  );
}
