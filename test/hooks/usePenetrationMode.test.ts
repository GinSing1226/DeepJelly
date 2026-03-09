/**
 * usePenetrationMode Hook 测试
 *
 * 测试范围：
 * 1. 初始状态
 * 2. 状态更新
 * 3. 方法存在性
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock Tauri API
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    setIgnoreCursorEvents: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { usePenetrationMode } from '@/hooks/usePenetrationMode';

describe('usePenetrationMode Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============ 初始状态测试 ============

  describe('初始状态', () => {
    it('应该返回正确的初始状态', () => {
      const { result } = renderHook(() => usePenetrationMode());

      expect(result.current.isPenetrationMode).toBe(false);
      expect(result.current.ctrlPressed).toBe(false);
      expect(result.current.mouseInWindow).toBe(false);
    });
  });

  // ============ 方法测试 ============

  describe('方法', () => {
    it('应该提供 setPenetrationMode 方法', () => {
      const { result } = renderHook(() => usePenetrationMode());

      expect(typeof result.current.setPenetrationMode).toBe('function');
    });

    it('应该提供 restoreSolidMode 方法', () => {
      const { result } = renderHook(() => usePenetrationMode());

      expect(typeof result.current.restoreSolidMode).toBe('function');
    });

    it('setPenetrationMode(true) 应该启用穿透模式', async () => {
      const { result } = renderHook(() => usePenetrationMode());

      await act(async () => {
        result.current.setPenetrationMode(true);
      });

      await waitFor(() => {
        expect(result.current.isPenetrationMode).toBe(true);
      });
    });

    it('restoreSolidMode 应该恢复实体模式', async () => {
      const { result } = renderHook(() => usePenetrationMode());

      // 先启用穿透模式
      await act(async () => {
        result.current.setPenetrationMode(true);
      });

      await waitFor(() => {
        expect(result.current.isPenetrationMode).toBe(true);
      });

      // 恢复实体模式
      await act(async () => {
        result.current.restoreSolidMode();
      });

      await waitFor(() => {
        expect(result.current.isPenetrationMode).toBe(false);
      });
    });
  });

  // ============ 键盘事件测试 ============

  describe('键盘事件', () => {
    it('按下 Ctrl 键应该设置 ctrlPressed 为 true', async () => {
      const { result } = renderHook(() => usePenetrationMode());

      // 模拟按下 Ctrl 键
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }));
      });

      await waitFor(() => {
        expect(result.current.ctrlPressed).toBe(true);
      });
    });

    it('释放 Ctrl 键应该设置 ctrlPressed 为 false', async () => {
      const { result } = renderHook(() => usePenetrationMode());

      // 按下 Ctrl
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true }));
      });

      await waitFor(() => {
        expect(result.current.ctrlPressed).toBe(true);
      });

      // 释放 Ctrl
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control', ctrlKey: false }));
      });

      await waitFor(() => {
        expect(result.current.ctrlPressed).toBe(false);
      });
    });
  });

  // ============ 鼠标事件测试 ============

  describe('鼠标事件', () => {
    it('鼠标离开窗口应该设置 mouseInWindow 为 false', async () => {
      const { result } = renderHook(() => usePenetrationMode());

      act(() => {
        document.dispatchEvent(new MouseEvent('mouseleave'));
      });

      await waitFor(() => {
        expect(result.current.mouseInWindow).toBe(false);
      });
    });

    it('鼠标进入窗口应该设置 mouseInWindow 为 true', async () => {
      const { result } = renderHook(() => usePenetrationMode());

      // 初始状态为 false
      expect(result.current.mouseInWindow).toBe(false);

      // 调用 handleMouseEnter 模拟鼠标进入
      act(() => {
        result.current.handleMouseEnter();
      });

      // 应该设置为 true
      expect(result.current.mouseInWindow).toBe(true);
    });
  });
});

// ============ 测试总结 ============
/**
 * 测试覆盖：
 * - 初始状态：1个用例
 * - 方法：4个用例
 * - 键盘事件：2个用例
 * - 鼠标事件：2个用例
 *
 * 总计：9个测试用例
 */
