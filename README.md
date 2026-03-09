# DeepJelly

<div align="center">

**让 AI 以虚拟形象出现在你的桌面上**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131?logo=tauri)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)

[English](README_EN.md) | 简体中文

</div>

---

## 简介

**DeepJelly** 是一款跨平台桌面虚拟助手（桌面宠物），为 AI Agent 提供可视化的"物理化身"。它让隐藏在后台的 AI 以生动的虚拟形象出现在桌面上，通过动画、表情和气泡与用户交互，将单纯的工具箱跃升为桌面上能真实感知的"赛博伴侣"。

### 核心特性

#### 1. 虚拟形象
- **自定义 AI 化身形象** - 支持精灵图动画，可自定义角色外观
- **自定义角色** - 支持配置成自己喜爱的角色，可针对不同动作上传不同的图片、GIF（图片可用 AI 生成连续的精灵图）
- **展示 AI 输出** - 通过聊天气泡、状态图标展示 AI 的思考过程和执行结果
- **用户输入** - 支持点击角色触发快捷操作，向 AI 发送指令

#### 2. 实时监控状态
- **会话进展同步** - 实时监控 OpenClaw 会话状态
- **思考中** - 显示思考动画，让用户感知 AI 正在处理
- **执行工具中** - 显示工作动画，展示 AI 正在调用工具
- **等待响应** - 空闲状态动画，角色待机行为

#### 3. 情感锚定
- **沉浸式角色扮演** - AI 不再是冷冰冰的对话框，而是有"实体"的伙伴
- **情感表达** - 通过表情图标、思考泡泡展示 AI 的情绪状态
- **状态反馈** - 收到消息时惊醒、疑惑、开心等情感反应
- **陪伴感** - 长时间工作时的数字伴侣，缓解孤独感

#### 4. OpenClaw 深度集成
- **WebSocket 双向通信** - 低延迟的实时状态同步
- **Hook 机制** - 订阅 OpenClaw 生命周期事件
- **工具调用展示** - 可视化 AI 工具调用过程
- **多渠道消息同步** - 你在飞书等消息渠道发的消息，DeepJelly 也能获取 OpenClaw 的回复并在桌宠上展示
- **无缝对接** - 即插即用，无需修改 OpenClaw 核心代码

#### 5. 安全隐私
- **无云服务** - DeepJelly 不依赖任何云服务
- **本地数据** - 所有数据（角色资源、配置等）均存储在本地电脑
- **隐私保护** - 仅通过本地网络与你自己的 AI 应用（如 OpenClaw）和消息渠道（如飞书）通信

---

## 快速开始

### 环境要求

- **Node.js** >= 18.0.0
- **Rust** (用于 Tauri)
- **系统要求**: Windows 10+, macOS 10.15+, 或 Linux

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run tauri:dev
```

### 构建发布

```bash
npm run tauri:build
```

---

## 基础用法

### 1. 启动 DeepJelly

首次启动会进入引导流程，按提示完成 OpenClaw 集成配置。

### 2. 配置 OpenClaw 连接

输入 OpenClaw 的 IP 地址和端口（默认 18790）：
- **本地开发**: 使用 `127.0.0.1:18790`
- **局域网部署**: 使用 OpenClaw 机器的局域网 IP

### 3. 选择 AI 助手

从列表中选择要绑定的 AI 助手，完成绑定。

### 4. 开始使用

- AI 思考时，角色显示思考动画
- AI 调用工具时，角色显示工作动画
- AI 发送消息时，显示聊天气泡
- 点击角色可触发快捷操作

---

## OpenClaw 集成

DeepJelly 包含 OpenClaw Channel 插件，通过 WebSocket 实现双向通信。

### 安装插件

```bash
# 1. 复制插件到 OpenClaw 扩展目录
cp -r adapters/openclaw ~/.openclaw/extensions/deepjelly

