/**
 * Character Modal Component
 *
 * 角色编辑/新增弹窗组件
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface CharacterModalProps {
  /** 是否显示弹窗 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 确认回调 */
  onConfirm: (data: { id?: string; name: string; description?: string }) => void;
  /** 编辑模式：传入要编辑的角色数据 */
  character?: { id: string; name: string; description?: string } | null;
  /** 是否为编辑模式 */
  isEdit?: boolean;
}

/**
 * 生成随机ID（16位，去除易混淆字符）
 */
function generateRandomId(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 验证自定义ID格式
 */
function validateCustomId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{3,50}$/.test(id);
}

/**
 * 角色编辑/新增弹窗主组件
 */
export default function CharacterModal({
  isOpen,
  onClose,
  onConfirm,
  character,
  isEdit = true,
}: CharacterModalProps) {
  const { t } = useTranslation('settings');
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [idError, setIdError] = useState('');

  // 初始化表单数据
  useEffect(() => {
    if (isOpen) {
      if (isEdit && character) {
        setId(character.id);
        setName(character.name);
        setDescription(character.description || '');
      } else {
        // 新增模式：生成随机ID
        const newId = generateRandomId();
        setId(newId);
        setName('');
        setDescription('');
        setIdError('');
      }
    }
  }, [isOpen, isEdit, character]);

  // 验证ID
  useEffect(() => {
    if (!isEdit && id) {
      if (!validateCustomId(id)) {
        setIdError(t('character.characterIdPlaceholder'));
      } else {
        setIdError('');
      }
    }
  }, [id, isEdit, t]);

  const handleGenerateRandomId = () => {
    setId(generateRandomId());
    setIdError('');
  };

  const handleConfirm = () => {
    if (!name.trim()) {
      alert(t('character.characterNameRequired'));
      return;
    }

    // 新增模式下验证ID
    if (!isEdit && idError) {
      alert(idError);
      return;
    }

    onConfirm({
      id: isEdit ? undefined : id.trim(),
      name: name.trim(),
      description: description.trim() || undefined,
    });

    // 重置表单
    if (!isEdit) {
      setId('');
      setName('');
      setDescription('');
      setIdError('');
    }
  };

  const handleCancel = () => {
    // 重置表单
    if (!isEdit) {
      setId('');
      setName('');
      setDescription('');
      setIdError('');
    }
    onClose();
  };

  // 键盘事件：ESC 关闭，Enter 确认
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, name, description, id, idError, isEdit]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="assistant-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header - MAC风格简洁 */}
        <div className="modal-header-mac">
          <div className="modal-title">
            {isEdit ? t('character.editCharacterTitle') : t('character.addCharacterTitle')}
          </div>
          <button className="modal-close-btn" onClick={handleCancel}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="modal-body-mac">
          {/* 新增模式：显示ID输入框 */}
          {!isEdit && (
            <div className="form-group-mac">
              <label className="form-label-mac">
                {t('character.characterId')}
                <span className="form-optional">可选</span>
              </label>
              <div className="input-with-action">
                <input
                  type="text"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder={t('character.characterIdPlaceholder')}
                  className="form-input-mac"
                  autoFocus
                />
                <button
                  type="button"
                  className="btn-action-mac"
                  onClick={handleGenerateRandomId}
                  title="生成随机ID"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <path d="M16 8h.01" />
                    <path d="M8 16h.01" />
                    <path d="M12 12h.01" />
                    <path d="M16 16h.01" />
                    <path d="M8 8h.01" />
                  </svg>
                  <span>随机生成</span>
                </button>
              </div>
              {idError && <div className="form-error-mac">{idError}</div>}
              <div className="form-hint-mac">留空则自动生成16位随机ID，创建后不可修改</div>
            </div>
          )}

          {/* 编辑模式：显示只读ID */}
          {isEdit && (
            <div className="form-group-mac">
              <label className="form-label-mac">{t('character.characterId')}</label>
              <div className="input-readonly-mac">
                <span className="readonly-value">{id}</span>
                <span className="readonly-badge">不可修改</span>
              </div>
            </div>
          )}

          <div className="form-group-mac">
            <label className="form-label-mac">
              {t('character.characterName')}
              <span className="form-required">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('character.characterNamePlaceholder')}
              className="form-input-mac"
              autoFocus={isEdit}
            />
          </div>

          <div className="form-group-mac">
            <label className="form-label-mac">
              {t('character.description')}
              <span className="form-optional">可选</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('character.descriptionPlaceholder')}
              className="form-textarea-mac"
              rows={3}
            />
          </div>
        </div>

        {/* Footer - MAC风格 */}
        <div className="modal-footer-mac">
          <button className="btn-mac btn-mac-secondary" onClick={handleCancel}>
            {t('character.cancel')}
          </button>
          <button className="btn-mac btn-mac-primary" onClick={handleConfirm}>
            {isEdit ? '保存修改' : '创建角色'}
          </button>
        </div>
      </div>
    </div>
  );
}
