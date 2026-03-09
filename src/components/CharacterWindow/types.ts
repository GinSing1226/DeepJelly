/**
 * CharacterWindow 类型定义
 *
 * Meta-Name: Character Window Type Definitions
 * Meta-Description: 角色视窗组件的所有类型定义、类型守卫和工厂函数
 */

// ============ 常量定义 ============

/** 默认窗口尺寸（像素） */
export const DEFAULT_WINDOW_SIZE = 500;

/** 动画优先级常量 */
export const ANIMATION_PRIORITIES = {
  HIGH: 'high',
  NORMAL: 'normal',
  LOW: 'low',
} as const;

/** 缩放范围（别名，保持向后兼容） */
export const SCALE_RANGE = {
  min: 0.5,
  max: 2.0,
} as const;

/** @deprecated 使用 SCALE_RANGE 代替 */
export const SCALE_LIMITS = SCALE_RANGE;

// ============ 基础类型 ============

/** 动画优先级 */
export type AnimationPriority = (typeof ANIMATION_PRIORITIES)[keyof typeof ANIMATION_PRIORITIES];

/** 窗口位置 */
export interface WindowPosition {
  x: number;
  y: number;
}

/** 窗口模式 */
export type WindowMode = 'solid' | 'penetration';

/** 相对边界框（使用 0-1 的相对坐标） */
export interface RelativeBoundingBox {
  /** 左上角 X（相对坐标 0-1） */
  x: number;
  /** 左上角 Y（相对坐标 0-1） */
  y: number;
  /** 宽度（相对值 0-1） */
  width: number;
  /** 高度（相对值 0-1） */
  height: number;
}

// ============ 角色配置相关类型 ============

/** 动画帧配置 */
export interface AnimationFrame {
  /** 帧图片URL */
  url: string;
  /** 帧持续时间（毫秒） */
  duration?: number;
}

/** 动画资源配置（完整格式） */
export interface AnimationResource {
  /** 资源类型 */
  type: 'frames' | 'gif';
  /** 资源文件路径数组 */
  resources: string[];
  /** 帧率 (fps) */
  fps?: number;
  /** 是否循环 */
  loop?: boolean;
}

/** 动作动画配置（简化格式，向后兼容） */
export interface ActionAnimation {
  /** 帧列表 */
  frames: string[];
  /** 帧率 */
  frameRate: number;
  /** 是否循环 */
  loop: boolean;
  /** 资源类型（可选，用于完整格式） */
  type?: 'frames' | 'gif';
  /** 资源（可选，用于完整格式） */
  resources?: string[];
  /** fps（可选，用于完整格式） */
  fps?: number;
}

/** 角色外观配置 */
export interface Appearance {
  /** 外观ID */
  id: string;
  /** 外观名称 */
  name: string;
  /** 是否为默认外观 */
  isDefault: boolean;
  /** 动作映射 */
  actions: Record<string, ActionAnimation | AnimationResource>;
}

/** 角色完整配置 */
export interface CharacterConfig {
  /** 角色ID */
  id: string;
  /** 角色名称 */
  name: string;
  /** 角色描述 */
  description?: string;
  /** 助手ID (用于资源路径) */
  assistant_id?: string;
  /** 外观列表 */
  appearances: Appearance[];
}

// ============ 动画命令相关类型 ============

/** 动画域 */
export type AnimationDomain = 'internal' | 'social';

/** 动画分类 */
export type AnimationCategory = 'base' | 'work' | 'result' | 'emotion' | 'physics' | 'greeting';

/** 动画动作ID */
export type AnimationActionId = 'idle' | 'floating' | 'listen' | 'think' | 'execute' | 'speak' | 'success' | 'error' | 'happy' | 'sad' | 'sleepy' | 'walk' | 'drag' | 'wave';

/**
 * 生成动作目录名
 * @param domain 域
 * @param category 分类
 * @param actionId 动作ID
 * @returns 格式为 `{domain}-{category}-{actionId}` 的目录名
 */
export function buildActionDir(domain: AnimationDomain, category: AnimationCategory, actionId: AnimationActionId): string {
  return `${domain}-${category}-${actionId}`;
}

/** 动画指令 */
export interface AnimationCommand {
  /** 动画域 */
  domain: AnimationDomain;
  /** 动画分类 */
  category: AnimationCategory;
  /** 动作ID */
  actionId: AnimationActionId;
  /** 紧急程度/优先级 */
  urgency: AnimationPriority;
  /** 动画强度 (0.0-1.0) */
  intensity?: number;
  /** 持续时间（毫秒），null 表示循环播放 */
  duration?: number | null;
}

/** 动画队列项 */
export interface AnimationQueueItem extends AnimationCommand {
  /** 队列项ID */
  id: string;
  /** 添加时间 */
  addedAt: number;
  /** 优先级数值（用于排序，越高越优先） */
  priority: number;
}

// ============ 触碰区域相关类型 ============

/** 触碰区域配置（使用相对坐标） */
export interface TouchZoneConfig {
  /** 区域名称 */
  name: string;
  /** 相对边界框 */
  boundingBox: RelativeBoundingBox;
  /** 触发动画ID */
  animation: string;
  /** 响应文本（心理气泡） */
  responseText: string;
}

