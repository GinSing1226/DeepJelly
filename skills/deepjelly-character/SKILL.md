---
name: deepjelly-character
description: 当需要管理 DeepJelly 中的助手、角色、形象或动画资源时使用。提供完整的 CRUD 功能，包括创建、读取、更新、删除操作，以及获取配置路径和动画资源信息。当用户提到"deepjelly角色"、"助手管理"、"管理角色"、"角色配置"或需要查询/修改角色信息时使用此技能。注意：用户如无明说，"deepjelly"通常指代 DeepJelly 技能（本技能或 deepjelly-integrate 技能），而不是 DeepJelly 插件。
---

# DeepJelly 角色管理技能

本技能用于管理 DeepJelly 虚拟角色系统中的助手、角色、形象和动画资源。

## 适用场景

- 查询助手/角色列表
- 查看角色详情（包含形象和动作）
- 创建新的助手/角色/形象
- 更新角色配置信息
- 删除不需要的资源
- 获取动画资源配置
- 查询配置文件路径

## API 端点

| 操作 | HTTP 端点 | 方法 | 说明 |
|------|----------|------|------|
| list_assistants | /api/v1/content/assistant | GET | 获取所有助手列表 |
| get_assistant | /api/v1/content/assistant/:id | GET | 获取指定助手详情 |
| create_assistant | /api/v1/content/assistant | POST | 创建新助手 |
| update_assistant | /api/v1/content/assistant/:id | PATCH | 更新助手信息 |
| delete_assistant | /api/v1/content/assistant/:id | DELETE | 删除助手 |
| list_characters | /api/v1/content/character | GET | 获取所有角色列表 |
| get_character | /api/v1/content/character/:id | GET | 获取指定角色详情 |
| create_character | /api/v1/content/character | POST | 创建新角色 |
| update_character | /api/v1/content/character/:id | PATCH | 更新角色信息 |
| delete_character | /api/v1/content/character/:id | DELETE | 删除角色 |
| list_appearances | /api/v1/content/appearance | GET | 获取所有形象列表 |
| create_appearance | /api/v1/content/appearance | POST | 创建新形象 |
| update_appearance | /api/v1/content/appearance/:id | PATCH | 更新形象信息 |
| delete_appearance | /api/v1/content/appearance/:id | DELETE | 删除形象 |
| add_action | /api/v1/content/action | POST | 添加动作资源 |
| upload_action_files | /api/v1/content/action/upload | POST | 上传动作文件 |
| get_config_paths | /api/v1/content/config/paths | GET | 获取配置路径 |

**注意**: API 服务器地址和认证令牌从本技能目录下的 `config.md` 文件读取。

## 配置文件

所有 API 请求需要配置服务器地址和 Bearer Token 认证。

### 配置文件位置

本技能目录下的 `config.md` 文件。

### 配置文件格式

\`\`\`markdown
# DeepJelly 角色管理配置文件

## API 配置

### 服务器地址
\`\`\`
127.0.0.1
\`\`\`

### 端口
\`\`\`
12261
\`\`\`

### 认证令牌 (Bearer Token)
\`\`\`
your_deepjelly_token_here
\`\`\`
\`\`\`

**重要**: 地址、端口、token 三个参数各自只有一个值。如果用户传入新值，直接更新 `config.md` 中对应的值。

### 获取 Token 步骤

1. 打开 DeepJelly 应用
2. 进入应用集成管理
3. 创建或编辑一个应用集成（AppIntegration）
4. 复制生成的 `deepjellyToken`
5. 将 token 填入 `config.md` 文件

### HTTP 请求格式

API 完整地址格式：`http://{地址}:{端口}`