# 2. 安装依赖（只需要 ws）
cd ~/.openclaw/extensions/deepjelly
npm install
```

### 配置 OpenClaw

在 `openclaw.json` 中添加 deepjelly 通道配置：

**本地开发**:
```json
{
  "channels": {
    "deepjelly": {
      "enabled": true,
      "serverHost": "127.0.0.1",
      "serverPort": 18790,
      "autoStart": true
    }
  }
}
```

**局域网部署**:
```json
{
  "channels": {
    "deepjelly": {
      "enabled": true,
      "serverHost": "0.0.0.0",
      "serverPort": 18790,
      "autoStart": true
    }
  }
}
```

> **注意**: 局域网部署需要在防火墙中允许 18790 端口入站连接。

详见 [OpenClaw 插件文档](adapters/openclaw/README.md)

---

## 基础技术架构

### 系统分层

```
┌─────────────────────────────────────────────────────────┐
│                      表现层                              │
│  角色视窗 │ 状态气泡 │ 聊天气泡 │ 消息通知 │ 托盘设置   │
└─────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────┐
│                      逻辑层                              │
│  感知收集 │ 路由分发 │ 角色管理 │ 状态持存               │
└─────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────┐
│                      网关层                              │
│  WebSocket 服务 │ 协议校验 │ 南北向路由 │ 隧道穿透      │
└─────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────┐
│                      大脑层（外部）                       │
│  OpenClaw │ Claude Code │ 其他 AI 应用                  │
└─────────────────────────────────────────────────────────┘
```

### 技术栈

| 类别 | 技术 | 用途 |
|------|------|------|
| 桌面框架 | Tauri 2.0 | 跨平台桌面应用 |
| 前端框架 | React 18 | 用户界面 |
| 语言 | TypeScript | 类型安全 |
| 渲染引擎 | Pixi.js 8 | 2D 精灵图动画 |
| 状态管理 | Zustand | 前端状态管理 |
| 国际化 | i18next | 多语言支持 |
| 通信协议 | WebSocket | 实时双向通信 |

### OpenClaw 集成机制

- **Hook 系统** - 订阅 OpenClaw 生命周期事件（会话开始/结束、工具调用等）
- **WebSocket 通道** - 低延迟的实时状态同步
- **CAP 协议** - 统一的消息格式（Character Animation Protocol）

---

## 项目结构

```
DeepJelly/
├── src/                      # 前端源码 (React + TypeScript)
│   ├── components/           # React 组件
│   │   ├── Onboarding/       # 引导流程
│   │   ├── CharacterWindow/  # 角色视窗
│   │   ├── ChatBubble/       # 聊天气泡
│   │   ├── SettingsPanel/    # 设置面板
│   │   └── ...
│   ├── stores/               # Zustand 状态管理
│   ├── utils/                # 工具函数
│   └── types/                # TypeScript 类型
├── src-tauri/                # Tauri 后端 (Rust)
│   ├── src/                  # Rust 源码
│   └── icons/                # 应用图标
├── adapters/                 # AI 应用适配器
│   └── openclaw/             # OpenClaw 插件
│       ├── src/              # 插件源码
│       │   ├── server.ts     # WebSocket 服务器
│       │   ├── converter.ts  # CAP 消息转换
│       │   └── tools.ts      # Agent 工具
│       └── README.md         # 插件文档
└── test/                     # 测试文件
```

---

## 开发指南

### 运行测试

```bash
# 运行所有测试
npm test

# 测试 OpenClaw 插件
npm run test:openclaw

# 测试覆盖率
npm run test:coverage
```

### 代码规范

项目使用 ESLint 进行代码检查，确保提交前通过检查：

```bash
npm run lint
```

---

## 未来规划

### 1. 丰富集成

- **更多 AI 应用** - 支持 Claude Code、ChatGPT、Cursor 等 AI 开发工具
- **多角色多形象** - 支持多个助手、多个角色、多个形象同时存在
- **会话绑定** - 不同形象绑定同一个 AI 的不同会话，实现多任务并行
- **自定义外观** - 用户可导入自定义角色资源（Live2D、VRM 等）

### 2. 移动端

- **手机伴侣** - 时刻拥有你的 TA 的陪伴
- **跨端同步** - 桌面和移动端状态同步
- **消息推送** - AI 助手的重要消息实时推送到手机
- **快捷操作** - 手机端远程控制桌面 AI 助手

---

## 许可证

[MIT](LICENSE)

> **版权声明**: `data/` 目录下的默认角色 Christina 图片素材受版权保护，**禁止商用**。仅供个人学习和非商业用途使用。

---

## 致谢

- [Tauri](https://tauri.app/) - 跨平台桌面应用框架
- [Pixi.js](https://pixijs.com/) - 强大的 2D WebGL 渲染引擎
- [React](https://react.dev/) - 用户界面 JavaScript 库
- [OpenClaw](https://github.com/openclaw-china/openclaw) - AI 应用开发框架

---

## 联系方式

- **GitHub**: [https://github.com/GinSing1226/DeepJelly](https://github.com/GinSing1226/DeepJelly)

---

<div align="center">
Made with ❤️ by DeepJelly Team
</div>
