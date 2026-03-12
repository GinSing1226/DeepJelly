/**
 * Chat Window Constants
 *
 * Constants for the ChatWindow feature.
 */

/**
 * Default values
 */
export const DEFAULTS = {
  SESSION_PAGE_SIZE: 50,
  MESSAGE_PAGE_SIZE: 50,
  INITIAL_SESSION_LIMIT: 10,
  INITIAL_MESSAGE_LIMIT: 100,
  LOAD_MORE_SESSION_LIMIT: 10,
  LOAD_MORE_MESSAGE_LIMIT: 50,
  SEARCH_DEBOUNCE_MS: 300,
  INPUT_MAX_HEIGHT: 120,
  AVATAR_SIZE: 44,
  MESSAGE_MAX_WIDTH: 75,
} as const;

/**
 * Animation durations (ms)
 */
export const ANIMATION = {
  FAST: 150,
  NORMAL: 200,
  SLOW: 300,
} as const;

/**
 * Local storage keys
 */
export const STORAGE_KEYS = {
  WINDOW_POSITION: 'chatwindow_position',
  WINDOW_SIZE: 'chatwindow_size',
  VIEW_MODE: 'chatwindow_view_mode',
  LAST_SESSION: 'chatwindow_last_session',
} as const;

/**
 * Event names
 */
export const EVENTS = {
  SESSION_CREATED: 'chatwindow:session_created',
  SESSION_UPDATED: 'chatwindow:session_updated',
  SESSION_DELETED: 'chatwindow:session_deleted',
  MESSAGE_RECEIVED: 'chatwindow:message_received',
  MESSAGE_SENT: 'chatwindow:message_sent',
  STREAMING_START: 'chatwindow:streaming_start',
  STREAMING_UPDATE: 'chatwindow:streaming_update',
  STREAMING_END: 'chatwindow:streaming_end',
} as const;

/**
 * Keyboard shortcuts
 */
export const KEYBOARD_SHORTCUTS = {
  SEND_MESSAGE: 'Enter',
  NEW_LINE: 'Shift+Enter',
  CLOSE_WINDOW: 'Escape',
  TOGGLE_SEARCH: 'CmdOrCtrl+F',
  BACK_TO_LIST: 'Escape',
} as const;

/**
 * Context menu actions
 */
export const CONTEXT_MENU_ACTIONS = {
  EDIT: 'edit',
  DELETE: 'delete',
  MARK_READ: 'mark_read',
  MARK_UNREAD: 'mark_unread',
  PIN: 'pin',
  UNPIN: 'unpin',
} as const;
