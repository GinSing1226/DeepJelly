/**
 * Character Data Model Types
 *
 * DeepJelly 核心数据模型定义，遵循三层架构：
 * Assistant (助手) -> Character (角色) -> Appearance (形象) -> Action (动作)
 */

import type { AssistantIntegration } from './appConfig';

// ============ 常量定义 ============

/**
 * 动作资源类型
 */
export type ActionType = 'frames' | 'gif' | 'live2d' | '3d' | 'digital_human' | 'spritesheet';

/**
 * 动作资源类型枚举值
 */
export const actionTypeValues: ActionType[] = ['frames', 'gif', 'live2d', '3d', 'digital_human', 'spritesheet'];

/**
 * 精灵图格式类型
 *
 * 支持主流精灵图配置格式：
 * - pixi-json: PIXI.js 标准 JSON 格式
 * - texture-packer: TexturePacker 导出的 JSON 数组格式
 * - aseprite: Aseprite 导出的 JSON 格式
 * - custom-grid: 自定义网格布局（通过行列和帧尺寸计算）
 */
export type SpriteSheetFormat = 'pixi-json' | 'texture-packer' | 'aseprite' | 'custom-grid';

/**
 * 精灵图网格布局配置
 *
 * 用于自定义网格格式的精灵图切片
 */
export interface SpriteSheetGrid {
  /** 单帧宽度 (像素) */
  frame_width: number;
  /** 单帧高度 (像素) */
  frame_height: number;
  /** 帧之间的间距 (像素，默认0) */
  spacing?: number;
  /** 边缘内边距 (像素，默认0) */
  margin?: number;
  /** 总行数 */
  rows: number;
  /** 总列数 */
  cols: number;
}

/**
 * 精灵图配置
 *
 * 定义精灵图的格式和布局信息
 */
export interface SpriteSheetConfig {
  /** 精灵图格式 */
  format: SpriteSheetFormat;
  /** 精灵图资源 URL (JSON 配置文件或 PNG 图片) - custom-grid 格式不需要 */
  url?: string;
  /** 帧名称列表 (texture-packer 格式需要) */
  frameNames?: string[];
  /** 网格布局配置 (custom-grid 格式需要) */
  grid?: SpriteSheetGrid;
}

/**
 * 应用集成提供商类型
 */
export type ProviderType = 'openclaw' | 'claude' | 'chatgpt';

/**
 * 应用集成提供商类型枚举值
 */
export const providerValues: ProviderType[] = ['openclaw', 'claude', 'chatgpt'];

/**
 * 默认动作配置
 *
 * 新建形象时自动初始化的预定义动作列表
 * 动作键格式: domain-category-actionId
 * 按照默认角色(default_assistant -> default -> default形象)的动作树结构
 */
export const DEFAULT_ACTIONS: Record<string, Action> = {
  'internal-physics-drag': {
    type: 'frames',
    resources: [],
    fps: 24,
    loop: true,
    description: undefined,
  },
  'internal-work-speak': {
    type: 'frames',
    resources: [],
    fps: 24,
    loop: true,
    description: undefined,
  },
  'internal-base-idle': {
    type: 'frames',
    resources: [],
    fps: 24,
    loop: true,
    description: undefined,
  },
  'internal-work-execute': {
    type: 'frames',
    resources: [],
    fps: 24,
    loop: true,
    description: undefined,
  },
};

// ============ 核心数据模型 ============

/**
 * 动作配置
 *
 * 形象的一个动画行为，包含多个帧资源或精灵图配置
 */
export interface Action {
  /** 资源类型 */
  type: ActionType;
  /** 资源文件路径列表 */
  resources: string[];
  /** 精灵图配置 (仅当 type='spritesheet' 时需要) */
  spritesheet?: SpriteSheetConfig;
  /** 帧率 (1-60，仅 frames/spritesheet 类型有效) */
  fps?: number;
  /** 是否循环播放 */
  loop: boolean;
  /** 描述 (最多200字符) */
  description?: string;
}

/**
 * 形象配置
 *
 * 角色的视觉外观配置，包含动作动画资源
 */
