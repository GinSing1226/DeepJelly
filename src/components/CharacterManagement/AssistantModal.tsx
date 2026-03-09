/**
 * Assistant Modal Component
 *
 * 助手编辑弹窗组件 - MVP阶段只允许编辑名称和描述
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface AssistantModalProps {
  /** 是否显示弹窗 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 确认回调 */
  onConfirm: (data: { name: string; description: string }) => void;
  /** 编辑模式：传入要编辑的助手数据 */
  assistant?: { id: string; name: string; description?: string } | null;
  /** 是否为编辑模式 (MVP阶段固定为true) */
  isEdit?: boolean;
}

/**
 * 助手编辑弹窗主组件
 * MVP阶段：只允许编辑名称和描述，不允许修改ID、应用类型、认证信息
 */
export default function AssistantModal({
  isOpen,
  onClose,
  onConfirm,
  assistant,
  isEdit = true,
}: AssistantModalProps) {
  const { t } = useTranslation('settings');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // 编辑模式：初始化表单数据
  useEffect(() => {
    if (isEdit && assistant) {
      setName(assistant.name);
      setDescription(assistant.description || '');
    } else {
      // 新增模式：重置表单
      setName('');
      setDescription('');
    }
  }, [isOpen, isEdit, assistant]);

  const handleConfirm = () => {
    if (!name.trim()) {
      alert(t('character.assistantNameRequired'));
      return;
    }
    onConfirm({
      name: name.trim(),
      description: description.trim(),
    });
    // 重置表单
    setName('');
    setDescription('');
  };

  const handleCancel = () => {
    // 重置表单
    if (!isEdit) {
      setName('');
      setDescription('');
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
  }, [isOpen, name, description]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content assistant-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('character.editAssistantTitle')}</h3>
        </div>

        <div className="modal-body">
          <div className="form-group-modern">
            <label className="form-label-modern">{t('character.assistantName')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('character.assistantNamePlaceholder')}
              className="form-input-modern"
              autoFocus
            />
          </div>

          <div className="form-group-modern">
            <label className="form-label-modern">{t('character.description')}</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('character.descriptionPlaceholder')}
              className="form-input-modern"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={handleCancel}>
            {t('character.cancel')}
          </button>
          <button className="btn-primary" onClick={handleConfirm}>
            {t('character.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
