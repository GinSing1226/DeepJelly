---
name: deepjelly-integrate
description: 当 AI agent 应用需要连接集成 DeepJelly 虚拟角色系统时使用。用于管理 AI 应用与 DeepJelly 之间的集成配置，包括检查连接、获取可用集成、配置角色绑定关系等。当用户提到"deepjelly集成"、"绑定角色"、"连接deepjelly"或需要查询集成配置时使用此技能。注意：用户如无明说，"deepjelly"通常指代 DeepJelly 技能（本技能或 deepjelly-character 技能），而不是 DeepJelly 插件。
---

# DeepJelly 集成管理技能

本技能用于管理 AI agent 应用与 DeepJelly 虚拟角色系统之间的集成配置。

## 适用场景

- 检查 DeepJelly API 服务是否在线
- 获取可用的应用集成列表
- 测试与 AI 应用的连接
- 查询已有的角色集成配置
- 添加/更新/删除角色集成

## API 端点

| 操作 | HTTP 端点 | 方法 | 说明 |
|------|----------|------|------|
| check_connection | /health | GET | 检查服务健康状态 |
| list_app_integrations | /api/v1/integration/app | GET | 获取应用集成列表 |
| test_connection | /api/v1/integration/app/test | POST | 测试连接 |
| list_character_integrations | /api/v1/integration/character | GET | 获取角色集成列表 |
| get_character_integration | /api/v1/integration/character/:id | GET | 获取角色集成详情 |
| add_character_integration | /api/v1/integration/character | POST | 添加角色集成 |
| update_character_integration | /api/v1/integration/character/:id | PATCH | 更新角色集成 |
| delete_character_integration | /api/v1/integration/character/:id | DELETE | 删除角色集成 |

**注意**: API 服务器地址和认证令牌从本技能目录下的 `config.md` 文件读取。

## 配置文件

所有 API 请求需要配置服务器地址和 Bearer Token 认证。

### 配置文件位置

本技能目录下的 `config.md` 文件。

### 配置文件格式

\`\`\`markdown
# DeepJelly 集成配置文件

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
GET /api/v1/integration/app HTTP/1.1
Host: {地址}:{端口}
Authorization: Bearer {token}
Content-Type: application/json
\`\`\`

例如，配置为 `地址=127.0.0.1`，`端口=12261` 时：
\`\`\`http
GET /api/v1/integration/app HTTP/1.1
Host: 127.0.0.1:12261
Authorization: Bearer your_deepjelly_token_here
Content-Type: application/json
\`\`\`

## 操作说明

### check_connection - 检查服务健康

检查 DeepJelly API 服务是否在线。

**参数**：无（从 config.md 读取服务器地址）

**示例**：
\`\`\`bash
curl {从config.md读取的服务器地址}/health
\`\`\`

### list_app_integrations - 获取应用集成列表

获取所有配置的应用集成（AppIntegration）。

**参数**：无（服务器地址和 token 从 config.md 读取）

**返回数据结构**：
\`\`\`json
{
  "success": true,
  "data": [
    {
      "id": "w6gyoy52o7lgk5ik",
      "applicationId": "a7b3x9k2m4n6p8",
      "provider": "openclaw",
      "name": "OpenClaw (192.168.10.128)",
      "description": "公司内网OpenClaw实例",
      "endpoint": "ws://192.168.10.128:18790",
      "authToken": "a8a1b579...",
      "deepjellyToken": "xxx...",
      "enabled": true,
      "createdAt": 1773091032051
    }
  ],
  "error": null
}
\`\`\`

### test_connection - 测试连接

测试到目标 AI 应用的 WebSocket 连接。

**参数说明**：

| 参数 | 是否必需 | 来源 | 说明 |
|------|----------|------|------|
| `endpoint` | 必需 | 用户输入 | 目标 AI 应用的 WebSocket 端点，格式如 `ws://192.168.10.128:18790` |
| `auth_token` | 可选 | 用户输入 | 目标 AI 应用的认证令牌（如果需要） |

**使用方式**：
- 向用户询问要测试的 AI 应用 WebSocket 端点地址
- 如果 AI 应用需要认证，同时询问认证令牌