export interface Appearance {
  /** 形象ID (3-30字符，同一角色内唯一) */
  id: string;
  /** 形象名称 (1-50字符) */
  name: string;
  /** 是否为默认形象 */
  isDefault: boolean;
  /** 形象描述 (最多200字符) */
  description?: string;
  /** 动作配置映射 */
  actions: Record<string, Action>;
}

/**
 * 轻量角色引用（存储在 assistants.json 中）
 *
 * 仅包含角色ID和默认形象ID，完整数据存储在独立的角色文件中
 */
export interface CharacterReference {
  /** 角色ID (3-30字符，全局唯一) */
  characterId: string;
  /** 默认形象ID (可选) */
  defaultAppearanceId?: string;
}

/**
 * 角色配置
 *
 * 助手在不同渠道的身份标识，每个角色可以绑定到不同的 AI 应用 agent
 */
export interface Character {
  /** 角色ID (3-30字符，全局唯一) */
  id: string;
  /** 所属助手ID (3-30字符，全局唯一) */
  assistantId: string;
  /** 角色名称 (1-50字符) */
  name: string;
  /** 角色描述 (最多200字符) */
  description?: string;
  /** 形象列表 */
  appearances: Appearance[];
  /** 默认形象ID (可选) */
  defaultAppearanceId?: string;
}

/**
 * 助手配置
 *
 * 代表一个 AI Agent 的逻辑分组，用于归档会话历史
 */
export interface Assistant {
  /** 助手ID (3-30字符，全局唯一) */
  id: string;
  /** 助手名称 (1-50字符) */
  name: string;
  /** 助手描述 (最多200字符) */
  description?: string;
  /** 创建时间戳 (毫秒) */
  createdAt?: number;
  /** 轻量角色引用列表（完整数据存储在 characters/{id}/config.json） */
  characters: CharacterReference[];
  /** 应用类型 (openclaw, claude, chatgpt) */
  appType?: string;
  /** Agent 标签 */
  agentLabel?: string;
  /** 绑定的 AI 应用 Agent ID */
  boundAgentId?: string;
  /** 会话密钥 */
  sessionKey?: string;
  /** AI应用集成参数列表（支持多应用绑定） */
  integrations?: AssistantIntegration[];
}

// ============ 集成模型 ============

/**
 * 应用集成配置
 *
 * 代表一个 AI 应用的连接配置（如某个 OpenClaw 实例）
 */
export interface AppIntegration {
  /** DeepJelly 内部ID (16字符，字母+数字，随机生成) */
  id: string;
  /** DeepJelly 分配的应用实例ID (16字符，系统生成) */
  applicationId: string;
  /** 应用类型 */
  provider: ProviderType;
  /** 用户自定义名称 (1-50字符) */
  name: string;
  /** 描述 (最多200字符) */
  description?: string;
  /** WebSocket 地址 */
  endpoint: string;
  /** 认证令牌 (最多500字符) */
  authToken?: string;
  /** 是否启用 */
  enabled?: boolean;
  /** 创建时间戳 (毫秒) */
  createdAt?: number;
}

/**
 * 角色集成配置
 *
 * 角色与应用集成的绑定关系，作为轻量级索引表
 */
export interface CharacterIntegration {
  /** 绑定记录ID (16字符，字母+数字，随机生成) */
  id: string;
  /** 角色ID (3-30字符，全局唯一) */
  characterId: string;
  /** 角色名称 (1-50字符，冗余便于展示) */
  characterName: string;
  /** 助手ID (3-30字符，全局唯一) */
  assistantId: string;
  /** 助手名称 (1-50字符，冗余便于展示) */
  assistantName: string;
  /** 集成信息 */
  integration: {
    /** 引用 app_integrations.id (16字符) */
    integrationId: string;
    /** 应用类型 */
    provider: ProviderType;
    /** 应用实例ID (16字符，引用 app_integrations.applicationId) */
    applicationId: string;
    /** Agent ID (3-30字符) */
    agentId: string;
    /** 动态参数 (如 sessionKey) */
    params: Record<string, any>;
  };
  /** 是否启用 */
  enabled?: boolean;
  /** 绑定时间戳 (毫秒) */
  createdAt?: number;
}

