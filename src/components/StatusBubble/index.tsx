import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStatusBubble } from './useStatusBubble';
export type { StatusData, StatusType } from './useStatusBubble';
import './styles.css';

/**
 * Preset status configurations with emoji and text
 *
 * NOTE: 已禁用硬编码映射，改用 emojiResolver 懒加载方案
 * 如果需要验证方案 B 是否生效，请保持此注释状态
 */
// const PRESET_STATUSES: Record<StatusType, { emoji: string; text: string }> = {
//   idle: { emoji: '💤', text: '空闲' },
//   listening: { emoji: '👂', text: '倾听' },
//   thinking: { emoji: '🤔', text: '思考' },
//   executing: { emoji: '⚙️', text: '执行' },
//   speaking: { emoji: '💬', text: '说话' },
//   network_error: { emoji: '❌', text: '网络异常' },
// };

// 类型断言，避免编译错误
const PRESET_STATUSES: Record<StatusType, { emoji: string; text: string }> = {} as any;

/**
 * Props for the StatusBubble component
 */
export interface StatusBubbleProps {
  /** Current status to display, null means no status */
  status: StatusData | null;
  /** Optional preset status type (overrides emoji/text in status if provided) */
  statusType?: StatusType;
  /** Optional callback when bubble is clicked */
  onDismiss?: () => void;
}

/**
 * StatusBubble Component
 *
 * Displays a rounded rectangle status bubble above the character's head.
 * Supports both preset statuses and custom emoji + text combinations.
 * Uses native emoji rendering for consistent display across modern browsers.
 *
 * @param props - Component props
 */
export function StatusBubble({ status, statusType, onDismiss }: StatusBubbleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHiding, setIsHiding] = useState(false);

  // 生成一个气泡实例ID用于追踪
  const bubbleId = useRef(`BUB_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`).current;
  const bubbleTag = `[${bubbleId}]`;

  // 直接从 props 计算要显示的内容
  const displayEmoji = ((): string => {
    if (!status) return '';
    if (statusType && PRESET_STATUSES[statusType]) {
      return PRESET_STATUSES[statusType].emoji;
    }
    return status.emoji || '';
  })();

  const displayText = ((): string => {
    if (!status) return '';
    if (statusType && PRESET_STATUSES[statusType]) {
      return PRESET_STATUSES[statusType].text;
    }
    return status.text;
  })();

  // 计算是否应该显示：有 status 且不在隐藏状态
  const shouldShow = !!status;
  const hasContent = !!displayEmoji || !!displayText;
  const visible = shouldShow && hasContent && !isHiding;

  // Update status when props change - 使用 useLayoutEffect 同步更新状态
  useLayoutEffect(() => {
    if (!status) {
      return;
    }

    setIsHiding(false);

    // Handle auto-hide if duration is specified and > 0
    const duration = status.duration;
    if (duration && duration > 0) {
      const timer = setTimeout(() => {
        setIsHiding(true);
        setTimeout(() => {
          setIsHiding(false);
        }, 200); // Match animation duration in CSS
      }, duration);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [status, statusType, displayEmoji, displayText]);

  // Debug: Check if DOM element is created and its position
  useEffect(() => {
    if (visible && containerRef.current) {
      // 添加原生事件监听器用于调试
      const handleNativeClick = (e: Event) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (onDismiss) {
          onDismiss();
        }
      };

      const element = containerRef.current;
      element.addEventListener('click', handleNativeClick, true); // 使用捕获阶段

      return () => {
        element.removeEventListener('click', handleNativeClick, true);
      };
    }
  }, [visible, onDismiss]);

  // Handle click to dismiss with event propagation stop
  // MUST be before early return to satisfy React Hooks rules
  const handleClick = useCallback((e: React.MouseEvent) => {
    // 阻止事件冒泡，防止触发父元素的点击事件
    e.stopPropagation();
    e.preventDefault();
    e.nativeEvent.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    if (onDismiss) {
      onDismiss();
    }
  }, [onDismiss, status]);

  // Don't render if not visible
  if (!visible) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`status-bubble${isHiding ? ' fade-out' : ''}`}
      onClick={handleClick}
      onMouseDown={(e) => {
        e.stopPropagation();
        if (onDismiss) {
          onDismiss();
        }
      }}
      style={{ cursor: 'pointer' }}
      title="点击关闭"
    >
      <div className="status-bubble-content">
        {displayEmoji && (
          <span className="status-bubble-emoji">
            {displayEmoji}
          </span>
        )}
        {displayText && <span className="status-bubble-text">{displayText}</span>}
      </div>
    </div>
  );
}

// Re-export the hook for convenience
export { useStatusBubble } from './useStatusBubble';
