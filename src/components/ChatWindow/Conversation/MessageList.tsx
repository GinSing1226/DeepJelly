/**
 * MessageList Component
 *
 * Scrollable list of messages with pagination support.
 */

import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import MessageBubble from './MessageBubble';
import type { SessionMessage } from '../shared/types';
import './MessageList.css';

interface MessageListProps {
  messages: SessionMessage[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  isFirstChatEntry?: boolean;
  onScrollComplete?: () => void;
}

function MessageList({
  messages,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
  isFirstChatEntry = false,
  onScrollComplete,
}: MessageListProps) {
  const { t } = useTranslation(['dialog']);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastScrollHeight = useRef<number>(0);
  const previousMessageCount = useRef<number>(0);

  /**
   * Scroll to latest message
   */
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const messageCount = messages.length;

    // First time entering chat: jump to bottom instantly
    if (isFirstChatEntry && messageCount > 0) {
      container.scrollTop = container.scrollHeight;
      onScrollComplete?.();
      previousMessageCount.current = messageCount;
      return;
    }

    // New message arrived: smooth scroll to bottom
    if (messageCount > previousMessageCount.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      previousMessageCount.current = messageCount;
    }
  }, [messages.length, isFirstChatEntry, onScrollComplete]);

  /**
   * Infinite scroll - load more when scrolling to top
   */
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !hasMore || isLoadingMore) return;

    const handleScroll = () => {
      // When scrolled near top (within 100px), load more messages
      if (container.scrollTop < 100 && hasMore && !isLoadingMore) {
        // Save current scroll height to restore position after loading
        lastScrollHeight.current = container.scrollHeight;
        onLoadMore?.();
      }
    };

    container.addEventListener('scroll', handleScroll);

    // Restore scroll position after new messages are loaded
    if (lastScrollHeight.current > 0 && container.scrollHeight !== lastScrollHeight.current) {
      const newScrollTop = container.scrollHeight - lastScrollHeight.current;
      container.scrollTop = newScrollTop > 0 ? newScrollTop : 0;
      lastScrollHeight.current = 0;
    }

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [hasMore, isLoadingMore, onLoadMore, messages.length]);

  return (
    <div className="message-list" ref={messagesContainerRef}>
      {messages.length === 0 ? (
        <div className="message-list-empty">
          <div className="empty-icon">💬</div>
          <div className="empty-text">{t('dialog:startTyping')}</div>
        </div>
      ) : (
        <>
          {/* Load more button at top */}
          {hasMore && !isLoadingMore && (
            <button
              className="load-more-button"
              onClick={onLoadMore}
              disabled={isLoadingMore}
            >
              {t('dialog:loadMore') || 'Load More'}
            </button>
          )}
          {/* Loading indicator at top */}
          {isLoadingMore && (
            <div className="message-list-loading">
              <span className="loading-spinner"></span>
              <span>{t('dialog:loadingMessages') || 'Loading...'}</span>
            </div>
          )}
          {/* Messages */}
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

export default MessageList;