/**
 * 展示槽位配置
 *
 * 代表桌面上显示的一个角色窗口配置
 */
export interface DisplaySlot {
  /** 槽位ID (16字符，全局唯一，随机生成) */
  id: string;
  /** 助手ID (3-30字符，全局唯一) */
  assistantId: string;
  /** 助手名称 (1-50字符，冗余) */
  assistantName: string;
  /** 角色ID (3-30字符，全局唯一) */
  characterId: string;
  /** 角色名称 (1-50字符，冗余) */
  characterName: string;
  /** 形象ID (3-30字符) */
  appearanceId: string;
  /** 形象名称 (1-50字符，冗余) */
  appearanceName: string;
  /** 关联的窗口ID (Tauri 窗口标识) */
  windowId?: string;
  /** 是否显示 */
  visible: boolean;
  /** 窗口位置 */
  position?: { x: number; y: number };
  /** 创建时间戳 (毫秒) */
  createdAt?: number;
}

// ============ DTO 类型 (用于创建和更新操作) ============

/**
 * 创建动作 DTO
 */
export interface CreateActionDTO {
  /** 资源类型 */
  type: ActionType;
  /** 资源文件路径列表 */
  resources: string[];
  /** 帧率 (1-60，可选) */
  fps?: number;
  /** 是否循环播放 */
  loop: boolean;
  /** 描述 */
  description?: string;
}

/**
 * 创建形象 DTO
 */
export interface CreateAppearanceDTO {
  /** 形象ID */
  id: string;
  /** 形象名称 */
  name: string;
  /** 是否为默认形象 */
  isDefault?: boolean;
  /** 描述 */
  description?: string;
  /** 动作配置 */
  actions?: Record<string, CreateActionDTO>;
}

/**
 * 创建角色 DTO
 */
export interface CreateCharacterDTO {
  /** 角色ID */
  id: string;
  /** 角色名称 */
  name: string;
  /** 描述 */
  description?: string;
}

/**
 * 创建助手 DTO
 */
export interface CreateAssistantDTO {
  /** 助手ID */
  id: string;
  /** 助手名称 */
  name: string;
  /** 描述 */
  description?: string;
}

/**
 * 更新助手 DTO
 */
export interface UpdateAssistantDTO {
  /** 助手名称 */
  name?: string;
  /** 助手描述 */
  description?: string;
}

/**
 * 更新角色 DTO
 */
export interface UpdateCharacterDTO {
  /** 角色名称 */
  name?: string;
  /** 角色描述 */
  description?: string;
}

/**
 * 更新形象 DTO
 */
export interface UpdateAppearanceDTO {
  /** 形象名称 */
  name?: string;
  /** 是否为默认形象 */
  isDefault?: boolean;
  /** 形象描述 */
  description?: string;
}

/**
 * 更新动作 DTO
 */
export interface UpdateActionDTO {
  /** 资源类型 */
  type?: ActionType;
  /** 资源文件路径列表 */
  resources?: string[];
  /** 帧率 (1-60，可选) */
  fps?: number;
  /** 是否循环播放 */
  loop?: boolean;
  /** 描述 */
  description?: string;
}

// ============ 工具函数 ============

/**
 * 用户自定义ID正则表达式
 *
 * 规则：3-30字符，仅包含字母、数字、下划线、连字符
 */
const CUSTOM_ID_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

/**
 * 生成随机ID (16字符)
 *
 * 去除混淆字符 0OIl，仅使用字母和数字
 *
 * @returns 16字符随机ID
 *
 * @example
 * ```ts
 * const id = generateId(); // "w6gyoy52o7lgk5ik"
 * ```
 */
