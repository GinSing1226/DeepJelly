import { useEffect, useRef } from 'react';
import { useMessageStore, Message } from '@/stores/messageStore';
import './styles.css';

interface BubbleProps {
  message: Message;
  onClose?: () => void;
}

export function Bubble({ message, onClose }: BubbleProps) {
  const bubbleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 入场动画
    if (bubbleRef.current) {
      bubbleRef.current.classList.add('bubble-enter');
      requestAnimationFrame(() => {
        bubbleRef.current?.classList.remove('bubble-enter');
        bubbleRef.current?.classList.add('bubble-enter-active');
      });
    }
  }, []);

  const getBubbleClass = () => {
    const classes = ['bubble', `bubble-${message.type}`, `bubble-${message.sender}`];
    return classes.join(' ');
  };

  const renderEmoji = () => {
    // 如果是emoji类型，渲染emoji图标
    if (message.type === 'emoji') {
      return (
        <div className="bubble-emoji">
          <span>{message.content}</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div ref={bubbleRef} className={getBubbleClass()}>
      {message.type === 'emoji' ? (
        renderEmoji()
      ) : (
        <div className="bubble-content">
          <div className="bubble-text">{message.content}</div>
          {message.type === 'chat' && (
            <div className="bubble-meta">
              <span className="bubble-time">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>
      )}
      {onClose && (
        <button className="bubble-close" onClick={onClose}>
          ×
        </button>
      )}
    </div>
  );
}

// 状态气泡组件（显示当前状态/表情）
export function StatusBubble() {
  const currentBubble = useMessageStore((s) => s.currentBubble);
  const removeMessage = useMessageStore((s) => s.removeMessage);

  if (!currentBubble || currentBubble.type !== 'status') {
    return null;
  }

  return (
    <Bubble
      message={currentBubble}
      onClose={() => removeMessage(currentBubble.id)}
    />
  );
}

// 聊天气泡组件
export function ChatBubble() {
  const currentBubble = useMessageStore((s) => s.currentBubble);
  const removeMessage = useMessageStore((s) => s.removeMessage);

  if (!currentBubble || currentBubble.type !== 'chat') {
    return null;
  }

  return (
    <Bubble
      message={currentBubble}
      onClose={() => removeMessage(currentBubble.id)}
    />
  );
}

// 浮动气泡容器
export function FloatingBubble() {
  const currentBubble = useMessageStore((s) => s.currentBubble);
  const removeMessage = useMessageStore((s) => s.removeMessage);

  // 过滤掉 behavior 类型的消息（behavior 只用于触发动画，不显示气泡）
  if (!currentBubble || currentBubble.type === 'behavior') {
    return null;
  }

  return (
    <div className="floating-bubble-container">
      <Bubble
        message={currentBubble}
        onClose={() => removeMessage(currentBubble.id)}
      />
    </div>
  );
}
