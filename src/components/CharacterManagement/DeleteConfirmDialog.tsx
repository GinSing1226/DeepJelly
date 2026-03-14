/**
 * Delete Confirmation Dialog Component
 *
 * 删除确认对话框 - MAC精简风格
 * 符合米白+深炭黑淡雅设计规范
 */

interface DeleteConfirmDialogProps {
  /** 是否显示弹窗 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 确认删除回调 */
  onConfirm: () => void;
  /** 要删除的项目名称 */
  itemName: string;
  /** 项目类型 */
  itemType?: 'assistant' | 'character' | 'appearance';
  /** 额外警告信息 */
  warning?: string;
}

/**
 * 删除确认对话框主组件
 */
export default function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  itemType = 'assistant',
  warning,
}: DeleteConfirmDialogProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const getItemTypeText = () => {
    switch (itemType) {
      case 'assistant': return '助手';
      case 'character': return '角色';
      case 'appearance': return '形象';
      default: return '项目';
    }
  };

  return (
    <div className="modal-overlay">
      <div className="delete-confirm-dialog">
        {/* Header with warning icon */}
        <div className="delete-confirm-header">
          <div className="delete-confirm-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4" />
              <path d="M12 16h.01" />
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </div>
          <h3 className="delete-confirm-title">确认删除</h3>
        </div>

        {/* Body */}
        <div className="delete-confirm-body">
          <p className="delete-confirm-message">
            确定要删除{getItemTypeText()}「<strong>{itemName}</strong>」吗？
          </p>

          {warning && (
            <div className="delete-confirm-warning">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4" />
                <path d="M12 16h.01" />
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              </svg>
              <span>{warning}</span>
            </div>
          )}

          <div className="delete-confirm-notice">
            此操作不可撤销，请谨慎操作
          </div>
        </div>

        {/* Footer */}
        <div className="delete-confirm-footer">
          <button className="btn-mac btn-mac-secondary" onClick={onClose}>
            取消
          </button>
          <button className="btn-mac btn-mac-danger" onClick={handleConfirm}>
            删除
          </button>
        </div>
      </div>
    </div>
  );
}