**请求体**：
\`\`\`json
{
  "endpoint": "ws://192.168.10.128:18790",
  "authToken": "optional_token"
}
\`\`\`

### list_character_integrations - 获取角色集成列表

获取所有角色集成配置。

**参数**：无（服务器地址和 token 从 config.md 读取）

**返回数据结构**：
\`\`\`json
{
  "success": true,
  "data": [
    {
      "id": "w6gyoy52o7lgk5ik",
      "characterId": "char_feishu_private",
      "characterName": "飞书私聊",
      "assistantId": "work_assistant",
      "assistantName": "工作助手",
      "integration": {
        "integrationId": "a7b3x9k2m4n6p8",
        "provider": "openclaw",
        "applicationId": "x9k2m4n6p8q1r3",
        "agentId": "christina",
        "params": {
          "sessionKey": "agent:christina:main"
        }
      },
      "enabled": true,
      "createdAt": 1773091035830
    }
  ],
  "error": null
}
\`\`\`

### get_character_integration - 获取角色集成详情

获取指定 ID 的角色集成详情。

**参数**：
- `id` (必需): 角色集成 ID

### add_character_integration - 添加角色集成

为角色添加应用集成绑定，使 AI 应用能够控制该角色。

**参数说明**：

| 参数 | 是否必需 | 来源 | 说明 |
|------|----------|------|------|
| `character_id` | 必需 | 角色列表 | 要绑定的角色 ID，可以从角色列表中让用户选择 |
| `integration_id` | 必需 | 应用集成列表 | 应用集成 ID，引用 `list_app_integrations` 返回的某个 `id` 字段 |
| `agent_id` | 可选 | OpenClaw Agent列表 | Agent 标识，如果集成的是 OpenClaw，应从 OpenClaw 的 agent 列表中选择；也可为空 |
| `session_key` | 可选 | sessions.json | 会话密钥，用于标识特定会话，格式如 `agent:xxx:main`。可从 OpenClaw 的 sessions.json 中选择 |
| `enabled` | 可选 | 默认 true | 是否启用此集成，默认为启用状态 |

**使用方式**：
1. 先调用 `list_app_integrations` 获取可用的应用集成列表
2. 让用户选择要绑定的角色（可以从角色列表选择）
3. 让用户选择要绑定的应用集成
4. 如果应用集成是 OpenClaw：
   - 列出 OpenClaw 的可用 agents，让用户选择 `agent_id`
   - 读取 sessions.json 文件，让用户选择或输入 `session_key`
5. 其他应用：询问用户 `agent_id` 和 `session_key`（如果需要）

**请求体示例**：
\`\`\`json
{
  "characterId": "char_feishu_private",
  "integrationId": "w6gyoy52o7lgk5ik",
  "agentId": "christina",
  "sessionKey": "agent:christina:main",
  "enabled": true
}
\`\`\`

### update_character_integration - 更新角色集成

更新已有的角色集成配置。

**参数说明**：

| 参数 | 是否必需 | 来源 | 说明 |
|------|----------|------|------|
| `id` | 必需 | 角色集成列表 | 要更新的角色集成 ID，从 `list_character_integrations` 获取 |
| `character_id` | 可选 | 用户选择 | 新的角色 ID（如需更换角色） |
| `session_key` | 可选 | 用户输入 | 新的会话密钥（如需更新会话配置） |
| `enabled` | 可选 | 用户选择 | 启用/禁用此集成 |

**使用方式**：
- 先通过 `list_character_integrations` 查看现有的角色集成
- 让用户选择要更新的集成
- 询问用户要更新哪些字段

**请求体示例**（仅包含需要更新的字段）：
\`\`\`json
{
  "sessionKey": "new_session_key",
  "enabled": false
}
\`\`\`

### delete_character_integration - 删除角色集成

删除指定的角色集成。

**参数**：
- `id` (必需): 角色集成 ID

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
    "message": "Character integration not found",
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
- `CONFLICT`: 资源冲突
- `NOT_IMPLEMENTED`: 功能未实现

## Provider 类型

应用集成支持以下 provider 类型：
- `openclaw`: OpenClaw 应用
- `claude`: Claude 应用
- `chatgpt`: ChatGPT 应用
