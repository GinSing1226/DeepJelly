/**
 * SessionCard Component
 *
 * Individual session card in the session list.
 * Supports click to select and right-click for context menu.
 */

import { useState, useCallback, memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Session, ContextMenuItem } from '../shared/types';
import { formatTimestamp, extractPlainText } from '../shared/utils/format';
import { CONTEXT_MENU_ACTIONS } from '../shared/constants';
import './SessionCard.css';

interface SessionCardProps {
  session: Session;
  onClick: () => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function SessionCard({ session, onClick, onEdit, onDelete }: SessionCardProps) {
  const { t } = useTranslation(['dialog']);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

  /**
   * Handle context menu
   */
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  }, []);

  /**
   * Handle context menu item click
   */
  const handleContextMenuAction = useCallback((action: string) => {
    setContextMenuOpen(false);

    switch (action) {
      case CONTEXT_MENU_ACTIONS.EDIT:
        onEdit?.(session.id);
        break;
      case CONTEXT_MENU_ACTIONS.DELETE:
        onDelete?.(session.id);
        break;
      case CONTEXT_MENU_ACTIONS.MARK_READ:
        // Mark as read logic here
        break;
      case CONTEXT_MENU_ACTIONS.MARK_UNREAD:
        // Mark as unread logic here
        break;
      default:
        break;
    }
  }, [session.id, onEdit, onDelete]);

  /**
   * Context menu items
   */
  const contextMenuItems: ContextMenuItem[] = [
    {
      id: CONTEXT_MENU_ACTIONS.EDIT,
      label: t('dialog:contextMenuRename') || 'Rename',
      icon: '✏️',
      action: () => handleContextMenuAction(CONTEXT_MENU_ACTIONS.EDIT),
    },
    {
      id: CONTEXT_MENU_ACTIONS.DELETE,
      label: t('dialog:contextMenuDelete') || 'Delete',
      icon: '🗑️',
      action: () => handleContextMenuAction(CONTEXT_MENU_ACTIONS.DELETE),
      dangerous: true,
    },
  ];

  return (
    <>
      <div
        className="session-card"
        onClick={onClick}
        onContextMenu={handleContextMenu}
        title={session.title}
      >
        <div className="session-avatar">
          {session.isGroup ? '👥' : (session.assistantAvatar || '🤖')}
        </div>
        <div className="session-info">
          <div className="session-header">
            <span className="session-title">{session.assistantName || session.title}</span>
            {session.lastMessageTime && (
              <span className="session-time">{formatTimestamp(session.lastMessageTime)}</span>
            )}
          </div>
          <div className="session-preview">
            {extractPlainText(session.lastMessage || '...', 50)}
          </div>
        </div>
        {/* Hover action buttons */}
        <div className="session-actions">
          <button
            className="session-action-button edit"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(session.id);
            }}
            title={t('dialog:contextMenuRename') || 'Rename'}
          >
            ✏️
          </button>
          <button
            className="session-action-button delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(session.id);
            }}
            title={t('dialog:contextMenuDelete') || 'Delete'}
          >
            🗑️
          </button>
        </div>
      </div>

      {contextMenuOpen && (
        <>
          <div
            className="context-menu-backdrop"
            onClick={() => setContextMenuOpen(false)}
          />
          <div
            className="context-menu"
            style={{ left: contextMenuPosition.x, top: contextMenuPosition.y }}
          >
            {contextMenuItems.map((item) => (
              <button
                key={item.id}
                className={`context-menu-item ${item.dangerous ? 'dangerous' : ''}`}
                onClick={item.action}
                disabled={item.disabled}
              >
                {item.icon && <span className="context-menu-icon">{item.icon}</span>}
                <span className="context-menu-label">{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// Use memo for performance optimization
export default memo(SessionCard, (prevProps, nextProps) => {
  return (
    prevProps.session.id === nextProps.session.id &&
    prevProps.session.title === nextProps.session.title &&
    prevProps.session.lastMessage === nextProps.session.lastMessage &&
    prevProps.session.lastMessageTime === nextProps.session.lastMessageTime
  );
});
