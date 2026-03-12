import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useEffect, useState, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
// REMOVED: Old store
// import { useSessionQueueStore } from '@/stores/sessionQueueStore';
// NEW: Character-isolated store
import { sessionQueueStore } from '@/stores/characterStores';
import { useMessageStore } from '@/stores/messageStore';
import { useSessionStore } from '@/stores/sessionStore';
import './styles.css';

/**
 * Chat type enumeration
 */
export type ChatType = 'single' | 'group';

/**
 * Props for the ChatBubble component
 */
export interface ChatBubbleProps {
  /** Optional callback when bubble is clicked to open dialog */
  onOpenDialog?: () => void;
  /** Whether to disable click-to-open-dialog behavior (for character windows) */
  disableClick?: boolean;
  /** Maximum number of messages in queue (default: 10) */
  maxQueueSize?: number;
  /** Display duration for each message in milliseconds (default: 10000) */
  messageDuration?: number;
  /** Character ID for filtering messages from the routed store (REQUIRED) */
  characterId?: string;
  /** DEPRECATED: Use characterId instead */
  assistantId?: string;
  /** DEPRECATED: Session keys filtering is now handled by MessageGateway */
  sessionKeys?: string[];
}

/**
 * ChatBubble Component
 *
 * 直接从sessionQueueStore读取并显示消息
 * 显示10秒后自动隐藏
 */
export function ChatBubble({
  onOpenDialog,
  disableClick = false,
  characterId,
  assistantId, // DEPRECATED: mapped to characterId for backward compatibility
  messageDuration = 10000,
}: ChatBubbleProps) {
  // Use characterId if provided, otherwise fall back to assistantId for backward compatibility
  const effectiveCharacterId = characterId || assistantId;

  // 从新的 character-isolated sessionQueueStore 订阅指定角色的消息
  const [sessions, setSessions] = useState(() =>
    effectiveCharacterId
      ? sessionQueueStore.getState().getSessions(effectiveCharacterId)
      : []
  );

  // Subscribe to store changes
  useEffect(() => {
    if (!effectiveCharacterId) {
      setSessions([]);
      return;
    }

    const unsubscribe = sessionQueueStore.subscribe((state) => {
      setSessions(state.getSessions(effectiveCharacterId));
    });

    return unsubscribe;
  }, [effectiveCharacterId]);

  // 从 messageStore 获取直接添加的聊天消息（向后兼容）
  const directMessages = useMessageStore((s) => s.messages);

  // 合并消息 - 只使用该角色的消息
  const allMessages = [
    ...sessions,
    ...directMessages.filter(m => {
      if (m.type !== 'chat') return false;
      if (!effectiveCharacterId) return true;
      return m.receiverId === effectiveCharacterId;
    }),
  ];

  // 控制显示状态：有消息时显示，10秒后隐藏
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 获取最新消息（最后一个，因为session是按添加顺序排列的）
  const latestMessage = allMessages.length > 0 ? allMessages[allMessages.length - 1] : null;

  // 当最新消息变化时，显示气泡并设置10秒隐藏计时器
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (latestMessage) {
      setVisible(true);
      timerRef.current = setTimeout(() => {
        setVisible(false);
      }, messageDuration);
    } else {
      setVisible(false);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [latestMessage, messageDuration]);

  // 点击气泡打开对应会话（必须在条件返回之前定义，避免 hooks 数量不一致）
  const handleClick = useCallback(async () => {
    if (!latestMessage || disableClick) return;

    const hasSessionId = 'sessionId' in latestMessage && typeof latestMessage.sessionId === 'string';
    if (hasSessionId) {
      const sessionId = (latestMessage as any).sessionId;
      useSessionStore.getState().setCurrentSession(sessionId);
    }

    if (onOpenDialog) {
      onOpenDialog();
    } else {
      try {
        await invoke('open_dialog_window');
      } catch (error) {
        console.error('[ChatBubble] Failed to open dialog:', error);
      }
    }
  }, [latestMessage, onOpenDialog, disableClick]);

  // 如果没有消息或不可见，不渲染（在所有 hooks 之后）
  if (!latestMessage || !visible) {
    return null;
  }

  // 在条件返回之后访问 latestMessage 属性（此时保证非空）
  const content = latestMessage.content || '';

  // 获取消息内容（兼容session和messageStore格式）
  const messageText = typeof content === 'string' ? content : (content as any)?.content || '';

  return (
    <div
      className="chat-bubble chat-single"
      onClick={handleClick}
      title={disableClick ? undefined : '点击打开对话框'}
    >
      <div className="chat-bubble-body">
        <div className="chat-bubble-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="chat-paragraph">{children}</p>,
              code: ({ inline, className, children }: { inline?: boolean; className?: string; children?: React.ReactNode }) => {
                return inline ? (
                  <code className={className}>{children}</code>
                ) : (
                  <pre className="chat-code-block">
                    <code className={className}>{children}</code>
                  </pre>
                );
              },
            }}
          >
            {messageText}
          </ReactMarkdown>
        </div>
        <div className="chat-bubble-pointer" />
      </div>
    </div>
  );
}