\`\`\`http
GET /api/v1/content/assistant HTTP/1.1
Host: {地址}:{端口}
Authorization: Bearer {token}
Content-Type: application/json
\`\`\`

例如，配置为 `地址=127.0.0.1`，`端口=12261` 时：
\`\`\`http
GET /api/v1/content/assistant HTTP/1.1
Host: 127.0.0.1:12261
Authorization: Bearer your_deepjelly_token_here
Content-Type: application/json
\`\`\`

## 数据模型

### Assistant（助手）

\`\`\`json
{
  "id": "work_assistant",
  "name": "工作助手",
  "description": "工作场景的虚拟助手",
  "createdAt": 1773091032051,
  "characters": [
    {
      "id": "char_feishu_private",
      "name": "飞书私聊",
      "description": "飞书私聊场景角色"
    }
  ],
  "appType": "feishu",
  "agentLabel": "christina",
  "integrations": []
}
\`\`\`

### Character（角色）

\`\`\`json
{
  "id": "char_feishu_private",
  "name": "飞书私聊",
  "description": "飞书私聊场景",
  "assistantId": "work_assistant"
}
\`\`\`

### Appearance（形象）

\`\`\`json
{
  "id": "appr_casual",
  "name": "休闲装",
  "characterId": "char_feishu_private",
  "isDefault": true
}
\`\`\`

### AnimationActionId（动画动作）

动画动作采用三级分类：`{domain}-{category}-{action}`

**注意**：当前系统默认支持以下4个动作键。如需添加更多动作类型，请参考角色配置文件中的实际定义。

| 动作键 | 名称 | 域 | 分类 |
|--------|------|-----|------|
| internal-base-idle | 待机 | Internal | Base |
| internal-physics-drag | 拖拽 | Internal | Physics |
| internal-work-execute | 执行 | Internal | Work |
| internal-work-speak | 说话 | Internal | Work |

## 操作说明

### 助手管理

#### list_assistants - 获取所有助手

**参数**：无（服务器地址和 token 从 config.md 读取）

#### get_assistant - 获取助手详情

**参数**：
- `id` (必需): 助手 ID

#### create_assistant - 创建助手

创建一个新的助手。

**参数说明**：

| 参数 | 是否必需 | 来源 | 说明 |
|------|----------|------|------|
| `name` | 必需 | 用户输入 | 助手名称，如"工作助手" |
| `description` | 可选 | 用户输入 | 助手描述，说明用途 |
| `app_type` | 可选 | 用户输入 | AI 应用名称，如 "openclaw"、"feishu"、"dingtalk" 等 |
| `agent_label` | 可选 | OpenClaw Agent列表 | Agent 标签，从 OpenClaw 的 agent 列表中选择（如果集成的是 OpenClaw）。可为空 |

**使用方式**：
- 向用户询问助手名称
- 询问是否需要添加描述、应用类型等额外信息

**请求体示例**：
\`\`\`json
{
  "name": "新助手",
  "description": "这是一个新的虚拟助手",
  "appType": "openclaw",
  "agentLabel": "christina"
}
\`\`\`

#### update_assistant - 更新助手

**参数**：
- `id` (必需): 助手 ID

**请求体**（仅包含需要更新的字段）：
\`\`\`json
{
  "name": "更新后的名称",
  "description": "更新后的描述"
}
\`\`\`

#### delete_assistant - 删除助手

**参数**：
- `id` (必需): 助手 ID

### 角色管理

#### list_characters - 获取所有角色

**参数**：无（服务器地址和 token 从 config.md 读取）

#### get_character - 获取角色详情

**参数**：
- `id` (必需): 角色 ID

#### create_character - 创建角色

为指定助手创建一个新的角色。

**重要**：角色必须属于某个助手，创建时需要指定 `assistant_id`。

**参数说明**：

| 参数 | 是否必需 | 来源 | 说明 |
|------|----------|------|------|
| `id` | 必需 | 用户输入 | 角色 ID（全局唯一，3-30字符），如"char_custom_01" |
| `name` | 必需 | 用户输入 | 角色名称，如"自定义角色" |
| `description` | 可选 | 用户输入 | 角色描述，说明角色用途 |
| `assistant_id` | 必需 | 助手列表 | 所属助手的 ID，需从助手列表中选择 |

**使用方式**：
1. 先调用 `list_assistants` 获取助手列表
2. 让用户选择要将角色添加到哪个助手
3. 询问角色的 ID、名称和描述

**请求体示例**：
\`\`\`json
{
  "id": "char_custom_01",
  "name": "自定义角色",
  "description": "这是一个自定义角色",
  "assistantId": "work_assistant"
}
\`\`\`

#### update_character - 更新角色

**参数**：
- `id` (必需): 角色 ID

**请求体**：
\`\`\`json
{
  "name": "更新后的角色名",
  "description": "更新后的描述"
}
\`\`\`

#### delete_character - 删除角色

**参数**：
- `id` (必需): 角色 ID

### 形象管理

#### list_appearances - 获取所有形象

**参数**：无（服务器地址和 token 从 config.md 读取）

#### create_appearance - 创建形象

为指定角色创建一个新的形象。

**参数说明**：

| 参数 | 是否必需 | 来源 | 说明 |
|------|----------|------|------|
| `id` | 必需 | 用户输入 | 形象 ID（全局唯一，3-30字符），如"appr_formal" |
| `name` | 必需 | 用户输入 | 形象名称，如"正装"、"休闲装" |
| `description` | 可选 | 用户输入 | 形象描述，说明使用场景 |
| `character_id` | 必需 | 角色列表 | 所属角色的 ID，需从角色列表中选择 |
| `is_default` | 可选 | 默认 false | 是否为默认形象，如果是角色的第一个形象会自动设为默认 |

**使用方式**：
1. 先调用 `list_characters` 获取角色列表
2. 让用户选择要为哪个角色添加形象
3. 询问形象的 ID、名称和描述

**请求体示例**：
\`\`\`json
{
  "id": "appr_formal",
  "name": "正装",
  "description": "正式场合的穿着",
  "characterId": "char_custom_01",
  "isDefault": false
}
\`\`\`

#### update_appearance - 更新形象

**参数**：
- `id` (必需): 形象 ID

**请求体**：
\`\`\`json
{
  "name": "更新后的形象名",
  "isDefault": true
}
\`\`\`

#### delete_appearance - 删除形象

**参数**：
- `id` (必需): 形象 ID

### 动作资源管理

#### add_action - 添加动作资源

为角色的形象添加动画动作资源。

**参数说明**：

| 参数 | 是否必需 | 来源 | 说明 |
|------|----------|------|------|
| `character_id` | 必需 | 角色列表 | 角色 ID，从角色列表中选择 |
| `appearance_id` | 必需 | 形象列表 | 形象 ID，属于指定角色的形象 |
| `key` | 必需 | 动作列表 | 动作键，格式为 `{domain}-{category}-{action}`，如 `internal-work-think` |
| `type` | 必需 | 用户选择 | 资源类型，可选值：`frames`/`gif`/`spritesheet` |
| `resources` | 必需 | 用户输入 | 资源文件路径列表，可以是本地绝对路径或相对于 characters 目录的相对路径 |
| `fps` | 可选 | 用户输入 | 帧率，仅对 `frames` 和 `spritesheet` 类型有效，默认 24 |
| `loop` | 可选 | 默认 true | 是否循环播放 |
| `description` | 可选 | 用户输入 | 动作描述 |
| `spritesheet` | 可选 | spritesheet类型 | 精灵图配置，仅 `spritesheet` 类型需要 |

**动作键 (key) 列表**（当前默认支持的4个动作）：
- `internal-base-idle`: 待机
- `internal-physics-drag`: 拖拽
- `internal-work-execute`: 执行
- `internal-work-speak`: 说话

**资源类型 (type) 说明**：
- `frames`: 序列帧图片（多张 PNG/JPG），需要 `fps` 参数
- `gif`: GIF 动图，单个文件
- `spritesheet`: 精灵图，需要 `fps` 和 `spritesheet` 配置参数

**Spritesheet 配置参数**（仅当 `type` 为 `spritesheet` 时需要）：
- `format`: 精灵图格式，可选值：`pixi-json`、`texture-packer`、`aseprite`、`custom-grid`
- `url`: 元数据文件路径（用于 pixi-json、texture-packer、aseprite 格式）
- `grid`: 网格切片配置（仅用于 custom-grid 格式）
  - `frame_width`: 每帧宽度（像素）
  - `frame_height`: 每帧高度（像素）
  - `rows`: 行数
  - `cols`: 列数
  - `spacing`: 帧间距（可选，默认0）
  - `margin`: 边缘留白（可选，默认0）

**使用方式**：
1. 先确定角色和形象
2. 从角色的 config.json 中读取现有的动作键列表（或使用默认的4个动作键）
3. 询问用户要添加/更新哪个动作键的动作资源
4. 询问资源类型（frames/gif/spritesheet）
5. 根据资源类型询问相应参数：
   - `frames`: 询问图片路径列表和 fps
   - `gif`: 询问 GIF 文件路径
   - `spritesheet`: 询问精灵图路径和配置参数

**请求体示例（frames 类型）**：
\`\`\`json
{
  "characterId": "char_custom_01",
  "appearanceId": "appr_formal",
  "key": "internal-base-idle",
  "type": "frames",
  "resources": [
    "C:/Users/xxx/Pictures/idle_001.png",
    "C:/Users/xxx/Pictures/idle_002.png"
  ],
  "fps": 24,
  "loop": true,
  "description": "待机动作"
}
\`\`\`

**请求体示例（spritesheet 类型）**：
\`\`\`json
{
  "characterId": "char_custom_01",
  "appearanceId": "appr_formal",
  "key": "internal-work-speak",
  "type": "spritesheet",
  "resources": ["spritesheet.png"],
  "fps": 24,
  "loop": true,
  "spritesheet": {
    "format": "custom-grid",
    "grid": {
      "frameWidth": 128,
      "frameHeight": 128,
      "rows": 4,
      "cols": 5,
      "spacing": 2,
      "margin": 0
    }
  },
  "description": "说话动作"
}
\`\`\`

#### upload_action_files - 上传动作文件

上传动画资源文件到服务器（此功能尚未实现）。

#### get_config_paths - 获取配置路径

获取 DeepJelly 的配置文件路径。

**参数**：无

**返回示例**：
\`\`\`json
{
  "success": true,
  "data": {
    "charactersDir": "C:\\Users\\xxx\\AppData\\Roaming\\DeepJelly\\characters"
  },
  "error": null
}
\`\`\`

## 错误处理

所有 API 响应遵循统一格式：

**成功响应**：
\`\`\`json
{
  "success": true,
  "data": { /* 实际数据 */ },
  "error": null
}
\`\`\`

**错误响应**：
\`\`\`json
{
  "success": false,
  "data": null,
  "error": {
    "code": "NOT_FOUND",
    "message": "Assistant not found",
    "details": {
      "id": "not_found"
    }
  }
}
\`\`\`

**常见错误码**：
- `UNAUTHORIZED`: 认证失败
- `NOT_FOUND`: 资源不存在
- `VALIDATION_ERROR`: 参数验证失败
- `CONFLICT`: 资源冲突（如 ID 重复）
- `NOT_IMPLEMENTED`: 功能尚未实现

## 使用示例

以下示例使用从 `config.md` 读取的服务器地址和认证令牌。

### 查询所有助手

\`\`\`bash
curl -X GET {server_address}/api/v1/content/assistant \\
  -H "Authorization: Bearer {deepjelly_token}"
\`\`\`

### 创建新角色

\`\`\`bash
curl -X POST {server_address}/api/v1/content/character \\
  -H "Authorization: Bearer {deepjelly_token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "id": "char_custom_01",
    "name": "自定义角色",
    "description": "这是一个自定义角色"
  }'
\`\`\`

### 添加动作资源

\`\`\`bash
curl -X POST {server_address}/api/v1/content/action \\
  -H "Authorization: Bearer {deepjelly_token}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "characterId": "char_custom_01",
    "appearanceId": "appr_formal",
    "key": "internal-work-think",
    "type": "frames",
    "resources": ["path/to/frame001.png"],
    "fps": 24
  }'
\`\`\`
