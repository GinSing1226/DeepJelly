# DeepJelly

<div align="center">

**让 AI 以虚拟形象出现在你的桌面上**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131?logo=tauri)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)

[English](README_EN.md) | 简体中文 | [AI版](README_AGENT.md)

</div>

---

## 简介

**DeepJelly** 是一款跨平台桌面虚拟助手（桌面宠物），为 AI Agent 提供可视化的"物理化身"。它让隐藏在后台的 AI 以生动的虚拟形象出现在桌面上，通过动画、表情和气泡与用户交互，将单纯的工具箱跃升为桌面上能真实感知的"赛博伴侣"。



<img width="438" height="349" alt="image" src="https://github.com/user-attachments/assets/fe86de9c-ac51-4a42-b4b2-94027557ed45" />
<img width="553" height="509" alt="image" src="https://github.com/user-attachments/assets/abbdcdac-b05c-45fe-96af-bbdf9efe9645" />
<img width="731" height="496" alt="image" src="https://github.com/user-attachments/assets/9ae7fe31-9438-430f-9e6d-faa7d139664d" />


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

#### 4. 多助手、多角色、多形象
- **多助手管理** - 支持管理多个 AI 助手
- **多角色绑定** - 对于 OpenClaw，一个 Agent 就是一个助手，Agent 的 sessionKey 就是一个角色
- **多形象切换** - 可为不同角色配置不同的虚拟形象
- **多团队展示** - 将 OpenClaw 多团队在桌面展示，实时观测变化和会话内容

#### 5. 多角色桌面展示
- **同时展示多个角色** - 一个桌面可以同时展示多个角色
- **独立响应** - 每个角色响应各自绑定的 Agent
- **位置管理** - 支持拖拽调整角色位置

#### 6. AI Skill 自动化
- **自动化集成** - AI 通过 Skill 可以自动化操作 DeepJelly
- **集成管理** - 帮助你管理助手、角色、形象的绑定关系
- **零配置接入** - AI Agent 可自助完成 DeepJelly 集成配置

#### 7. OpenClaw 深度集成
- **WebSocket 双向通信** - 低延迟的实时状态同步
- **Hook 机制** - 订阅 OpenClaw 生命周期事件
- **工具调用展示** - 可视化 AI 工具调用过程
- **多渠道消息同步** - 你在飞书等消息渠道发的消息，DeepJelly 也能获取 OpenClaw 的回复并在桌宠上展示
- **无缝对接** - 即插即用，无需修改 OpenClaw 核心代码

#### 8. 安全隐私
- **无云服务** - DeepJelly 不依赖任何云服务
- **本地数据** - 所有数据（角色资源、配置等）均存储在本地电脑
- **隐私保护** - 仅通过本地网络与你自己的 AI 应用（如 OpenClaw）和消息渠道（如飞书）通信

---

## 快速开始

### 一键安装（从零开始）

**Windows (PowerShell)**:
```powershell
git clone https://github.com/GinSing1226/DeepJelly.git; irm https://rustup.rs | iex; cd DeepJelly; npm install
```

**macOS**:
```bash
git clone https://github.com/GinSing1226/DeepJelly.git && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh && cd DeepJelly && source $HOME/.cargo/env && brew install openssl libgtk-3-dev && npm install
```

**Linux (Ubuntu/Debian)**:
```bash
git clone https://github.com/GinSing1226/DeepJelly.git && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh && cd DeepJelly && source $HOME/.cargo/env && sudo apt update && sudo apt install -y libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev libappindicator3-dev librsvg2-dev && npm install
```

> **提示**: Rust 安装后需要重启终端或运行 `source $HOME/.cargo/env`

### 环境要求

- **Node.js** >= 18.0.0
- **Rust** (用于 Tauri)
- **系统要求**: Windows 10+, macOS 10.15+, 或 Linux

### 开发模式

```bash
cd DeepJelly
npm run tauri:dev
```

### 构建发布

```bash
npm run tauri:build
```

---

## 基础用法

### 1. 启动 DeepJelly

首次启动会进入引导流程，按提示完成集成配置。

### 2. 配置 AI 应用连接

在引导页面中选择要集成的 AI 应用（目前支持 OpenClaw）：

- **IP 地址**: 填写 AI 应用的 IP 地址
  - 本地开发使用 `127.0.0.1`
  - 局域网部署使用 AI 应用机器的局域网 IP
- **端口**: 默认 `18790`（或自定义端口）
- **认证令牌**: 可选，如果 AI 应用需要认证则填写

### 3. 配置技能（可选）

如果使用 OpenClaw，可以安装 DeepJelly Skill 实现 AI 自动化集成：

