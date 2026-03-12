/**
 * Appearance Modal Component
 *
 * 形象编辑/新增弹窗组件 - MAC精简风格
 * 符合米白+深炭黑淡雅设计规范
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface AppearanceModalProps {
  /** 是否显示弹窗 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 确认回调 */
  onConfirm: (data: {
    id?: string;
    name: string;
    description: string;
    isDefault: boolean;
  }) => void;
  /** 编辑模式：传入要编辑的形象数据 */
  appearance?: {
    id: string;
    name: string;
    description?: string;
    isDefault?: boolean;
  } | null;
  /** 是否为编辑模式 */
  isEdit?: boolean;
  /** 是否为第一个形象（自动设为默认） */
  isFirst?: boolean;
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
 * 形象编辑/新增弹窗主组件
 */
export default function AppearanceModal({
  isOpen,
  onClose,
  onConfirm,
  appearance,
  isEdit = true,
  isFirst = false,
}: AppearanceModalProps) {
  const { t } = useTranslation('settings');
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [idError, setIdError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 初始化表单数据
  useEffect(() => {
    if (isOpen) {
      if (isEdit && appearance) {
        setId(appearance.id);
        setName(appearance.name);
        setDescription(appearance.description || '');
        setIsDefault(appearance.isDefault || false);
      } else {
        // 新增模式：生成随机ID
        const newId = generateRandomId();
        setId(newId);
        setName('');
        setDescription('');
        // 第一个形象自动设为默认
        setIsDefault(isFirst);
        setIdError('');
      }
    }
  }, [isOpen, isEdit, appearance, isFirst]);

  // 验证ID
  useEffect(() => {
    if (!isEdit && id) {
      if (!validateCustomId(id)) {
        setIdError('ID格式不正确，请使用3-50位字母、数字、下划线或连字符');
      } else {
        setIdError('');
      }
    }
  }, [id, isEdit]);

  const handleGenerateRandomId = () => {
    setId(generateRandomId());
    setIdError('');
  };

  const handleConfirm = () => {
    if (isSubmitting) return;

    if (!name.trim()) {
      alert(t('character.appearanceNameRequired') || '形象名称不能为空');
      return;
    }

    // 新增模式下验证ID
    if (!isEdit && idError) {
      alert(idError);
      return;
    }

    setIsSubmitting(true);

    onConfirm({
      id: isEdit ? undefined : id.trim(),
      name: name.trim(),
      description: description.trim(),
      isDefault,
    });

    // 重置表单（在成功回调后）
    setTimeout(() => {
      setIsSubmitting(false);
      if (!isEdit) {
        setId('');
        setName('');
        setDescription('');
        setIsDefault(false);
        setIdError('');
      }
    }, 100);
  };

  const handleCancel = () => {
    // 重置表单
    if (!isEdit) {
      setId('');
      setName('');
      setDescription('');
      setIsDefault(false);
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
  }, [isOpen, name, description, id, idError, isDefault, isEdit]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="appearance-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header - MAC风格简洁 */}
        <div className="modal-header-mac">
          <div className="modal-title">
            {isEdit
              ? (t('character.editAppearanceTitle') || '编辑形象')
              : (t('character.addAppearanceTitle') || '新增形象')}
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
                {t('character.appearanceId') || '形象ID'}
                <span className="form-optional">可选</span>
              </label>
              <div className="input-with-action">
                <input
                  type="text"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder={t('character.appearanceIdPlaceholder') || '留空自动生成'}
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
              <label className="form-label-mac">{t('character.appearanceId') || '形象ID'}</label>
              <div className="input-readonly-mac">
                <span className="readonly-value">{id}</span>
                <span className="readonly-badge">不可修改</span>
              </div>
            </div>
          )}

          <div className="form-group-mac">
            <label className="form-label-mac">
              {t('character.appearanceName') || '形象名称'}
              <span className="form-required">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('character.appearanceNamePlaceholder') || '例如：休闲装'}
              className="form-input-mac"
              autoFocus={isEdit}
            />
          </div>

          <div className="form-group-mac">
            <label className="form-label-mac">
              {t('character.description') || '描述'}
              <span className="form-optional">可选</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('character.descriptionPlaceholder') || '描述该形象的特点和用途'}
              className="form-textarea-mac"
              rows={3}
            />
          </div>

          {/* 设为默认复选框 */}
          {!isEdit && (
            <div className="form-group-mac">
              <label className="checkbox-label-mac">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="checkbox-mac"
                />
                <span>{t('character.setDefault') || '设为默认形象'}</span>
              </label>
              <div className="form-hint-mac">
                {isFirst
                  ? '这是第一个形象，将自动设为默认'
                  : '默认形象决定角色视窗初始显示的外观'}
              </div>
            </div>
          )}
        </div>

        {/* Footer - MAC风格 */}
        <div className="modal-footer-mac">
          <button className="btn-mac btn-mac-secondary" onClick={handleCancel} disabled={isSubmitting}>
            {t('character.cancel') || '取消'}
          </button>
          <button className="btn-mac btn-mac-primary" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? '提交中...' : (isEdit ? (t('character.save') || '保存修改') : (t('character.create') || '创建形象'))}
          </button>
        </div>
      </div>
    </div>
  );
}
