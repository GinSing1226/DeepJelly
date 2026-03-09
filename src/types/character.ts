/**
 * Character Management Types
 *
 * 角色管理相关的类型定义，遵循需求文档 docs/private_docs/Reqs/4.2.角色管理.md
 *
 * 数据层级关系：
 * AI应用 (app)
 *   └── 助手 (assistant) ←→ Agent
 *         └── 角色 (character)
 *               └── 形象 (appearance)
 *                     └── 动作 (action)
 *                           └── 资源 (resource)
 */

/**
 * AI应用类型
 * 如 OpenClaw, Claude Code 等
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
 * AI应用集成参数
 */
export interface AssistantIntegration {
  /** AI应用提供商标识 */
  provider: string;
  /** 集成参数（动态结构） */
  params: Record<string, any>;
  /** 是否启用 */
  enabled?: boolean;
  /** 绑定时间戳 */
  createdAt?: number;
}

/**
 * 助手类型
 * 对应 AI应用 中的某个 Agent
 */
export interface Assistant {
  /** DeepJelly ID (16 chars, 随机字符串) */
  id: string;
  /** 助手名称 */
  name: string;
  /** 助手描述 */
  description?: string;
  /** 应用类型 (openclaw, claude, chatgpt) */
  appType: string;
  /** Agent label (agent identifier in the AI app) */
  agentLabel?: string;
  /** 绑定的 AI 应用 Agent ID */
  boundAgentId?: string;
  /** 会话密钥 */
  sessionKey?: string;
  /** AI应用集成参数列表（支持多应用绑定） */
  integrations?: AssistantIntegration[];
  /** 创建时间 */
  createdAt?: string;
}

/**
 * 动画资源类型
 */
export type ResourceType = 'frames' | 'gif' | 'live2d' | '3d' | 'digital_human';

/**
 * 动画资源配置
 */
export interface ActionResource {
  /** 资源类型 */
  type: ResourceType;
  /** 资源路径列表 */
  resources: string[];
  /** 帧率 (仅 frames 类型) */
  fps?: number;
  /** 是否循环 */
  loop: boolean;
  /** 描述 */
  description?: string;
}

/**
 * 形象类型
 * 角色的外观配置
 */
export interface Appearance {
  /** 形象ID (格式: appr_xxx) */
  id: string;
  /** 形象名称 */
  name: string;
  /** 所属角色ID */
  characterId: string;
  /** 是否为默认形象 */
  isDefault: boolean;
  /** 描述 */
  description?: string;
  /** 动作配置映射 */
  actions: Record<string, ActionResource>;
}

/**
 * 角色类型
 */
export interface Character {
  /** 角色ID (格式: char_xxx) */
  id: string;
  /** 角色名称 */
  name: string;
  /** 角色描述 */
  description?: string;
  /** 所属助手ID */
  assistantId: string;
  /** 形象列表 */
  appearances: Appearance[];
  /** 默认形象ID */
  defaultAppearanceId: string;
}

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
 * 展示助手配置
 * 用于设置当前展示的助手/角色/形象
 */
export interface DisplayConfig {
  /** 展示的助手ID */
  assistantId: string;
  /** 展示的角色ID */
  characterId: string;
  /** 展示的形象ID */
  appearanceId: string;
}

/**
 * 助手树节点
 * 用于UI渲染的树形结构
 */
export interface AssistantTreeNode {
  type: 'app' | 'assistant';
  id: string;
  name: string;
  description?: string;
  children?: AssistantTreeNode[];
  // 助手特有属性
  appType?: string;
  agentLabel?: string;
}

/**
 * 角色卡片数据
 * 用于角色卡片网格展示
 */
export interface CharacterCard {
  id: string;
  name: string;
  description?: string;
  /** 角色封面图路径 (待机动画首帧) */
  coverImage?: string;
  /** 默认形象ID */
  defaultAppearanceId: string;
  /** 是否为默认 */
  isDefault?: boolean;
}

// ============ 动作树编辑相关类型 ============

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
  resourceType: ResourceType;
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