export function generateId(): string {
  // 去除混淆字符 0OIl
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 验证用户自定义ID是否合法
 *
 * 规则：3-30字符，仅包含字母、数字、下划线、连字符
 *
 * @param id - 待验证的ID
 * @returns 是否合法
 *
 * @example
 * ```ts
 * isValidCustomId('work_assistant'); // true
 * isValidCustomId('ab'); // false (太短)
 * isValidCustomId('test id'); // false (包含空格)
 * ```
 */
export function isValidCustomId(id: string): boolean {
  return CUSTOM_ID_REGEX.test(id);
}

/**
 * 类型守卫：检查对象是否为 SpriteSheetConfig
 *
 * @param value - 待检查的值
 * @returns 是否为 SpriteSheetConfig
 *
 * @example
 * ```ts
 * const obj = { format: 'pixi-json', url: 'sheet.json' };
 * if (isSpriteSheetConfig(obj)) {
 *   // obj 是 SpriteSheetConfig 类型
 * }
 * ```
 */
export function isSpriteSheetConfig(value: unknown): value is SpriteSheetConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const config = value as Partial<SpriteSheetConfig>;

  // 检查 format 字段
  const validFormats: SpriteSheetFormat[] = ['pixi-json', 'texture-packer', 'aseprite', 'custom-grid'];
  if (typeof config.format !== 'string' || !validFormats.includes(config.format as SpriteSheetFormat)) {
    return false;
  }

  // 根据格式检查特定字段
  switch (config.format) {
    case 'texture-packer':
      // texture-packer 需要 url 和 frameNames
      if (typeof config.url !== 'string' || config.url.length === 0) {
        return false;
      }
      if (!Array.isArray(config.frameNames) || config.frameNames.length === 0) {
        return false;
      }
      break;

    case 'custom-grid':
      // custom-grid 需要 grid 配置，不需要 url
      if (typeof config.grid !== 'object' || config.grid === null) {
        return false;
      }
      const grid = config.grid as Partial<SpriteSheetGrid>;
      if (
        typeof grid.frame_width !== 'number' || grid.frame_width <= 0 ||
        typeof grid.frame_height !== 'number' || grid.frame_height <= 0 ||
        typeof grid.rows !== 'number' || grid.rows <= 0 ||
        typeof grid.cols !== 'number' || grid.cols <= 0
      ) {
        return false;
      }
      // spacing 和 margin 是可选的，如果存在则检查
      if (grid.spacing !== undefined && (typeof grid.spacing !== 'number' || grid.spacing < 0)) {
        return false;
      }
      if (grid.margin !== undefined && (typeof grid.margin !== 'number' || grid.margin < 0)) {
        return false;
      }
      break;

    case 'pixi-json':
    case 'aseprite':
      // 这两种格式需要 url
      if (typeof config.url !== 'string' || config.url.length === 0) {
        return false;
      }
      break;
  }

  return true;
}

/**
 * 类型守卫：检查对象是否为 Action
 *
 * @param value - 待检查的值
 * @returns 是否为 Action
 *
 * @example
 * ```ts
 * const obj = { type: 'frames', resources: [], loop: true };
 * if (isAction(obj)) {
 *   // obj 是 Action 类型
 * }
 * ```
 */
export function isAction(value: unknown): value is Action {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const action = value as Partial<Action>;

  // 检查必需字段
  if (typeof action.type !== 'string' || !actionTypeValues.includes(action.type as ActionType)) {
    return false;
  }

  if (!Array.isArray(action.resources)) {
    return false;
  }

  if (typeof action.loop !== 'boolean') {
    return false;
  }

  // 检查 fps 范围 (如果存在)
  if (action.fps !== undefined) {
    if (typeof action.fps !== 'number' || action.fps < 1 || action.fps > 60) {
      return false;
    }
  }

  // 检查 spritesheet 配置 (如果类型是 spritesheet)
  if (action.type === 'spritesheet') {
    if (!isSpriteSheetConfig(action.spritesheet)) {
      return false;
    }
  }

  return true;
}

// ============ UI 组件类型 ============

/**
 * AI 应用
 *
 * 表示一个集成的 AI 应用提供商
 */
export interface AIApp {
  /** 应用ID */
  id: string;
  /** 应用名称 */
  name: string;
  /** 应用描述 */
  description?: string;
}

/**
 * 展示配置
 *
 * 角色在桌面上的展示配置
 */
export interface DisplayConfig {
  /** 角色ID */
  characterId: string;
  /** 形象ID */
  appearanceId: string;
  /** 是否显示 */
  visible: boolean;
  /** 窗口位置 */
  position?: { x: number; y: number };
  /** 窗口大小 */
  size?: { width: number; height: number };
  /** 缩放比例 */
  scale?: number;
}

