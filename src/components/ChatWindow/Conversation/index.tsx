/**
 * Conversation Component
 *
 * Main conversation view with messages list and input area.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MessageList from './MessageList';
import InputArea from './InputArea';
import { useMessages } from '../shared/hooks';
import type { Session } from '../shared/types';
import './Conversation.css';

interface ConversationProps {
  session?: Session;
  // Window control callbacks
  onBack: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onHeaderMouseDown: (e: React.MouseEvent) => void;
}

function Conversation({
  session,
  onBack,
  onClose,
  onMinimize,
  onHeaderMouseDown,
}: ConversationProps) {
  const { t } = useTranslation(['dialog', 'common']);
  const [inputValue, setInputValue] = useState('');
  const [isFirstChatEntry, setIsFirstChatEntry] = useState(true);
  const [pagination, setPagination] = useState({
    loadedCount: 0,
    hasMore: true,
    isLoadingMore: false,
  });

  // Use messages hook
  const {
    messages,
    isSending,
    connected,
    streaming,
    sendMessage,
    loadMoreMessages,
  } = useMessages(session?.id || null);

  /**
   * Handle send message
   */
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || !session?.id || isSending) return;

    const content = inputValue.trim();
    setInputValue('');

    // sendMessage now uses session.assistantId (sessionKey) directly
    // instead of deriving from currentAssistant.integrations
    await sendMessage(content);
  }, [inputValue, session?.id, isSending, sendMessage]);

  /**
   * Handle keyboard events
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  /**
   * Handle input change
   */
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  /**
   * Handle load more messages
   */
  const handleLoadMore = useCallback(async () => {
    if (!session?.id || pagination.isLoadingMore || !pagination.hasMore) return;

    setPagination(prev => ({ ...prev, isLoadingMore: true }));

    try {
      // loadMoreMessages now uses session.assistantId (sessionKey) directly
      const newMessages = await loadMoreMessages(
        undefined, // no longer needed - sessionKey comes from session
        pagination.loadedCount
      );

      setPagination(prev => ({
        ...prev,
        loadedCount: prev.loadedCount + newMessages.length,
        // If we got 0 messages, there are no more
        hasMore: newMessages.length > 0,
        isLoadingMore: false,
      }));
    } catch (error) {
      console.error('[Conversation] Failed to load more messages:', error);
      setPagination(prev => ({ ...prev, isLoadingMore: false }));
    }
  }, [session?.id, pagination, loadMoreMessages]);

  /**
   * Handle scroll complete
   */
  const handleScrollComplete = useCallback(() => {
    setIsFirstChatEntry(false);
  }, []);

  /**
   * Focus input on mount and when session changes
   */
  useEffect(() => {
    // Focus input when conversation is first shown
    const timer = setTimeout(() => {
      const textarea = document.querySelector('.input-textarea') as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [session?.id]);

  /**
   * Reset pagination when session changes
   */
  useEffect(() => {
    if (session?.id) {
      setPagination({
        loadedCount: messages.length,
        // Assume there are more messages initially
        // We'll set hasMore to false only when "load more" returns 0 messages
        hasMore: messages.length > 0,
        isLoadingMore: false,
      });
      setIsFirstChatEntry(true);
    }
  }, [session?.id, messages.length]);

  /**
   * Format session title
   */
  const formatSessionTitle = useCallback((session?: Session) => {
    if (!session) return t('dialog:conversation');

    const parts = [];
    if (session.assistantName) parts.push(session.assistantName);
    if (session.assistantId && session.assistantId !== session.assistantName) {
      parts.push(`(${session.assistantId})`);
    }

    return parts.length > 0 ? parts.join(' ') : session.title;
  }, [t]);

  return (
    <div className="conversation">
      {/* Header */}
      <div className="conversation-header" onMouseDown={onHeaderMouseDown}>
        <button className="back-button" onClick={onBack} title={t('common:back')}>
          ←
        </button>
        <div className="conversation-title">
          <span>{formatSessionTitle(session)}</span>
        </div>
        <div className="conversation-actions">
          <button
            className="icon-button"
            onClick={onMinimize}
            title={t('common:minimize')}
          >
            −
          </button>
          <button
            className="icon-button close-button"
            onClick={onClose}
            title={t('common:close')}
          >
            ×
          </button>
        </div>
      </div>

      {/* Messages */}
      <MessageList
        messages={messages}
        onLoadMore={handleLoadMore}
        hasMore={pagination.hasMore}
        isLoadingMore={pagination.isLoadingMore}
        isFirstChatEntry={isFirstChatEntry}
        onScrollComplete={handleScrollComplete}
      />

      {/* Input */}
      <InputArea
        value={inputValue}
        onChange={handleInputChange}
        onSend={handleSendMessage}
        onKeyDown={handleKeyDown}
        disabled={!session}
        isSending={isSending}
        connected={connected}
        streaming={streaming}
      />
    </div>
  );
}

export default Conversation;
