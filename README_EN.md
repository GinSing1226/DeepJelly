# DeepJelly

<div align="center">

**Bring AI to Life on Your Desktop**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131?logo=tauri)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)

English | [简体中文](README.md) | [AI Guide](README_AGENT.md)

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

#### 4. Multi-Assistant, Multi-Character, Multi-Avatar
- **Multi-Assistant Management** - Support managing multiple AI assistants
- **Multi-Character Binding** - For OpenClaw, one Agent is one assistant, Agent's sessionKey is one character
- **Multi-Avatar Switching** - Configure different virtual appearances for different characters
- **Multi-Team Display** - Display OpenClaw multi-teams on desktop with real-time observation of changes and conversation content

#### 5. Multi-Character Desktop Display
- **Simultaneous Display** - Display multiple characters on one desktop
- **Independent Response** - Each character responds to its bound Agent
- **Position Management** - Support dragging to adjust character positions

#### 6. AI Skill Automation
- **Automated Integration** - AI can automate DeepJelly operations through Skills
- **Integration Management** - Help you manage assistant, character, and avatar binding relationships
- **Zero-Configuration Setup** - AI Agent can self-complete DeepJelly integration configuration

#### 7. Deep OpenClaw Integration
- **WebSocket Bidirectional Communication** - Low-latency real-time status synchronization
- **Hook Mechanism** - Subscribe to OpenClaw lifecycle events
- **Tool Call Visualization** - Visualize AI tool invocation process
- **Multi-Channel Message Sync** - Messages you send via Feishu and other messaging channels will also receive OpenClaw replies displayed on the desktop pet
- **Seamless Integration** - Plug and play, no need to modify OpenClaw core code

#### 8. Security & Privacy
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

First launch will enter the onboarding flow. Follow the prompts to complete integration configuration.

### 2. Configure AI App Connection

In the onboarding page, select the AI app to integrate (currently supports OpenClaw):

- **IP Address**: Enter the AI app's IP address
  - Use `127.0.0.1` for local development
  - Use the AI app machine's LAN IP for LAN deployment
- **Port**: Default `18790` (or custom port)
- **Auth Token**: Optional, fill in if the AI app requires authentication

### 3. Configure Skills (Optional)

If using OpenClaw, you can install DeepJelly Skills for AI-automated integration:

1. Create a `skills` folder in the OpenClaw root directory
2. Download `deepjelly-integrate` and `deepjelly-character` skills
3. Modify `openclaw.json` to add skill loading path
4. Get DeepJelly API info from onboarding page and configure to skill's `config.md`

See [AI Installation Guide](README_AGENT.md)

### 4. Bind Assistants and Characters

1. **Select Assistant** - Choose the AI assistant to bind from the list (for OpenClaw, one Agent is one assistant)
2. **Select Character** - Choose the assistant's session (sessionKey) as the character
3. **Select Avatar** - Choose a virtual appearance for the character
4. **Complete Binding** - After saving, the character will appear on the desktop

### 5. Multi-Character Management

- **Add More Characters** - Add new binding relationships in settings
- **Adjust Positions** - Drag characters to any position on the desktop
- **Switch Avatars** - Configure different appearances for different characters

### 6. Start Using

- When AI is thinking, the character displays thinking animation
- When AI calls tools, the character displays working animation
- When AI sends messages, chat bubble is displayed
- Click the character to trigger quick actions
- Multiple characters respond to their respective bound Agents simultaneously

---

## OpenClaw Integration

DeepJelly provides OpenClaw Channel plugin and AI Skills for deep bidirectional integration.

### Method 1: Manual Configuration

#### 1. Install Plugin

```bash
# Download plugin
wget https://github.com/GinSing1226/DeepJelly/releases/download/deepjelly-V0.1.0/deepjelly-openclaw-plugin.zip

# Extract to OpenClaw extensions directory
unzip deepjelly-openclaw-plugin.zip -d ~/.openclaw/extensions/
mv ~/.openclaw/extensions/deepjelly-openclaw-plugin ~/.openclaw/extensions/deepjelly
```

**Windows (PowerShell)**:
```powershell
Invoke-WebRequest -Uri "https://github.com/GinSing1226/DeepJelly/releases/download/deepjelly-V0.1.0/deepjelly-openclaw-plugin.zip" -OutFile "deepjelly-openclaw-plugin.zip"
Expand-Archive -Path "deepjelly-openclaw-plugin.zip" -DestinationPath "$env:USERPROFILE\.openclaw\extensions\"
Rename-Item "$env:USERPROFILE\.openclaw\extensions\deepjelly-openclaw-plugin" "$env:USERPROFILE\.openclaw\extensions\deepjelly"
```

#### 2. Configure OpenClaw

Add deepjelly channel in `openclaw.json`:

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
      "serverHost": "192.168.10.128",
      "serverPort": 18790,
      "autoStart": true
    }
  }
}
```

> **Note**: For LAN deployment, use the OpenClaw machine's LAN IP for `serverHost`, **NOT** `0.0.0.0`.

### Method 2: AI Auto-Configuration (Recommended)

Send the following prompt to OpenClaw AI, and it will automatically complete plugin installation and configuration:

```
Please help me integrate with DeepJelly:

## Step 1: Install deepjelly plugin

Read the following documentation to install the deepjelly plugin for OpenClaw
https://github.com/GinSing1226/DeepJelly/blob/main/adapters/openclaw/README.md

## Step 2: Install deepjelly skills

Create a skills folder in the OpenClaw root directory. Then put the deepjelly-integrate and deepjelly-character skill folders into this folder

Then, modify openclaw.json to add skills.load.extraDirs
Example structure:
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

## Step 3: Save endpoint data

Save the endpoint data I send you to the config.md files of both skills. Both skills need this data.

## Step 4: Reply to user

Finally, tell me your IP address (LAN IP) and port (the port you're listening on, e.g., 18790).
Reply to me first, then execute a command: automatically restart gateway in 20s.
```

### Configure Firewall

LAN deployment requires opening the port:

**Windows (PowerShell - Administrator)**:
```powershell
New-NetFirewallRule -DisplayName "DeepJelly OpenClaw" -Direction Inbound -LocalPort 18790 -Protocol TCP -Action Allow
```

**Linux (ufw)**:
```bash
sudo ufw allow 18790/tcp
```

### Detailed Documentation

- [Plugin Installation Guide](adapters/openclaw/README.md)
- [AI Installation Guide](README_AGENT.md)

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
│       └── README.md         # Plugin documentation
├── skills/                   # AI skills (for OpenClaw and other AI apps)
│   ├── deepjelly-integrate/  # Integration management skill
│   └── deepjelly-character/  # Character control skill
├── test/                     # Test files
├── README.md                 # Chinese documentation
├── README_EN.md              # English documentation
└── README_AGENT.md           # AI Agent installation guide
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
- **More Appearance Types** - Support rendering Live2D

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
