/**
 * CharacterWindow 类型定义测试
 *
 * 测试范围：
 * 1. 类型完整性验证
 * 2. 类型守卫函数
 * 3. 默认值和工厂函数
 */

import { describe, it, expect } from 'vitest';

// ============ 导入待测试的类型 ============

import type {
  // 角色配置相关
  CharacterConfig,
  Appearance,
  ActionAnimation,
  AnimationFrame,

  // 视窗相关
  CharacterWindowProps,
  WindowPosition,
  WindowMode,

  // 输入框相关
  SimpleInputProps,
  InputState,

  // 触碰相关
  TouchZoneConfig,
  RelativeBoundingBox,

  // 动画相关
  AnimationCommand,
  AnimationPriority,
  AnimationQueueItem,

  // 穿透模式相关
  PenetrationState,

  // 资源加载相关
  ResourceLoadState,
  ResourceLoadResult,
} from '@/components/CharacterWindow/types';

import {
  // 工厂函数
  createDefaultWindowPosition,
  createDefaultAnimationCommand,
  createDefaultPenetrationState,
  createDefaultResourceLoadState,

  // 类型守卫
  isHighPriority,
  isAnimationCommand,
  isValidScale,

  // 常量
  ANIMATION_PRIORITIES,
  DEFAULT_WINDOW_SIZE,
  SCALE_RANGE,
} from '@/components/CharacterWindow/types';

// ============ 测试用例 ============

describe('CharacterWindow 类型定义', () => {
  describe('工厂函数', () => {
    it('createDefaultWindowPosition 应该返回正确的默认位置', () => {
      const position = createDefaultWindowPosition();
      expect(position).toEqual({ x: 100, y: 100 });
    });

    it('createDefaultAnimationCommand 应该返回正确的默认命令', () => {
      const command = createDefaultAnimationCommand();
      expect(command).toEqual({
        domain: 'internal',
        category: 'base',
        actionId: 'idle',
        urgency: 'normal',
        intensity: 0.5,
        duration: null,
      });
    });

    it('createDefaultPenetrationState 应该返回正确的默认状态', () => {
      const state = createDefaultPenetrationState();
      expect(state).toEqual({
        isActive: false,
        ctrlPressed: false,
        mouseInWindow: true,
      });
    });

    it('createDefaultResourceLoadState 应该返回正确的默认状态', () => {
      const state = createDefaultResourceLoadState();
      expect(state).toEqual({
        isLoading: false,
        isLoaded: false,
        error: null,
        loadedAnimations: [],
      });
    });
  });

  describe('类型守卫', () => {
    describe('isHighPriority', () => {
      it('应该正确识别高优先级', () => {
        expect(isHighPriority('high')).toBe(true);
        expect(isHighPriority('normal')).toBe(false);
        expect(isHighPriority('low')).toBe(false);
      });
    });

    describe('isAnimationCommand', () => {
      it('应该正确识别有效的动画命令', () => {
        expect(
          isAnimationCommand({
            domain: 'internal',
            category: 'base',
            actionId: 'idle',
            urgency: 'normal',
            intensity: 0.5,
          })
        ).toBe(true);
      });

      it('应该拒绝无效的动画命令', () => {
        expect(isAnimationCommand(null)).toBe(false);
        expect(isAnimationCommand(undefined)).toBe(false);
        expect(isAnimationCommand({})).toBe(false);
        expect(isAnimationCommand({ domain: 'internal' })).toBe(false);
      });
    });

    describe('isValidScale', () => {
      it('应该正确验证缩放值', () => {
        expect(isValidScale(0.5)).toBe(true);
        expect(isValidScale(1.0)).toBe(true);
        expect(isValidScale(2.0)).toBe(true);
        expect(isValidScale(0.3)).toBe(false); // 太小
        expect(isValidScale(2.5)).toBe(false); // 太大
        expect(isValidScale(-1)).toBe(false); // 负数
      });
    });
  });

  describe('常量', () => {
    it('ANIMATION_PRIORITIES 应该包含三个级别', () => {
      expect(ANIMATION_PRIORITIES.HIGH).toBe('high');
      expect(ANIMATION_PRIORITIES.NORMAL).toBe('normal');
      expect(ANIMATION_PRIORITIES.LOW).toBe('low');
    });

    it('DEFAULT_WINDOW_SIZE 应该是 500', () => {
      expect(DEFAULT_WINDOW_SIZE).toBe(500);
    });

    it('SCALE_RANGE 应该是 0.5 到 2.0', () => {
      expect(SCALE_RANGE.min).toBe(0.5);
      expect(SCALE_RANGE.max).toBe(2.0);
    });
  });

  describe('类型兼容性（编译时验证）', () => {
    it('CharacterConfig 应该兼容角色配置结构', () => {
      const config: CharacterConfig = {
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
                frames: ['idle_01.png'],
                frameRate: 8,
                loop: true,
              },
            },
          },
        ],
      };
      expect(config.id).toBe('jelly');
    });

    it('AnimationCommand 应该支持所有参数', () => {
      const command: AnimationCommand = {
        animationId: 'work.think',
        urgency: 'high',
        intensity: 0.8,
        duration: 2000,
      };
      expect(command.animationId).toBe('work.think');
    });

    it('SimpleInputProps 应该包含必要的属性', () => {
      const props: SimpleInputProps = {
        visible: true,
        onSend: async () => {},
        onOpenDialog: () => {},
        placeholder: '输入消息...',
        maxRows: 3,
      };
      expect(props.visible).toBe(true);
    });

    it('PenetrationState 应该包含所有状态字段', () => {
      const state: PenetrationState = {
        isActive: true,
        ctrlPressed: true,
        mouseInWindow: false,
      };
      expect(state.isActive).toBe(true);
    });
  });
});

// ============ 测试总结 ============
/**
 * 测试覆盖：
 * - 工厂函数：4个用例
 * - 类型守卫：6个用例
 * - 常量验证：3个用例
 * - 类型兼容性：4个用例
 *
 * 总计：17个测试用例
 */
