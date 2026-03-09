/**
 * SimpleInput 组件测试
 *
 * 测试范围：
 * 1. 基础渲染
 * 2. 多行支持
 * 3. 交互行为
 * 4. 显示/隐藏动画
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'common.inputPlaceholder': '输入消息...',
        'common.send': '发送',
        'common.openDialog': '对话框',
      };
      return translations[key] || key;
    },
    i18n: {
      language: 'zh',
    },
  }),
}));

import { SimpleInput } from '@/components/CharacterWindow/SimpleInput';
import type { SimpleInputProps } from '@/components/CharacterWindow/types';

describe('SimpleInput 组件', () => {
  const defaultProps: SimpleInputProps = {
    visible: true,
    onSend: vi.fn(),
    onOpenDialog: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============ 基础渲染测试 ============

  describe('基础渲染', () => {
    it('应该渲染 textarea 元素', () => {
      render(<SimpleInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName.toLowerCase()).toBe('textarea');
    });

    it('placeholder 应该显示正确的文本', () => {
      render(<SimpleInput {...defaultProps} placeholder="输入消息..." />);

      const textarea = screen.getByPlaceholderText('输入消息...');
      expect(textarea).toBeInTheDocument();
    });

    it('visible=false 时应该不渲染', () => {
      render(<SimpleInput {...defaultProps} visible={false} />);

      const textarea = screen.queryByRole('textbox');
      expect(textarea).not.toBeInTheDocument();
    });

    it('disabled=true 时应该禁用输入框', () => {
      render(<SimpleInput {...defaultProps} disabled={true} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();
    });
  });

  // ============ 多行支持测试 ============

  describe('多行支持', () => {
    it('应该应用 maxHeight 样式（考虑 maxRows 限制）', () => {
      // 默认 maxRows=3, 单行高度=24, 所以实际 maxHeight = min(80, 72) = 72
      render(<SimpleInput {...defaultProps} maxHeight={80} />);

      const textarea = screen.getByRole('textbox');
      // maxHeight 会被 min(maxHeight, SINGLE_LINE_HEIGHT * maxRows) 计算
      expect(textarea).toHaveStyle({ maxHeight: '72px' });
    });

    it('应该能够应用更大的 maxHeight（当 maxRows 允许时）', () => {
      // 设置更大的 maxRows
      render(<SimpleInput {...defaultProps} maxHeight={100} maxRows={5} />);

      const textarea = screen.getByRole('textbox');
      // 24 * 5 = 120, 但 maxHeight=100, 所以结果是 100
      expect(textarea).toHaveStyle({ maxHeight: '100px' });
    });

    it('应该能够输入换行符', async () => {
      const user = userEvent.setup();
      render(<SimpleInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // 使用 fireEvent 直接设置值来模拟多行输入
      fireEvent.change(textarea, { target: { value: '第一行\n第二行' } });

      expect(textarea.value).toBe('第一行\n第二行');
    });
  });

  // ============ 交互行为测试 ============

  describe('交互行为', () => {
    it('点击发送按钮应该调用 onSend', async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      render(<SimpleInput {...defaultProps} onSend={onSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '测试消息');

      const sendButton = screen.getByRole('button', { name: /发送/i });
      await user.click(sendButton);

      expect(onSend).toHaveBeenCalledWith('测试消息');
    });

    it('按 Enter 键应该发送（不按 Shift）', async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      render(<SimpleInput {...defaultProps} onSend={onSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '测试消息');
      await user.type(textarea, '{enter}');

      expect(onSend).toHaveBeenCalledWith('测试消息');
    });

    it('按 Shift+Enter 应该换行而不发送', async () => {
      const onSend = vi.fn();
      render(<SimpleInput {...defaultProps} onSend={onSend} />);

      const textarea = screen.getByRole('textbox');

      // 使用 fireEvent 模拟 Shift+Enter
      fireEvent.change(textarea, { target: { value: '第一行' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

      expect(onSend).not.toHaveBeenCalled();
    });

    it('空内容时发送按钮应该禁用', () => {
      render(<SimpleInput {...defaultProps} />);

      const sendButton = screen.getByRole('button', { name: /发送/i });
      expect(sendButton).toBeDisabled();
    });

    it('只有空白字符时发送按钮应该禁用', async () => {
      const user = userEvent.setup();
      render(<SimpleInput {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '   ');

      const sendButton = screen.getByRole('button', { name: /发送/i });
      expect(sendButton).toBeDisabled();
    });

    it('发送后应该清空输入框', async () => {
      const user = userEvent.setup();
      const onSend = vi.fn();
      render(<SimpleInput {...defaultProps} onSend={onSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '测试消息');
      await user.type(textarea, '{enter}');

      expect(textarea).toHaveValue('');
    });

    it('点击对话框按钮应该调用 onOpenDialog', async () => {
      const user = userEvent.setup();
      const onOpenDialog = vi.fn();
      render(<SimpleInput {...defaultProps} onOpenDialog={onOpenDialog} />);

      const dialogButton = screen.getByRole('button', { name: /对话框|dialog/i });
      await user.click(dialogButton);

      expect(onOpenDialog).toHaveBeenCalled();
    });
  });

  // ============ 显示/隐藏动画测试 ============

  describe('显示/隐藏动画', () => {
    it('visible=true 时应该有 fade-in 类', () => {
      const { container } = render(<SimpleInput {...defaultProps} visible={true} />);

      const wrapper = container.querySelector('.simple-input');
      expect(wrapper).toHaveClass('fade-in');
    });

    it('visible=false 时应该不渲染', () => {
      const { container } = render(<SimpleInput {...defaultProps} visible={false} />);

      const wrapper = container.querySelector('.simple-input');
      expect(wrapper).toBeNull();
    });
  });

  // ============ 异步发送测试 ============

  describe('异步发送', () => {
    it('发送中应该禁用按钮，发送完成后输入框应该清空', async () => {
      const user = userEvent.setup();
      let resolveSend: () => void;
      const onSend = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveSend = resolve;
          })
      );

      render(<SimpleInput {...defaultProps} onSend={onSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '测试消息');

      const sendButton = screen.getByRole('button', { name: /发送/i });
      await user.click(sendButton);

      // 发送中，按钮应该禁用
      expect(sendButton).toBeDisabled();

      // 完成发送
      await act(async () => {
        resolveSend!();
      });

      // 发送完成后，输入框应该被清空，按钮仍然禁用（因为内容为空）
      await waitFor(() => {
        expect(textarea).toHaveValue('');
        // 因为内容被清空，按钮应该仍然禁用
        expect(sendButton).toBeDisabled();
      });

      // onSend 应该被调用
      expect(onSend).toHaveBeenCalledWith('测试消息');
    });

    it('发送中 textarea 应该禁用', async () => {
      const user = userEvent.setup();
      let resolveSend: () => void;
      const onSend = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveSend = resolve;
          })
      );

      render(<SimpleInput {...defaultProps} onSend={onSend} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, '测试消息');

      const sendButton = screen.getByRole('button', { name: /发送/i });
      await user.click(sendButton);

      // 发送中，textarea 应该禁用
      expect(textarea).toBeDisabled();

      // 完成发送
      await act(async () => {
        resolveSend!();
      });

      // 发送完成后，textarea 应该恢复
      await waitFor(() => {
        expect(textarea).not.toBeDisabled();
      });
    });
  });
});

// ============ 测试总结 ============
/**
 * 测试覆盖：
 * - 基础渲染：4个用例
 * - 多行支持：2个用例
 * - 交互行为：7个用例
 * - 显示/隐藏动画：2个用例
 * - 异步发送：1个用例
 *
 * 总计：16个测试用例
 */
