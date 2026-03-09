/**
 * Character Detail View Component
 *
 * 角色详情组件（第二层导航）
 * 显示角色基本信息（可编辑）和形象卡片列表
 * Mac 极简风格
 */

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import type { Character } from '@/types/character';

interface CharacterDetailViewProps {
  /** 角色数据 */
  character: Character;
  /** 返回回调 */
  onBack: () => void;
  /** 选择形象回调 */
  onSelectAppearance: (appearanceId: string) => void;
  /** 保存角色信息回调 */
  onSaveCharacter: (updates: { name: string; description?: string }) => void;
}

/**
 * 形象卡片组件
 */
function AppearanceCard({
  appearance,
  isDefault,
  onClick,
  t,
  character,
}: {
  appearance: Character['appearances'][0];
  isDefault: boolean;
  onClick: () => void;
  t: (key: string) => string;
  character: Character;
}) {
  const [imgError, setImgError] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const actionCount = Object.keys(appearance.actions).length;

  // 加载封面图：使用 idle 动作的首个资源
  useEffect(() => {
    const loadCoverImage = async () => {
      const actionKeys = Object.keys(appearance.actions);
      if (actionKeys.length === 0) return;

      // 优先查找 idle 动作（通常是 internal-base-idle）
      const idleActionKey = actionKeys.find(key => key.toLowerCase().includes('idle'));
      const actionKey = idleActionKey || actionKeys[0];

      const firstAction = appearance.actions[actionKey];
      const firstResource = firstAction?.resources?.[0];

      if (!firstResource) return;

      try {
        // 构建资源名称：actionKey/resourceName
        const fullResourceName = `${actionKey}/${firstResource}`;
        // 调用后端获取 base64 data URL (避免 asset.localhost 协议问题)
        const dataUrl = await invoke<string>('load_character_resource', {
          assistantId: character.assistantId,
          characterId: character.id,
          resourceName: fullResourceName,
        });
        setCoverUrl(dataUrl);
      } catch (error) {
        console.error('[AppearanceCard] Failed to load cover image:', error);
        setImgError(true);
      }
    };

    loadCoverImage();
  }, [appearance, character]);

  return (
    <div className="character-card appearance-card" onClick={onClick}>
      <div className="card-cover">
        {coverUrl && !imgError ? (
          <img
            src={coverUrl}
            alt={appearance.name}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="card-placeholder">🖼</div>
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
      </div>
    </div>
  );
}

/**
 * 角色基本信息编辑组件
 */
function CharacterBasicInfo({
  character,
  onSave,
  t,
}: {
  character: Character;
  onSave: (updates: { name: string; description?: string }) => void;
  t: (key: string) => string;
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
    <div className="character-basic-info">
      <div className="info-row">
        <label>{t('character.characterName')}</label>
        {isEditing ? (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="info-input"
            autoFocus
          />
        ) : (
          <span className="info-value">{character.name}</span>
        )}
      </div>
      <div className="info-row">
        <label>{t('character.characterId')}</label>
        <span className="info-value readonly">{character.id}</span>
      </div>
      <div className="info-row">
        <label>{t('character.description')}</label>
        {isEditing ? (
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="info-input"
          />
        ) : (
          <span className="info-value">{character.description || t('character.noDescription')}</span>
        )}
      </div>
      <div className="info-actions">
        {isEditing ? (
          <>
            <button className="btn-save" onClick={handleSave}>{t('character.save')}</button>
            <button className="btn-cancel" onClick={handleCancel}>{t('character.cancel')}</button>
          </>
        ) : (
          <button className="btn-edit" onClick={() => setIsEditing(true)}>{t('character.edit')}</button>
        )}
      </div>
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
}: CharacterDetailViewProps) {
  const { t } = useTranslation('settings');

  return (
    <div className="character-detail-view">
      <div className="cd-header">
        <button className="btn-back" onClick={onBack}>
          ← {t('character.back')}
        </button>
      </div>

      <div className="cd-content">
        {/* 角色基本信息 */}
        <CharacterBasicInfo
          character={character}
          onSave={onSaveCharacter}
          t={t}
        />

        {/* 形象卡片列表 */}
        <div className="cd-appearances">
          <h3>{t('character.appearanceList')}</h3>
          <div className="card-grid">
            {character.appearances.map((appearance) => (
              <AppearanceCard
                key={appearance.id}
                appearance={appearance}
                isDefault={appearance.id === character.defaultAppearanceId}
                onClick={() => onSelectAppearance(appearance.id)}
                t={t}
                character={character}
              />
            ))}
            {/* MVP阶段：屏蔽新增形象入口 */}
          </div>
        </div>
      </div>
    </div>
  );
}
