/**
 * Appearance Detail View Component
 *
 * 形象详情组件（第三层导航）
 * 紧凑布局：顶部工具栏 + 左右分栏
 * Mac 极简风格
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ActionTreeEditor from './ActionTreeEditor';
import ResourceGrid from './ResourceGrid';
import type {
  Character,
  Appearance,
  AddActionFormData,
  EditActionFormData,
} from '@/types/character';

interface AppearanceDetailViewProps {
  /** 角色数据 */
  character: Character;
  /** 形象数据 */
  appearance: Appearance;
  /** 返回回调 */
  onBack: () => void;
  /** 保存形象信息回调 */
  onSaveAppearance: (updates: { name: string; description?: string }) => void;
  /** 新增动作回调 */
  onAddAction: (data: AddActionFormData) => void;
  /** 编辑动作回调 */
  onEditAction: (data: EditActionFormData) => void;
  /** 删除动作回调 */
  onDeleteAction: (key: string) => void;
  /** 更新资源回调 */
  onUpdateResources: (actionKey: string, resources: string[]) => void;
}

/**
 * 形象详情主组件 - 紧凑布局
 */
export default function AppearanceDetailView({
  character,
  appearance,
  onBack,
  onSaveAppearance,
  onAddAction,
  onEditAction,
  onDeleteAction,
  onUpdateResources,
}: AppearanceDetailViewProps) {
  const { t } = useTranslation('settings');
  const [selectedActionKey, setSelectedActionKey] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(appearance.name);
  const [editDesc, setEditDesc] = useState(appearance.description || '');

  const selectedAction = selectedActionKey
    ? appearance.actions[selectedActionKey] ?? null
    : null;

  // 默认选中 idle 动作
  useEffect(() => {
    console.log('[AppearanceDetailView] Component mounted');
    console.log('[AppearanceDetailView] - character.id:', character.id);
    console.log('[AppearanceDetailView] - character.assistantId:', character.assistantId);
    console.log('[AppearanceDetailView] - appearance.actions keys:', Object.keys(appearance.actions));
    console.log('[AppearanceDetailView] - selectedActionKey:', selectedActionKey);

    if (!selectedActionKey && Object.keys(appearance.actions).length > 0) {
      // 优先查找 idle 动作
      const idleKey = Object.keys(appearance.actions).find(key =>
        key.toLowerCase().includes('idle')
      );
      const keyToSelect = idleKey || Object.keys(appearance.actions)[0];
      console.log('[AppearanceDetailView] - Auto-selecting action:', keyToSelect);
      setSelectedActionKey(keyToSelect);
    }
  }, [appearance.actions, selectedActionKey, character.id, character.assistantId]);

  // 构建资源路径前缀
  const pathPrefix = `characters/${character.assistantId}/${character.id}`;

  // Debug: Log when selectedAction changes
  useEffect(() => {
    console.log('[AppearanceDetailView] selectedAction changed:', {
      selectedActionKey,
      hasSelectedAction: !!selectedAction,
      resourcesCount: selectedAction?.resources?.length || 0,
      resources: selectedAction?.resources,
      pathPrefix,
    });
  }, [selectedAction, selectedActionKey, pathPrefix]);

  const handleSelectAction = (key: string) => {
    console.log('[AppearanceDetailView] handleSelectAction:', key);
    setSelectedActionKey(key);
  };

  const handleUpdateResources = (resources: string[]) => {
    if (selectedActionKey) {
      onUpdateResources(selectedActionKey, resources);
    }
  };

  const handleStartEdit = () => {
    setEditName(appearance.name);
    setEditDesc(appearance.description || '');
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    onSaveAppearance({ name: editName, description: editDesc || undefined });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName(appearance.name);
    setEditDesc(appearance.description || '');
    setIsEditing(false);
  };

  return (
    <div className="appearance-detail-view-compact">
      {/* 顶部工具栏 */}
      <div className="adv-toolbar">
        <div className="toolbar-left">
          <button className="btn-icon" onClick={onBack} title={t('character.back')}>
            ←
          </button>
          <div className="toolbar-title">
            {isEditing ? (
              <div className="title-edit-row">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="title-input"
                  placeholder={t('character.name')}
                />
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="desc-input-inline"
                  placeholder={t('character.description')}
                />
              </div>
            ) : (
              <div className="title-display-row">
                <span className="title-name">{appearance.name}</span>
                {appearance.description && (
                  <span className="title-desc">{appearance.description}</span>
                )}
                <span className="toolbar-id">{appearance.id}</span>
              </div>
            )}
          </div>
        </div>
        <div className="toolbar-right">
          {isEditing ? (
            <>
              <button className="btn-text" onClick={handleSaveEdit}>{t('character.save')}</button>
              <button className="btn-text" onClick={handleCancelEdit}>{t('character.cancel')}</button>
            </>
          ) : (
            <button className="btn-text" onClick={handleStartEdit}>{t('character.edit')}</button>
          )}
        </div>
      </div>

      {/* 主体内容 - 左右分栏 */}
      <div className="adv-body">
        {/* 左侧：动作树（更窄） */}
        <div className="adv-sidebar-compact">
          <ActionTreeEditor
            actions={appearance.actions}
            selectedKey={selectedActionKey}
            onSelectAction={handleSelectAction}
            onAddAction={onAddAction}
            onEditAction={onEditAction}
            onDeleteAction={onDeleteAction}
          />
        </div>

        {/* 右侧：动作详情 + 资源网格 */}
        <div className="adv-detail-compact">
          {selectedAction && selectedActionKey ? (
            <div className="action-detail-compact">
              {/* 动作标题行 */}
              <div className="action-header">
                <h4>{selectedActionKey}</h4>
                <div className="action-badges">
                  <span className={`badge-loop ${selectedAction.loop ? 'on' : 'off'}`}>
                    {selectedAction.loop ? '🔁' : '▸'}
                  </span>
                  <span className="badge-count">{selectedAction.resources.length} frames</span>
                </div>
              </div>

              {/* 资源网格 - 占满剩余空间 */}
              <div className="action-resources-compact">
                <ResourceGrid
                  key={selectedActionKey}
                  resources={selectedAction.resources}
                  pathPrefix={`${pathPrefix}/${selectedActionKey}`}
                  characterId={character.id}
                  appearanceId={appearance.id}
                  actionKey={selectedActionKey}
                  action={selectedAction}
                  actionKeyFull={selectedActionKey}
                  onUpdate={handleUpdateResources}
                />
              </div>

              {/* 描述 */}
              {selectedAction.description && (
                <div className="action-desc-compact">{selectedAction.description}</div>
              )}
            </div>
          ) : (
            <div className="adv-empty-compact">
              <div className="empty-icon">🎯</div>
              <div className="empty-text">{t('character.selectAction')}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
