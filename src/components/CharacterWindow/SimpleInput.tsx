/**
 * SimpleInput 组件
 *
 * Meta-Name: Simple Input Component
 * Meta-Description: 角色视窗底部的简易输入框，支持多行输入和自动高度调整
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { SimpleInputProps } from './types';
import './SimpleInput.css';

/** 默认最大高度（像素） */
const DEFAULT_MAX_HEIGHT = 80;

/** 单行高度（像素） */
const SINGLE_LINE_HEIGHT = 24;

export function SimpleInput({
  visible,
  onSend,
  placeholder,
  maxRows = 3,
  maxHeight = DEFAULT_MAX_HEIGHT,
  disabled = false,
  onHasContentChange,
  isWaitingForResponse = false,
}: SimpleInputProps) {
  const { t } = useTranslation('common');
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 通知父组件输入框是否有内容
  useEffect(() => {
    onHasContentChange?.(value.trim().length > 0);
  }, [value, onHasContentChange]);

  // 计算实际最大高度
  const calculatedMaxHeight = Math.min(maxHeight, SINGLE_LINE_HEIGHT * maxRows);

  // 自动调整高度
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // 重置高度以获取正确的 scrollHeight
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, calculatedMaxHeight);
    textarea.style.height = `${newHeight}px`;

    // 设置 overflow
    textarea.style.overflowY = textarea.scrollHeight > calculatedMaxHeight ? 'auto' : 'hidden';
  }, [calculatedMaxHeight]);

  // 监听内容变化调整高度
  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // 处理输入变化
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
  }, []);

  // 处理键盘事件
  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter 发送，Shift+Enter 换行
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();

        const trimmedValue = value.trim();
        if (trimmedValue && !isWaitingForResponse && !disabled) {
          try {
            await onSend(trimmedValue);
            setValue('');
          } catch (error) {
            console.error('[SimpleInput] Send failed:', error);
          }
        }
      }
    },
    [value, isWaitingForResponse, disabled, onSend]
  );

  // 处理发送按钮点击
  const handleSendClick = useCallback(async () => {
    const trimmedValue = value.trim();
    if (trimmedValue && !isWaitingForResponse && !disabled) {
      try {
        await onSend(trimmedValue);
        setValue('');
      } catch (error) {
        console.error('[SimpleInput] Send failed:', error);
      }
    }
  }, [value, isWaitingForResponse, disabled, onSend]);

  // 计算是否可发送
  const canSend = value.trim().length > 0 && !isWaitingForResponse && !disabled;

  // 使用传入的 placeholder 或 i18n
  const displayPlaceholder = placeholder || t('inputPlaceholder') || '输入消息...';

  if (!visible) {
    return null;
  }

  return (
    <div
      className={`simple-input fade-in ${isWaitingForResponse ? 'waiting' : ''}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* 等待回复时的蒙层和提示 */}
      {isWaitingForResponse && (
        <div className="simple-input-overlay">
          <div className="simple-input-overlay-text">{t('waitingForResponse')}</div>
        </div>
      )}

      <textarea
        ref={textareaRef}
        className="simple-input-field"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={displayPlaceholder}
        disabled={disabled || isWaitingForResponse}
        style={{ maxHeight: calculatedMaxHeight }}
        rows={1}
      />
      <button
        className={`simple-input-send ${isWaitingForResponse ? 'loading' : ''}`}
        onClick={handleSendClick}
        disabled={!canSend}
        title={t('send') || '发送'}
        type="button"
      >
        {isWaitingForResponse ? (
          <span className="loading-spinner" />
        ) : (
          <span>{t('send') || '发送'}</span>
        )}
      </button>
    </div>
  );
}