// ============ 简易输入框相关类型 ============

/** 简易输入框属性 */
export interface SimpleInputProps {
  /** 是否可见 */
  visible: boolean;
  /** 发送消息回调 */
  onSend: (content: string) => Promise<void> | void;
  /** 占位符文本 */
  placeholder?: string;
  /** 最大行数 */
  maxRows?: number;
  /** 最大高度（像素） */
  maxHeight?: number;
  /** 是否禁用 */
  disabled?: boolean;
  /** 输入内容变化回调（用于判断是否隐藏输入框） */
  onHasContentChange?: (hasContent: boolean) => void;
  /** 是否正在等待AI回复 */
  isWaitingForResponse?: boolean;
}

/** 输入框状态 */
export interface InputState {
  /** 当前值 */
  value: string;
  /** 是否聚焦 */
  isFocused: boolean;
  /** 当前高度 */
  height: number;
  /** 是否正在发送 */
  isSending: boolean;
}

// ============ 穿透模式相关类型 ============

/** 穿透模式状态 */
export interface PenetrationState {
  /** 是否处于穿透模式 */
  isActive: boolean;
  /** Ctrl 键是否按下 */
  ctrlPressed: boolean;
  /** 鼠标是否在窗口内 */
  mouseInWindow: boolean;
}

// ============ 资源加载相关类型 ============

/** 资源加载状态 */
export interface ResourceLoadState {
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否加载完成 */
  isLoaded: boolean;
  /** 错误信息 */
  error: string | null;
  /** 已加载的动画ID列表 */
  loadedAnimations: string[];
}

/** 资源加载结果 */
export interface ResourceLoadResult<T> {
  /** 是否成功 */
  success: boolean;
  /** 加载的数据 */
  data?: T;
  /** 错误信息 */
  error?: string;
}

// ============ 角色视窗组件属性 ============

/** 角色视窗组件属性 */
export interface CharacterWindowProps {
  /** 窗口宽度（像素） */
  width?: number;
  /** 窗口高度（像素） */
  height?: number;
  /** 缩放比例 */
  scale?: number;
  /** 打开对话框回调 */
  onOpenDialog?: () => void;
}

// ============ 工厂函数 ============

/** 创建默认窗口位置 */
export function createDefaultWindowPosition(): WindowPosition {
  return { x: 100, y: 100 };
}

/** 创建默认动画命令 */
export function createDefaultAnimationCommand(): AnimationCommand {
  return {
    domain: 'internal',
    category: 'base',
    actionId: 'idle',
    urgency: 'normal',
    intensity: 0.5,
    duration: null,
  };
}

/** 创建默认穿透状态 */
export function createDefaultPenetrationState(): PenetrationState {
  return {
    isActive: false,
    ctrlPressed: false,
    mouseInWindow: true,
  };
}

/** 创建默认资源加载状态 */
export function createDefaultResourceLoadState(): ResourceLoadState {
  return {
    isLoading: false,
    isLoaded: false,
    error: null,
    loadedAnimations: [],
  };
}

// ============ 类型守卫 ============

/** 检查是否为高优先级 */
export function isHighPriority(priority: AnimationPriority): boolean {
  return priority === ANIMATION_PRIORITIES.HIGH;
}

/** 检查是否为有效的动画命令 */
export function isAnimationCommand(value: unknown): value is AnimationCommand {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const cmd = value as Partial<AnimationCommand>;
  const validDomains: AnimationDomain[] = ['internal', 'social'];
  const validCategories: AnimationCategory[] = ['base', 'work', 'result', 'emotion', 'physics', 'greeting'];
  const validActionIds: AnimationActionId[] = ['idle', 'floating', 'listen', 'think', 'execute', 'speak', 'success', 'error', 'happy', 'sad', 'sleepy', 'walk', 'drag', 'wave'];
  return (
    typeof cmd.domain === 'string' && validDomains.includes(cmd.domain as AnimationDomain) &&
    typeof cmd.category === 'string' && validCategories.includes(cmd.category as AnimationCategory) &&
    typeof cmd.actionId === 'string' && validActionIds.includes(cmd.actionId as AnimationActionId) &&
    typeof cmd.urgency === 'string' &&
    ['high', 'normal', 'low'].includes(cmd.urgency)
  );
}

/** 检查缩放值是否有效 */
export function isValidScale(scale: number): boolean {
  return typeof scale === 'number' && scale >= SCALE_RANGE.min && scale <= SCALE_RANGE.max;
}

// ============ 工具函数 ============

/** 将动画优先级转换为数值 */
export function priorityToNumber(priority: AnimationPriority): number {
  switch (priority) {
    case 'high':
      return 10;
    case 'normal':
      return 5;
    case 'low':
      return 1;
    default:
      return 5;
  }
}

/** 计算相对边界框的实际像素值 */
export function resolveRelativeBoundingBox(
  bbox: RelativeBoundingBox,
  width: number,
  height: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.round(bbox.x * width),
    y: Math.round(bbox.y * height),
    width: Math.round(bbox.width * width),
    height: Math.round(bbox.height * height),
  };
}
