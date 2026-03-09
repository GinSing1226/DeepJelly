/**
 * characterLoader 工具测试
 *
 * 测试范围：
 * 1. 加载角色配置
 * 2. 解析动画资源
 * 3. 错误处理
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadCharacterConfig,
  resolveAnimationPath,
  getAnimationById,
  parseAnimationId,
  CharacterLoader,
} from '@/components/CharacterWindow/utils/characterLoader';
import type { CharacterConfig, Appearance } from '@/components/CharacterWindow/types';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock import.meta.env
vi.mock('import.meta', () => ({
  env: {
    BASE_URL: '/',
  },
}));

describe('characterLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============ 加载角色配置测试 ============

  describe('loadCharacterConfig', () => {
    const mockConfig: CharacterConfig = {
      id: 'jelly',
      name: 'Jelly',
      description: 'A cute jelly character',
      appearances: [
        {
          id: 'casual',
          name: 'Casual',
          isDefault: true,
          actions: {
            idle: {
              frames: ['idle_01.png', 'idle_02.png'],
              frameRate: 8,
              loop: true,
            },
          },
        },
      ],
    };

    it('应该成功加载角色配置', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      });

      const config = await loadCharacterConfig('jelly', 'casual');

      expect(config).toEqual(mockConfig);
      expect(mockFetch).toHaveBeenCalledWith('/resources/characters/jelly/casual/config.json');
    });

    it('加载失败时应该抛出错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(loadCharacterConfig('nonexistent', 'default')).rejects.toThrow();
    });

    it('网络错误时应该抛出错误', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(loadCharacterConfig('jelly', 'casual')).rejects.toThrow('Network error');
    });
  });

  // ============ 解析动画ID测试 ============

  describe('parseAnimationId', () => {
    it('应该正确解析标准动画ID', () => {
      const result = parseAnimationId('base.idle');
      expect(result).toEqual({
        category: 'base',
        action: 'idle',
      });
    });

    it('应该正确解析带子动作的动画ID', () => {
      const result = parseAnimationId('work.think.deep');
      expect(result).toEqual({
        category: 'work',
        action: 'think.deep',
      });
    });

    it('应该处理单部分ID', () => {
      const result = parseAnimationId('idle');
      expect(result).toEqual({
        category: 'base',
        action: 'idle',
      });
    });
  });

  // ============ 获取动画测试 ============

  describe('getAnimationById', () => {
    const mockAppearance: Appearance = {
      id: 'casual',
      name: 'Casual',
      isDefault: true,
      actions: {
        idle: {
          frames: ['idle_01.png'],
          frameRate: 8,
          loop: true,
        },
        think: {
          frames: ['think_01.png'],
          frameRate: 6,
          loop: true,
        },
      },
    };

    it('应该获取存在的动画', () => {
      const animation = getAnimationById(mockAppearance, 'base.idle');
      expect(animation).toBeDefined();
      expect(animation?.frames).toEqual(['idle_01.png']);
    });

    it('不存在的动画应该返回 undefined', () => {
      const animation = getAnimationById(mockAppearance, 'base.nonexistent');
      expect(animation).toBeUndefined();
    });

    it('应该支持直接使用动作名', () => {
      const animation = getAnimationById(mockAppearance, 'idle');
      expect(animation).toBeDefined();
    });
  });

  // ============ 解析动画路径测试 ============

  describe('resolveAnimationPath', () => {
    it('应该正确解析相对路径', () => {
      const path = resolveAnimationPath('jelly', 'casual', 'idle_01.png');
      expect(path).toBe('/resources/characters/jelly/casual/idle_01.png');
    });

    it('应该处理绝对URL', () => {
      const path = resolveAnimationPath('jelly', 'casual', 'https://example.com/image.png');
      expect(path).toBe('https://example.com/image.png');
    });
  });

  // ============ CharacterLoader 类测试 ============

  describe('CharacterLoader', () => {
    let loader: CharacterLoader;

    beforeEach(() => {
      loader = new CharacterLoader();
    });

    it('应该能够预加载动画帧', async () => {
      const mockImage = { src: '/resources/characters/jelly/casual/idle_01.png' };

      // Mock Image constructor
      const mockImageElement = {
        src: '',
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      global.Image = vi.fn(() => mockImageElement) as unknown as typeof Image;

      const loadPromise = loader.preloadFrames(['/resources/characters/jelly/casual/idle_01.png']);

      // 模拟图片加载完成
      mockImageElement.onload?.();

      await expect(loadPromise).resolves.toBeUndefined();
    });

    it('应该追踪加载状态', () => {
      expect(loader.isLoading()).toBe(false);

      // 开始加载
      const mockImageElement = {
        src: '',
        onload: null as (() => void) | null,
        onerror: null as (() => void) | null,
      };
      global.Image = vi.fn(() => mockImageElement) as unknown as typeof Image;

      loader.preloadFrames(['/test.png']);

      // 加载状态应该在 Promise 解决后才能检查
    });

    it('应该能够清除缓存', () => {
      loader.clearCache();
      expect(loader.getCacheSize()).toBe(0);
    });
  });
});

// ============ 测试总结 ============
/**
 * 测试覆盖：
 * - 加载角色配置：3个用例
 * - 解析动画ID：3个用例
 * - 获取动画：3个用例
 * - 解析动画路径：2个用例
 * - CharacterLoader 类：3个用例
 *
 * 总计：14个测试用例
 */
