/**
 * Alert Dialog Component
 *
 * 通用警告/提示弹窗组件 - MAC精简风格
 * 符合米白+深炭黑淡雅设计规范
 * 用于显示错误、警告、提示等信息
 */

import { useEffect } from 'react';

export type AlertDialogType = 'error' | 'warning' | 'info' | 'success';

interface AlertDialogProps {
  /** 是否显示弹窗 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 弹窗类型 */
  type?: AlertDialogType;
  /** 标题 */
  title: string;
  /** 消息内容 */
  message: string;
  /** 确认按钮文本 */
  confirmText?: string;
}

/**
 * 获取弹窗类型对应的图标
 */
function getIconForType(type: AlertDialogType) {
  switch (type) {
    case 'error':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
      );
    case 'warning':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4" />
          <path d="M12 16h.01" />
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
      );
    case 'success':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <path d="M22 4L12 14.01l-3-3" />
        </svg>
      );
    case 'info':
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      );
  }
}

/**
 * 获取弹窗类型对应的样式类
 */
function getStyleClassForType(type: AlertDialogType): string {
  switch (type) {
    case 'error': return 'alert-dialog-error';
    case 'warning': return 'alert-dialog-warning';
    case 'success': return 'alert-dialog-success';
    case 'info':
    default: return 'alert-dialog-info';
  }
}

/**
 * 警告/提示弹窗主组件
 */
export default function AlertDialog({
  isOpen,
  onClose,
  type = 'info',
  title,
  message,
  confirmText = '确定',
}: AlertDialogProps) {
  // 键盘事件：ESC 关闭，Enter 确认
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const styleClass = getStyleClassForType(type);

  return (
    <div className="modal-overlay">
      <div className={`alert-dialog ${styleClass}`}>
        {/* Header - MAC风格简洁 */}
        <div className="alert-dialog-header">
          <div className={`alert-dialog-icon ${styleClass}`}>
            {getIconForType(type)}
          </div>
          <div className="alert-dialog-title">{title}</div>
          <button className="modal-close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="alert-dialog-body">
          <p className="alert-dialog-message">{message}</p>
        </div>

        {/* Footer - MAC风格 */}
        <div className="modal-footer-mac">
          <button className="btn-mac btn-mac-primary" onClick={onClose}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
