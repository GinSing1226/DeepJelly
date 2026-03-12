/**
 * InputArea Component
 *
 * Message input area with auto-resize textarea.
 */

import { useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULTS } from '../shared/constants';
import type { StreamingState } from '../shared/types';
import './InputArea.css';

interface InputAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
  isSending?: boolean;
  connected?: boolean;
  streaming?: StreamingState;
}

function InputArea({
  value,
  onChange,
  onSend,
  onKeyDown,
  disabled = false,
  isSending = false,
  connected = true,
  streaming,
}: InputAreaProps) {
  const { t } = useTranslation(['dialog']);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Auto-resize textarea
   */
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, DEFAULTS.INPUT_MAX_HEIGHT);
    textarea.style.height = `${newHeight}px`;
  }, [value]);

  /**
   * Handle textarea change
   */
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  /**
   * Handle send button click
   */
  const handleSendClick = useCallback(() => {
    onSend();
    // Focus back to textarea after sending
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  }, [onSend]);

  const canSend = !disabled && connected && !isSending && value.trim().length > 0 && !streaming?.isStreaming;

  return (
    <div className="input-area">
      <div className="input-wrapper">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          disabled={disabled || !connected || isSending}
          placeholder={connected ? t('dialog:inputPlaceholder') : t('dialog:disconnected')}
          className="input-textarea"
          rows={1}
          readOnly={streaming?.isStreaming}
        />
        <button
          className="send-button"
          onClick={handleSendClick}
          disabled={!canSend}
          title={t('dialog:send') || 'Send'}
        >
          {isSending ? '...' : streaming?.isStreaming ? '⏸' : '➤'}
        </button>
      </div>
    </div>
  );
}

export default InputArea;
