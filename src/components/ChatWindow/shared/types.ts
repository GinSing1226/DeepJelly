/**
 * Chat Window Shared Types
 *
 * Type definitions for the ChatWindow feature module.
 */

/**
 * View mode in the chat window
 */
export type ChatViewMode = 'list' | 'conversation' | 'search';

/**
 * Message sender type
 */
export type MessageSender = 'user' | 'assistant' | 'system';

/**
 * Chat type (private or group)
 */
export type ChatType = 'private' | 'group';

/**
 * Session message interface
 */
export interface SessionMessage {
  id: string;
  content: string;
  sender: MessageSender;
  timestamp: number;
  isStreaming?: boolean;
}

/**
 * Session interface
 */
export interface Session {
  id: string;
  title: string;
  assistantId?: string;
  assistantName?: string;
  assistantAvatar?: string;
  lastMessage?: string;
  lastMessageTime?: number;
  unreadCount: number;
  isGroup: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Context menu position
 */
export interface ContextMenuPosition {
  x: number;
  y: number;
}

/**
 * Context menu item
 */
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  action: () => void;
  disabled?: boolean;
  dangerous?: boolean;
}

/**
 * Search filter options
 */
export interface SearchFilters {
  query: string;
  dateFrom?: number;
  dateTo?: number;
  hasUnread?: boolean;
}

/**
 * Pagination state
 */
export interface PaginationState {
  loadedCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
}

/**
 * Streaming message state
 */
export interface StreamingState {
  isStreaming: boolean;
  content: string;
  messageId?: string;
}

/**
 * Chat window state
 */
export interface ChatWindowState {
  viewMode: ChatViewMode;
  currentSessionId: string | null;
  searchQuery: string;
  isInitialLoading: boolean;
  pagination: PaginationState;
}

/**
 * Session list props
 */
export interface SessionListProps {
  sessions: Session[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectSession: (id: string) => void;
  onEditSession?: (id: string) => void;
  onDeleteSession?: (id: string) => void;
  onCreateSession?: () => void;
  onRefreshSessions: () => void;
  isLoading: boolean;
  isInitialLoading: boolean;
  connected: boolean;
}

/**
 * Conversation view props
 */
export interface ConversationProps {
  session?: Session;
  messages: SessionMessage[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onBack: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  isSending: boolean;
  connected: boolean;
  streaming?: StreamingState;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

/**
 * Search view props
 */
export interface SearchViewProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onSelectSession: (id: string) => void;
  onBack: () => void;
}
