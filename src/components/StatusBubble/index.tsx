import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { StatusData } from './useStatusBubble';
export type { StatusData } from './useStatusBubble';
import './styles.css';

/**
 * Props for the StatusBubble component
 */
export interface StatusBubbleProps {
  /** Current status to display, null means no status */
  status: StatusData | null;
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
export function StatusBubble({ status, onDismiss }: StatusBubbleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHiding, setIsHiding] = useState(false);

  // 生成一个气泡实例ID用于追踪
  const bubbleId = useRef(`BUB_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`).current;

  // 直接从 props 计算要显示的内容
  const displayEmoji = status?.emoji || '';
  const displayText = status?.text || '';

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
        // 触发淡出动画后，通知父组件清除状态
        setTimeout(() => {
          if (onDismiss) {
            onDismiss();
          }
        }, 200); // Match animation duration in CSS
      }, duration);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [status]);

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
        {displayText && (
          <span className="status-bubble-text">
            {displayText.split('').map((char, index) => (
              <span
                key={`${bubbleId}-char-${index}`}
                className="status-bubble-char"
                style={{ animationDelay: `${index * 0.08}s` }}
              >
                {char === ' ' ? '\u00A0' : char}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

// Re-export the hook for convenience
export { useStatusBubble } from './useStatusBubble';
