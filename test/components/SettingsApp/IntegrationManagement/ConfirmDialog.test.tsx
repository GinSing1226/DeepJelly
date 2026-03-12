/**
 * ConfirmDialog 组件测试
 *
 * 测试删除确认对话框的渲染和交互
 *
 * @module test/components/SettingsApp/IntegrationManagement/ConfirmDialog.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConfirmDialog } from '@/components/SettingsApp/IntegrationManagement/ConfirmDialog';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// ============ Tests ============

describe('ConfirmDialog 组件测试', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TC-CONFIRM-001: 对话框显示', () => {
    it('isOpen=false时不渲染', () => {
      const { container } = render(
        <ConfirmDialog
          isOpen={false}
          title="Test Title"
          message="Test message"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(container.querySelector('.confirm-dialog-overlay')).not.toBeInTheDocument();
    });

    it('isOpen=true时应渲染', () => {
      const { container } = render(
        <ConfirmDialog
          isOpen={true}
          title="Test Title"
          message="Test message"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(container.querySelector('.confirm-dialog-overlay')).toBeInTheDocument();
    });

    it('应显示标题', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          title="Delete Item?"
          message="Are you sure?"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Delete Item?')).toBeInTheDocument();
    });

    it('应显示消息', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          title="Delete Item?"
          message="Are you sure you want to delete?"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Are you sure you want to delete?')).toBeInTheDocument();
    });

    it('应显示警告消息（如果有）', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          title="Delete Item?"
          message="Are you sure?"
          warning="This action cannot be undone!"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('This action cannot be undone!')).toBeInTheDocument();
    });

    it('应显示确认和取消按钮', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('button', { name: /common.cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /common.confirm/i })).toBeInTheDocument();
    });
  });

  describe('TC-CONFIRM-002: 用户交互', () => {
    it('点击确认按钮应调用onConfirm', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByRole('button', { name: /common.confirm/i });
      fireEvent.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalled();
    });

    it('点击取消按钮应调用onCancel', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /common.cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('点击关闭按钮应调用onCancel', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const closeButton = screen.getByText('×');
      fireEvent.click(closeButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('点击遮罩应调用onCancel', () => {
      const { container } = render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const overlay = container.querySelector('.confirm-dialog-overlay');
      if (overlay) {
        fireEvent.click(overlay);
        expect(mockOnCancel).toHaveBeenCalled();
      }
    });

    it('点击对话框内部不应关闭', () => {
      const { container } = render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const dialog = container.querySelector('.confirm-dialog');
      if (dialog) {
        fireEvent.click(dialog);
        expect(mockOnCancel).not.toHaveBeenCalled();
      }
    });
  });

  describe('TC-CONFIRM-003: 自定义按钮文本', () => {
    it('应使用自定义确认文本', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          confirmText="Delete Now"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('button', { name: 'Delete Now' })).toBeInTheDocument();
    });

    it('应使用自定义取消文本', () => {
      render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          cancelText="Keep It"
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('button', { name: 'Keep It' })).toBeInTheDocument();
    });
  });

  describe('TC-CONFIRM-004: 危险模式样式', () => {
    it('isDanger=true时确认按钮应有danger类', () => {
      const { container } = render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          isDanger={true}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByRole('button', { name: /common.confirm/i });
      expect(confirmButton).toHaveClass('danger');
    });

    it('isDanger=false时确认按钮应有primary类', () => {
      const { container } = render(
        <ConfirmDialog
          isOpen={true}
          title="Test"
          message="Test"
          isDanger={false}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByRole('button', { name: /common.confirm/i });
      expect(confirmButton).toHaveClass('primary');
    });
  });
});