1. 在 OpenClaw 根目录创建 `skills` 文件夹
2. 下载 `deepjelly-integrate` 和 `deepjelly-character` 技能
3. 修改 `openclaw.json` 添加技能加载路径
4. 从引导页获取 DeepJelly API 信息并配置到技能的 `config.md`

详见 [AI 安装指南](README_AGENT.md)

### 4. 绑定助手和角色

1. **选择助手** - 从列表中选择要绑定的 AI 助手（对于 OpenClaw，一个 Agent 就是一个助手）
2. **选择角色** - 选择该助手的会话（sessionKey）作为角色
3. **选择形象** - 为该角色选择虚拟形象外观
4. **完成绑定** - 保存配置后，角色会显示在桌面上

### 5. 多角色管理

- **添加更多角色** - 在设置中添加新的绑定关系
- **调整位置** - 拖拽角色到桌面的任意位置
- **切换形象** - 为不同角色配置不同的外观

### 6. 开始使用

- AI 思考时，角色显示思考动画
- AI 调用工具时，角色显示工作动画
- AI 发送消息时，显示聊天气泡
- 点击角色可触发快捷操作
- 多个角色会同时响应各自绑定的 Agent

---

## OpenClaw 集成

DeepJelly 提供 OpenClaw Channel 插件和 AI Skill，实现深度双向集成。

### 方式一：手动配置

#### 1. 安装插件

```bash
# 下载插件
wget https://github.com/GinSing1226/DeepJelly/releases/download/deepjelly-V0.1.0/deepjelly-openclaw-plugin.zip

# 解压到 OpenClaw 扩展目录
unzip deepjelly-openclaw-plugin.zip -d ~/.openclaw/extensions/
mv ~/.openclaw/extensions/deepjelly-openclaw-plugin ~/.openclaw/extensions/deepjelly
```

**Windows (PowerShell)**:
```powershell
Invoke-WebRequest -Uri "https://github.com/GinSing1226/DeepJelly/releases/download/deepjelly-V0.1.0/deepjelly-openclaw-plugin.zip" -OutFile "deepjelly-openclaw-plugin.zip"
Expand-Archive -Path "deepjelly-openclaw-plugin.zip" -DestinationPath "$env:USERPROFILE\.openclaw\extensions\"
Rename-Item "$env:USERPROFILE\.openclaw\extensions\deepjelly-openclaw-plugin" "$env:USERPROFILE\.openclaw\extensions\deepjelly"
```

#### 2. 配置 OpenClaw

在 `openclaw.json` 中添加 deepjelly channel：

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
      "serverHost": "192.168.10.128",
      "serverPort": 18790,
      "autoStart": true
    }
  }
}
```

> **注意**: 局域网部署时，`serverHost` 使用 OpenClaw 本机的局域网 IP，**不是** `0.0.0.0`。

### 方式二：AI 自动配置（推荐）

将以下提示词发送给 OpenClaw AI，它会自动完成插件安装和配置：

```
请帮我完成与 DeepJelly 的集成：

## 步骤1：安装deepjelly插件

阅读以下文档，给openclaw安装deepjelly插件
https://github.com/GinSing1226/DeepJelly/blob/main/adapters/openclaw/README.md

## 步骤2：安装deepjelly技能

在openclaw根目录创建skills文件夹。然后将deepjelly-integrate、deepjelly-character两个技能文件夹放进这个文件夹

然后，修改openclaw.json，添加skills.load.extraDirs，
示例结构体如下：
{
  "skills": {
    "load": {
      "extraDirs": [
        "./skills"
      ],
      "watch": true
    }
  }
}

## 步骤3：保存端点数据

将我发给你的端点数据，保存到这两个skill的config.md文件里。两个技能都要保存。

## 步骤4：回复用户

最后，将你的 IP 地址（局域网IP）和端口（你开启监听的端口，例如18790）告诉我。
先回复我，再执行一个命令：20s后自动重启gateway。
```

### 配置防火墙

局域网部署需要开放端口：

**Windows (PowerShell - 管理员)**:
```powershell
New-NetFirewallRule -DisplayName "DeepJelly OpenClaw" -Direction Inbound -LocalPort 18790 -Protocol TCP -Action Allow
```

**Linux (ufw)**:
```bash
sudo ufw allow 18790/tcp
```

### 详细文档

- [插件安装文档](adapters/openclaw/README.md)
- [AI 安装指南](README_AGENT.md)

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
│       └── README.md         # 插件文档
├── skills/                   # AI 技能（供 OpenClaw 等 AI 应用使用）
│   ├── deepjelly-integrate/  # 集成管理技能
│   └── deepjelly-character/  # 角色控制技能
├── test/                     # 测试文件
├── README.md                 # 中文文档
├── README_EN.md              # 英文文档
└── README_AGENT.md           # AI Agent 安装指南
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
- **支持更多种类外观** - 支持渲染 Live2D

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
