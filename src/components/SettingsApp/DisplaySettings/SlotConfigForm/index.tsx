/**
 * Display Slot Configuration Form
 *
 * 展示槽位配置表单
 * 包含三个级联下拉选择器：助手 → 角色 → 形象
 * 直接从后端 API 获取数据
 *
 * Meta-Name: Display Slot Configuration Form
 * Meta-Description: Three cascading dropdowns for assistant/character/appearance selection
 */

import { useState, useMemo, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import type { Assistant, Character } from '@/types/character';
import './styles.css';

export interface SlotConfig {
  assistantId: string;
  characterId: string;
  appearanceId: string;
}

export interface SlotConfigFormProps {
  /** 初始配置（编辑模式） */
  initialConfig?: SlotConfig;
  /** 提交回调 */
  onSubmit: (config: SlotConfig) => Promise<void>;
  /** 取消回调 */
  onCancel: () => void;
  /** 加载状态 */
  loading?: boolean;
  /** 是否显示操作按钮（默认 true，设为 false 时由父组件控制按钮） */
  showActions?: boolean;
}

/**
 * 槽位配置表单组件
 */
export const SlotConfigForm = forwardRef<HTMLFormElement, SlotConfigFormProps>(({
  initialConfig,
  onSubmit,
  onCancel,
  loading = false,
  showActions = true,
}, ref) => {
  const { t } = useTranslation(['settings', 'common']);
  const formRef = useRef<HTMLFormElement>(null);

  // 暴露 form ref 给父组件
  useImperativeHandle(ref, () => formRef.current!);

  // 从后端获取的助手列表
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loadingAssistants, setLoadingAssistants] = useState(false);

  // 选中的ID
  const [selectedAssistantId, setSelectedAssistantId] = useState<string>(
    initialConfig?.assistantId || ''
  );
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>(
    initialConfig?.characterId || ''
  );
  const [selectedAppearanceId, setSelectedAppearanceId] = useState<string>(
    initialConfig?.appearanceId || ''
  );

  // 完整的角色数据（从后端加载）
  const [fullCharacterData, setFullCharacterData] = useState<Character | null>(null);
  const [loadingCharacter, setLoadingCharacter] = useState(false);

  // 加载助手列表
  useEffect(() => {
    const loadAssistants = async () => {
      setLoadingAssistants(true);
      try {
        const result = await invoke<Assistant[]>('get_all_assistants');
        setAssistants(result);
      } catch (error) {
        console.error('[SlotConfigForm] Failed to load assistants:', error);
      } finally {
        setLoadingAssistants(false);
      }
    };
    loadAssistants();
  }, []);

  // 当选择角色时，加载完整数据
  useEffect(() => {
    const loadFullCharacter = async () => {
      if (!selectedCharacterId) {
        setFullCharacterData(null);
        return;
      }

      setLoadingCharacter(true);
      try {
        const character = await invoke<Character>('get_character', {
          characterId: selectedCharacterId,
        });
        setFullCharacterData(character);
      } catch (error) {
        console.error('[SlotConfigForm] Failed to load character:', error);
        setFullCharacterData(null);
      } finally {
        setLoadingCharacter(false);
      }
    };
    loadFullCharacter();
  }, [selectedCharacterId]);

  // 根据助手过滤角色引用列表
  const availableCharacterRefs = useMemo(() => {
    if (!selectedAssistantId) return [];
    const assistant = assistants.find((a) => a.id === selectedAssistantId);
    return assistant?.characters || [];
  }, [assistants, selectedAssistantId]);

  // 从完整角色数据获取形象列表
  const availableAppearances = useMemo(() => {
    if (!fullCharacterData) return [];
    return fullCharacterData.appearances || [];
  }, [fullCharacterData]);

  // 当前选中的助手、角色、形象对象
  const selectedAssistant = useMemo(() => {
    return assistants.find((a) => a.id === selectedAssistantId);
  }, [assistants, selectedAssistantId]);

  const selectedAppearance = useMemo(() => {
    return availableAppearances.find((a) => a.id === selectedAppearanceId);
  }, [availableAppearances, selectedAppearanceId]);

  // 助手变化时：清空后续选择
  const handleAssistantChange = (value: string) => {
    setSelectedAssistantId(value);
    setSelectedCharacterId('');
    setSelectedAppearanceId('');
    setFullCharacterData(null);
  };

  // 角色变化时：清空形象选择
  const handleCharacterChange = (value: string) => {
    setSelectedCharacterId(value);
    setSelectedAppearanceId('');
    // fullCharacterData 会在 useEffect 中加载
  };

  // 表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAssistantId || !selectedCharacterId || !selectedAppearanceId) {
      return;
    }

    await onSubmit({
      assistantId: selectedAssistantId,
      characterId: selectedCharacterId,
      appearanceId: selectedAppearanceId,
    });
  };

  // 表单是否有效
  const isFormValid =
    selectedAssistantId && selectedCharacterId && selectedAppearanceId;

  if (loadingAssistants) {
    return (
      <div className="slot-config-form-mac" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--dj-space-8)' }}>
        <span className="spinner" style={{ marginRight: 8 }}></span>
        {t('common:loading')}
      </div>
    );
  }

  return (
    <form ref={formRef} className="slot-config-form-mac" onSubmit={handleSubmit}>
      {/* 助手下拉框 */}
      <div className="form-group-mac">
        <label htmlFor="assistant-select" className="form-label-mac">
          {t('character.assistant')}
          <span className="form-required">*</span>
        </label>
        <select
          id="assistant-select"
          value={selectedAssistantId}
          onChange={(e) => handleAssistantChange(e.target.value)}
          disabled={loading}
          className="form-select-mac"
        >
          <option value="">{t('character.pleaseSelectAssistant')}</option>
          {assistants.map((assistant) => (
            <option key={assistant.id} value={assistant.id}>
              {assistant.name}
            </option>
          ))}
        </select>
      </div>

      {/* 角色下拉框（级联） */}
      <div className="form-group-mac">
        <label htmlFor="character-select" className="form-label-mac">
          {t('character.character')}
          <span className="form-required">*</span>
        </label>
        <select
          id="character-select"
          value={selectedCharacterId}
          onChange={(e) => handleCharacterChange(e.target.value)}
          disabled={!selectedAssistantId || loading || loadingCharacter}
          className="form-select-mac"
        >
          <option value="">{t('character.pleaseSelectCharacter')}</option>
          {availableCharacterRefs.map((characterRef) => (
            <option key={characterRef.characterId} value={characterRef.characterId}>
              {characterRef.characterId}
            </option>
          ))}
        </select>
        {loadingCharacter && <small className="form-hint-mac">加载中...</small>}
      </div>

      {/* 形象下拉框（级联） */}
      <div className="form-group-mac">
        <label htmlFor="appearance-select" className="form-label-mac">
          {t('character.appearance')}
          <span className="form-required">*</span>
        </label>
        <select
          id="appearance-select"
          value={selectedAppearanceId}
          onChange={(e) => setSelectedAppearanceId(e.target.value)}
          disabled={!selectedCharacterId || loading}
          className="form-select-mac"
        >
          <option value="">{t('character.pleaseSelectAppearance')}</option>
          {availableAppearances.map((appearance) => (
            <option key={appearance.id} value={appearance.id}>
              {appearance.name}
            </option>
          ))}
        </select>
      </div>

      {/* 预览区域 */}
      {selectedAppearance && fullCharacterData && selectedAssistant && (
        <div className="form-preview-mac">
          <div className="preview-label-mac">{t('character.preview')}</div>
          <div className="preview-box-mac">
            {/* 封面图 */}
            <div className="preview-image-mac">
              <SlotPreviewImage
                assistantId={selectedAssistant.id}
                characterId={fullCharacterData.id}
                appearanceId={selectedAppearance.id}
              />
            </div>
            {/* 信息 */}
            <div className="preview-info-mac">
              <div className="preview-title-mac">
                {selectedAssistant.name} - {fullCharacterData.name || selectedCharacterId}
              </div>
              <div className="preview-appearance-mac">
                {selectedAppearance.name}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 按钮组 */}
      {showActions && (
        <div className="form-actions-mac">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="btn-mac btn-mac-secondary"
          >
            {t('common:cancel')}
          </button>
          <button
            type="submit"
            disabled={!isFormValid || loading}
            className="btn-mac btn-mac-primary"
          >
            {loading ? (
              <>
                <span className="spinner" style={{ marginRight: 6 }}></span>
                {t('common:saving')}
              </>
            ) : (
              t('common:confirm')
            )}
          </button>
        </div>
      )}
    </form>
  );
});

SlotConfigForm.displayName = 'SlotConfigForm';

/**
 * 槽位预览图片组件
 */
interface SlotPreviewImageProps {
  assistantId: string;
  characterId: string;
  appearanceId: string;
}

function SlotPreviewImage({
  assistantId,
  characterId,
  appearanceId,
}: SlotPreviewImageProps) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const loadCoverImage = async () => {
      try {
        // 新的目录结构: {character_id}/{appearance_id}/{action_key}/{resource}
        const resourceName = `${appearanceId}/internal-base-idle/0001.png`;
        const dataUrl = await invoke<string>('load_character_resource', {
          assistantId,
          characterId,
          resourceName,
        });
        setImgUrl(dataUrl);
      } catch (error) {
        console.error('[SlotPreviewImage] Failed to load image:', error);
        setImgError(true);
      }
    };

    loadCoverImage();
  }, [assistantId, characterId, appearanceId]);

  if (imgError || !imgUrl) {
    return <div className="preview-placeholder-mac">🎭</div>;
  }

  return <img src={imgUrl} alt="Preview" onError={() => setImgError(true)} />;
}
