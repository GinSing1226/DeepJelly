/**
 * MessageBubble Component
 *
 * Individual message bubble in the conversation view.
 * Supports markdown rendering and streaming cursor.
 */

import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { SessionMessage } from '../shared/types';
import { formatFullTimestamp } from '../shared/utils/format';
import './MessageBubble.css';

interface MessageBubbleProps {
  message: SessionMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.sender === 'user';
  const isSystem = message.sender === 'system';

  if (isSystem) {
    return (
      <div className="message-bubble system">
        <div className="message-content system">
          {message.content}
        </div>
        {message.timestamp && (
          <div className="message-time">{formatFullTimestamp(message.timestamp)}</div>
        )}
      </div>
    );
  }

  return (
    <div className={`message-bubble ${message.sender}`}>
      {!isUser && (
        <div className="message-avatar">🤖</div>
      )}
      {isUser && (
        <div className="message-avatar user">👤</div>
      )}
      <div className="message-content-wrapper">
        <div className="message-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p style={{ margin: '0.25em 0' }}>{children}</p>,
              code: (props) => {
                const { inline, children, className, ...rest } = props as { inline?: boolean; children?: React.ReactNode; className?: string };
                return inline ? (
                  <code style={{
                    background: 'rgba(0,0,0,0.05)',
                    padding: '2px 4px',
                    borderRadius: '3px',
                    fontSize: '0.9em'
                  }} {...rest}>{children}</code>
                ) : (
                  <code style={{
                    display: 'block',
                    background: 'rgba(0,0,0,0.05)',
                    padding: '8px',
                    borderRadius: '4px',
                    fontSize: '0.85em',
                    overflowX: 'auto'
                  }} {...rest}>{children}</code>
                );
              },
              pre: ({ children }) => <pre style={{
                background: 'rgba(0,0,0,0.05)',
                padding: '8px',
                borderRadius: '4px',
                overflowX: 'auto',
                margin: '0.5em 0'
              }}>{children}</pre>,
              ul: ({ children }) => <ul style={{ margin: '0.25em 0', paddingLeft: '1.5em' }}>{children}</ul>,
              ol: ({ children }) => <ol style={{ margin: '0.25em 0', paddingLeft: '1.5em' }}>{children}</ol>,
              li: ({ children }) => <li style={{ margin: '0.1em 0' }}>{children}</li>,
              strong: ({ children }) => <strong>{children}</strong>,
              em: ({ children }) => <em>{children}</em>,
              a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{
                color: isUser ? 'rgba(255,255,255,0.9)' : '#06b6d4',
                textDecoration: 'underline'
              }}>{children}</a>,
            }}
          >
            {message.content}
          </ReactMarkdown>
          {message.isStreaming && <span className="streaming-cursor">█</span>}
        </div>
        {message.timestamp && (
          <div className="message-time">{formatFullTimestamp(message.timestamp)}</div>
        )}
      </div>
    </div>
  );
}

// Use memo for performance optimization
export default memo(MessageBubble, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.isStreaming === nextProps.message.isStreaming
  );
});