/**
 * 助手树节点
 *
 * 用于助手树形展示的节点结构
 */
export interface AssistantTreeNode {
  /** 节点类型 */
  type: 'app' | 'assistant';
  /** 节点ID */
  id: string;
  /** 节点名称 */
  name: string;
  /** 节点描述 */
  description?: string;
  /** 应用类型 (仅assistant节点) */
  appType?: string;
  /** 代理标签 (仅assistant节点) */
  agentLabel?: string;
  /** 子节点 (仅app节点) */
  children?: AssistantTreeNode[];
}

/**
 * 角色卡片
 *
 * 用于角色卡片网格展示的角色信息
 */
export interface CharacterCard {
  /** 角色ID */
  id: string;
  /** 助手ID */
  assistantId?: string;
  /** 角色名称 */
  name: string;
  /** 角色描述 */
  description?: string;
  /** 形象列表 */
  appearances?: Appearance[];
  /** 封面图片路径 (可选) */
  coverImage?: string;
  /** 默认形象ID (可选) */
  defaultAppearanceId?: string;
  /** 是否为默认 (可选) */
  isDefault?: boolean;
}

// ============ 向后兼容的类型别名 ============

/**
 * 动画资源类型别名（向后兼容）
 * @deprecated 使用 Action 代替
 */
export type ActionResource = Action;

/**
 * 资源类型别名（向后兼容）
 * @deprecated 使用 ActionType 代替
 */
export type ResourceType = ActionType;

/**
 * 动画域类型
 */
export type BehaviorDomain = 'internal' | 'social';

/**
 * 动画分类类型
 */
export type BehaviorCategory = 'base' | 'work' | 'result' | 'emotion' | 'physics';

/**
 * 动作ID类型
 */
export type ActionId =
  | 'idle'
  | 'floating'
  | 'listen'
  | 'think'
  | 'execute'
  | 'speak'
  | 'success'
  | 'error'
  | 'happy'
  | 'sad'
  | 'walk'
  | 'drag'
  | string;

/**
 * 完整的动作键 (格式: domain-category-action_id)
 */
export type ActionKey = `${BehaviorDomain}-${BehaviorCategory}-${ActionId}`;

/**
 * 动作树节点类型
 */
export type ActionTreeNodeType = 'domain' | 'category' | 'action';

/**
 * 动作树节点
 */
export interface ActionTreeNode {
  /** 节点类型 */
  type: ActionTreeNodeType;
  /** 完整键 (格式: domain 或 domain-category 或 domain-category-action_id) */
  key: string;
  /** 域名 */
  domain: string;
  /** 分类名 */
  category?: string;
  /** 动作ID */
  actionId?: string;
  /** 动作配置 (仅action类型节点) */
  action?: ActionResource;
  /** 子节点 */
  children?: ActionTreeNode[];
}

/**
 * 新增动作层级
 */
export type AddActionLevel = 'domain' | 'category' | 'action';

/**
 * 新增动作表单数据
 */
export interface AddActionFormData {
  /** 层级选择 */
  level: AddActionLevel;
  /** 域名 (选择或输入) */
  domain: string;
  /** 分类名 (选择或输入) */
  category: string;
  /** 动作ID (选择或输入) */
  actionId: string;
  /** 资源类型 */
  resourceType: ActionType;
  /** 是否循环 */
  loop: boolean;
  /** 描述 */
  description?: string;
}

/**
 * 编辑动作表单数据
 */
export interface EditActionFormData {
  /** 当前键 */
  currentKey: string;
  /** 新键名 */
  newKey: string;
  /** 是否循环 */
  loop: boolean;
  /** 描述 */
  description?: string;
}

/**
 * 动作树操作类型
 */
export type ActionTreeOperation = 'add' | 'edit' | 'delete';

/**
 * 动作上下文菜单项
 */
export interface ActionContextMenuItem {
  /** 操作类型 */
  operation: ActionTreeOperation;
  /** 显示文本 */
  label: string;
  /** 图标 */
  icon?: string;
}
