# DeepJelly

<div align="center">

**Bring AI to Life on Your Desktop**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131?logo=tauri)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)

English | [简体中文](README.md)

</div>

---

## Introduction

**DeepJelly** is a cross-platform desktop virtual assistant (desktop pet) that provides a visual "physical avatar" for AI Agents. It brings background AI to your desktop as vivid virtual characters that interact with users through animations, expressions, and bubbles—transforming from a simple toolbox into a perceptible "cyber companion" on your desktop.

<img width="438" height="349" alt="image" src="https://github.com/user-attachments/assets/fe86de9c-ac51-4a42-b4b2-94027557ed45" />

<img width="553" height="509" alt="image" src="https://github.com/user-attachments/assets/abbdcdac-b05c-45fe-96af-bbdf9efe9645" />

<img width="731" height="496" alt="image" src="https://github.com/user-attachments/assets/9ae7fe31-9438-430f-9e6d-faa7d139664d" />

### Core Features

#### 1. Virtual Avatar
- **Custom AI Avatar** - Supports sprite animation with customizable character appearance
- **Custom Character** - Configure your favorite character, upload different images/GIFs for different actions (images can be AI-generated continuous sprite sheets)
- **Display AI Output** - Show AI's thinking process and execution results through chat bubbles and status icons
- **User Input** - Click the character to trigger quick actions and send commands to AI

#### 2. Real-time Status Monitoring
- **Session Progress Sync** - Real-time monitoring of OpenClaw session status
- **Thinking** - Display thinking animation to let users perceive AI is processing
- **Executing Tools** - Display working animation to show AI is calling tools
- **Waiting Response** - Idle state animation, character standby behavior

#### 3. Emotional Anchoring
- **Immersive Role-playing** - AI is no longer a cold dialog box, but a companion with "physical form"
- **Emotional Expression** - Display AI's emotional state through expression icons and thought bubbles
- **Status Feedback** - Emotional reactions like surprise, confusion, happiness when receiving messages
- **Companionship** - Digital companion during long work hours, relieving loneliness

#### 4. Deep OpenClaw Integration
- **WebSocket Bidirectional Communication** - Low-latency real-time status synchronization
- **Hook Mechanism** - Subscribe to OpenClaw lifecycle events
- **Tool Call Visualization** - Visualize AI tool invocation process
- **Multi-Channel Message Sync** - Messages you send via Feishu and other messaging channels will also receive OpenClaw replies displayed on the desktop pet
- **Seamless Integration** - Plug and play, no need to modify OpenClaw core code

#### 5. Security & Privacy
- **No Cloud Services** - DeepJelly does not rely on any cloud services
- **Local Data** - All data (character resources, configurations, etc.) are stored locally on your computer
- **Privacy Protection** - Only communicates via local network with your own AI apps (like OpenClaw) and messaging channels (like Feishu)

---

## Quick Start

### One-Command Installation (from scratch)

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

> **Note**: After installing Rust, restart your terminal or run `source $HOME/.cargo/env`

### Requirements

- **Node.js** >= 18.0.0
- **Rust** (for Tauri)
- **System Requirements**: Windows 10+, macOS 10.15+, or Linux

### Development Mode

```bash
cd DeepJelly
npm run tauri:dev
```

### Build Release

```bash
npm run tauri:build
```

---

## Basic Usage

### 1. Launch DeepJelly

First launch will enter the onboarding flow. Follow the prompts to complete OpenClaw integration configuration.

### 2. Configure OpenClaw Connection

Enter OpenClaw's IP address and port (default 18790):
- **Local Development**: Use `127.0.0.1:18790`
- **LAN Deployment**: Use the LAN IP of the OpenClaw machine

### 3. Select AI Assistant

Choose the AI assistant to bind from the list and complete binding.

### 4. Start Using

- When AI is thinking, the character displays thinking animation
- When AI calls tools, the character displays working animation
- When AI sends messages, chat bubble is displayed
- Click the character to trigger quick actions

---

## OpenClaw Integration

DeepJelly includes an OpenClaw Channel plugin that enables bidirectional communication via WebSocket.

### Install Plugin

```bash
# 1. Copy plugin to OpenClaw extensions directory
cp -r adapters/openclaw ~/.openclaw/extensions/deepjelly

# 2. Install dependencies (only needs ws)
cd ~/.openclaw/extensions/deepjelly
npm install
```

### Configure OpenClaw

Add deepjelly channel configuration in `openclaw.json`:

**Local Development**:
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

**LAN Deployment**:
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

> **Note**: LAN deployment requires allowing port 18790 inbound connections in firewall.

See [OpenClaw Plugin Documentation](adapters/openclaw/README.md) for details

---

## Basic Technical Architecture

### System Layers

```
┌─────────────────────────────────────────────────────────┐
│                   Presentation Layer                     │
│  Character Window │ Status Bubble │ Chat Bubble │       │
│  Message Notification │ Tray Settings                   │
└─────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────┐
│                      Logic Layer                         │
│  Perception Collection │ Routing │ Character            │
│  Management │ State Persistence                          │
└─────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────┐
│                    Gateway Layer                         │
│  WebSocket Service │ Protocol Validation │              │
│  North-South Routing │ Tunnel Penetration               │
└─────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────┐
│                  Brain Layer (External)                  │
│  OpenClaw │ Claude Code │ Other AI Apps                  │
└─────────────────────────────────────────────────────────┘
```

### Tech Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| Desktop Framework | Tauri 2.0 | Cross-platform desktop app |
| Frontend Framework | React 18 | User interface |
| Language | TypeScript | Type safety |
| Rendering Engine | Pixi.js 8 | 2D sprite animation |
| State Management | Zustand | Frontend state management |
| Internationalization | i18next | Multi-language support |
| Communication Protocol | WebSocket | Real-time bidirectional communication |

### OpenClaw Integration Mechanism

- **Hook System** - Subscribe to OpenClaw lifecycle events (session start/end, tool calls, etc.)
- **WebSocket Channel** - Low-latency real-time status synchronization
- **CAP Protocol** - Unified message format (Character Animation Protocol)

---

## Project Structure

```
DeepJelly/
├── src/                      # Frontend source (React + TypeScript)
│   ├── components/           # React components
│   │   ├── Onboarding/       # Onboarding flow
│   │   ├── CharacterWindow/  # Character window
│   │   ├── ChatBubble/       # Chat bubble
│   │   ├── SettingsPanel/    # Settings panel
│   │   └── ...
│   ├── stores/               # Zustand state management
│   ├── utils/                # Utility functions
│   └── types/                # TypeScript types
├── src-tauri/                # Tauri backend (Rust)
│   ├── src/                  # Rust source
│   └── icons/                # App icons
├── adapters/                 # AI app adapters
│   └── openclaw/             # OpenClaw plugin
│       ├── src/              # Plugin source
│       │   ├── server.ts     # WebSocket server
│       │   ├── converter.ts  # CAP message conversion
│       │   └── tools.ts      # Agent tools
│       └── README.md         # Plugin documentation
└── test/                     # Test files
```

---

## Development Guide

### Running Tests

```bash
# Run all tests
npm test

# Test OpenClaw plugin
npm run test:openclaw

# Test coverage
npm run test:coverage
```

### Code Style

The project uses ESLint for code checking. Ensure passing checks before committing:

```bash
npm run lint
```

---

## Future Plans

### 1. Rich Integration

- **More AI Apps** - Support Claude Code, ChatGPT, Cursor and other AI development tools
- **Multi-Character & Multi-Avatar** - Support multiple assistants, multiple characters, multiple avatars simultaneously
- **Session Binding** - Different avatars bind to different sessions of the same AI for multi-task parallelism
- **Custom Appearance** - Users can import custom character resources (Live2D, VRM, etc.)

### 2. Mobile

- **Mobile Companion** - Always have your TA's companionship
- **Cross-Device Sync** - Sync desktop and mobile status
- **Message Push** - Real-time push of important messages from AI assistant to phone
- **Quick Actions** - Remote control desktop AI assistant from mobile

---

## License

[MIT](LICENSE)

> **Copyright Notice**: The default character Christina image assets in the `data/` directory are copyrighted and **commercial use is prohibited**. For personal learning and non-commercial use only.

---

## Acknowledgments

- [Tauri](https://tauri.app/) - Cross-platform desktop application framework
- [Pixi.js](https://pixijs.com/) - Powerful 2D WebGL rendering engine
- [React](https://react.dev/) - User interface JavaScript library
- [OpenClaw](https://github.com/openclaw-china/openclaw) - AI application development framework

---

## Contact

- **GitHub**: [https://github.com/GinSing1226/DeepJelly](https://github.com/GinSing1226/DeepJelly)

---

<div align="center">
Made with ❤️ by DeepJelly Team
</div>
