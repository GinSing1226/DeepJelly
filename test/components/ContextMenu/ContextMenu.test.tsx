/**
 * ContextMenu 扩展功能测试
 *
 * 测试范围：
 * 1. 子菜单支持
 * 2. 分隔线
 * 3. 禁用状态
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ContextMenu } from '@/components/ContextMenu';
import type { ContextMenuItem } from '@/components/ContextMenu';

describe('ContextMenu 扩展功能', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============ 基础渲染测试 ============

  describe('基础渲染', () => {
    it('应该渲染所有菜单项', () => {
      const items: ContextMenuItem[] = [
        { id: 'item1', label: '选项1', onClick: vi.fn() },
        { id: 'item2', label: '选项2', onClick: vi.fn() },
      ];

      render(
        <ContextMenu
          isOpen={true}
          position={{ x: 100, y: 100 }}
          onClose={mockOnClose}
          items={items}
        />
      );

      expect(screen.getByText('选项1')).toBeInTheDocument();
      expect(screen.getByText('选项2')).toBeInTheDocument();
    });

    it('点击菜单项应该触发 onClick', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const items: ContextMenuItem[] = [
        { id: 'item1', label: '选项1', onClick },
      ];

      render(
        <ContextMenu
          isOpen={true}
          position={{ x: 100, y: 100 }}
          onClose={mockOnClose}
          items={items}
        />
      );

      await user.click(screen.getByText('选项1'));

      expect(onClick).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  // ============ 分隔线测试 ============

  describe('分隔线', () => {
    it('应该渲染分隔线', () => {
      const items: ContextMenuItem[] = [
        { id: 'item1', label: '选项1', onClick: vi.fn() },
        { id: 'divider1', label: '---', onClick: vi.fn(), isDivider: true },
        { id: 'item2', label: '选项2', onClick: vi.fn() },
      ];

      const { container } = render(
        <ContextMenu
          isOpen={true}
          position={{ x: 100, y: 100 }}
          onClose={mockOnClose}
          items={items}
        />
      );

      const divider = container.querySelector('.context-menu-divider');
      expect(divider).toBeInTheDocument();
    });

    it('分隔线不应该可点击', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const items: ContextMenuItem[] = [
        { id: 'item1', label: '选项1', onClick: vi.fn() },
        { id: 'divider1', label: '---', onClick, isDivider: true },
        { id: 'item2', label: '选项2', onClick: vi.fn() },
      ];

      render(
        <ContextMenu
          isOpen={true}
          position={{ x: 100, y: 100 }}
          onClose={mockOnClose}
          items={items}
        />
      );

      const { container } = render(
        <ContextMenu
          isOpen={true}
          position={{ x: 100, y: 100 }}
          onClose={mockOnClose}
          items={items}
        />
      );

      const divider = container.querySelector('.context-menu-divider');
      if (divider) {
        await user.click(divider);
      }

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  // ============ 禁用状态测试 ============

  describe('禁用状态', () => {
    it('禁用的菜单项应该有 disabled 类', () => {
      const items: ContextMenuItem[] = [
        { id: 'item1', label: '禁用项', onClick: vi.fn(), disabled: true },
      ];

      const { container } = render(
        <ContextMenu
          isOpen={true}
          position={{ x: 100, y: 100 }}
          onClose={mockOnClose}
          items={items}
        />
      );

      const item = container.querySelector('.context-menu-item');
      expect(item).toHaveClass('disabled');
    });

    it('禁用的菜单项不应该触发 onClick', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const items: ContextMenuItem[] = [
        { id: 'item1', label: '禁用项', onClick, disabled: true },
      ];

      render(
        <ContextMenu
          isOpen={true}
          position={{ x: 100, y: 100 }}
          onClose={mockOnClose}
          items={items}
        />
      );

      await user.click(screen.getByText('禁用项'));

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  // ============ 子菜单测试 ============

  describe('子菜单', () => {
    it('应该渲染子菜单触发器', () => {
      const items: ContextMenuItem[] = [
        {
          id: 'submenu1',
          label: '缩放',
          onClick: vi.fn(),
          submenu: [
            { id: '50', label: '50%', onClick: vi.fn() },
            { id: '100', label: '100%', onClick: vi.fn() },
          ],
        },
      ];

      const { container } = render(
        <ContextMenu
          isOpen={true}
          position={{ x: 100, y: 100 }}
          onClose={mockOnClose}
          items={items}
        />
      );

      const submenuTrigger = container.querySelector('.context-menu-item.has-submenu');
      expect(submenuTrigger).toBeInTheDocument();
    });

    it('悬停子菜单触发器应该显示子菜单', async () => {
      const user = userEvent.setup();
      const submenuOnClick = vi.fn();
      const items: ContextMenuItem[] = [
        {
          id: 'submenu1',
          label: '缩放',
          onClick: vi.fn(),
          submenu: [
            { id: '50', label: '50%', onClick: submenuOnClick },
            { id: '100', label: '100%', onClick: vi.fn() },
          ],
        },
      ];

      render(
        <ContextMenu
          isOpen={true}
          position={{ x: 100, y: 100 }}
          onClose={mockOnClose}
          items={items}
        />
      );

      // 悬停触发子菜单
      const trigger = screen.getByText('缩放');
      await user.hover(trigger);

      // 子菜单应该出现
      await waitFor(() => {
        expect(screen.getByText('50%')).toBeInTheDocument();
      });
    });

    it('点击子菜单项应该触发 onClick', async () => {
      const user = userEvent.setup();
      const submenuOnClick = vi.fn();
      const items: ContextMenuItem[] = [
        {
          id: 'submenu1',
          label: '缩放',
          onClick: vi.fn(),
          submenu: [
            { id: '50', label: '50%', onClick: submenuOnClick },
            { id: '100', label: '100%', onClick: vi.fn() },
          ],
        },
      ];

      render(
        <ContextMenu
          isOpen={true}
          position={{ x: 100, y: 100 }}
          onClose={mockOnClose}
          items={items}
        />
      );

      // 悬停触发子菜单
      const trigger = screen.getByText('缩放');
      await user.hover(trigger);

      // 点击子菜单项
      await waitFor(async () => {
        const item50 = screen.getByText('50%');
        await user.click(item50);
      });

      expect(submenuOnClick).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  // ============ 快捷键提示测试 ============

  describe('快捷键提示', () => {
    it('应该显示快捷键提示', () => {
      const items: ContextMenuItem[] = [
        {
          id: 'item1',
          label: '复制',
          onClick: vi.fn(),
          shortcut: 'Ctrl+C',
        },
      ];

      render(
        <ContextMenu
          isOpen={true}
          position={{ x: 100, y: 100 }}
          onClose={mockOnClose}
          items={items}
        />
      );

      expect(screen.getByText('Ctrl+C')).toBeInTheDocument();
    });
  });
});

// ============ 测试总结 ============
/**
 * 测试覆盖：
 * - 基础渲染：2个用例
 * - 分隔线：2个用例
 * - 禁用状态：2个用例
 * - 子菜单：3个用例
 * - 快捷键提示：1个用例
 *
 * 总计：10个测试用例
 */
