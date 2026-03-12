/**
 * Confirm Dialog
 *
 * Meta-Name: Confirm Dialog
 * Meta-Description: Reusable confirmation dialog for destructive actions
 */

import { useTranslation } from 'react-i18next';

export interface ConfirmDialogProps {
  /** Whether to show the dialog */
  isOpen: boolean;
  /** Dialog title */
  title: string;
  /** Dialog message */
  message: string;
  /** Optional warning message */
  warning?: string;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Whether to show danger style */
  isDanger?: boolean;
  /** Confirm callback */
  onConfirm: () => void;
  /** Cancel callback */
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  warning,
  confirmText,
  cancelText,
  isDanger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation(['settings', 'common']);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <div className="confirm-dialog-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="confirm-dialog-header">
          <h3>{title}</h3>
          <button className="btn-close" onClick={onCancel}>×</button>
        </div>

        {/* Body */}
        <div className="confirm-dialog-body">
          <p className="confirm-message">{message}</p>
          {warning && <p className="confirm-warning">{warning}</p>}
        </div>

        {/* Footer */}
        <div className="confirm-dialog-footer">
          <button className="card-action-btn" onClick={onCancel}>
            {cancelText || t('common:cancel')}
          </button>
          <button
            className={`card-action-btn ${isDanger ? 'danger' : 'primary'}`}
            onClick={handleConfirm}
          >
            {confirmText || t('common:confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
