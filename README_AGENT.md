# DeepJelly OpenClaw Integration - Agent Installation Guide

> **AI Agent Instructions**: This document is for AI Agents to help users automatically install and configure the integration between DeepJelly and OpenClaw. Follow the steps below precisely, and reply to the user in their preferred language at the end.

本文档用于 AI Agent 帮助用户自动完成 DeepJelly 与 OpenClaw 的集成安装。

## 集成目标

将 DeepJelly 桌面宠物系统与 OpenClaw AI 应用集成，使 OpenClaw 的 Agent 能够控制 DeepJelly 角色的动作和状态。

## 步骤 1：安装 DeepJelly 插件

### 1.1 下载插件

从 GitHub Release 下载最新版本的插件：

```bash
# 下载地址
wget https://github.com/GinSing1226/DeepJelly/releases/download/deepjelly-V0.1.0/deepjelly-openclaw-plugin.zip
```

Windows (PowerShell):
```powershell
Invoke-WebRequest -Uri "https://github.com/GinSing1226/DeepJelly/releases/download/deepjelly-V0.1.0/deepjelly-openclaw-plugin.zip" -OutFile "deepjelly-openclaw-plugin.zip"
```

### 1.2 解压到 OpenClaw 扩展目录

**Linux/macOS**:
```bash
# 解压到扩展目录
unzip deepjelly-openclaw-plugin.zip -d ~/.openclaw/extensions/

# 重命名文件夹
mv ~/.openclaw/extensions/deepjelly-openclaw-plugin ~/.openclaw/extensions/deepjelly
```

**Windows (PowerShell)**:
```powershell
# 解压
Expand-Archive -Path "deepjelly-openclaw-plugin.zip" -DestinationPath "$env:USERPROFILE\.openclaw\extensions\"

# 重命名文件夹
Rename-Item "$env:USERPROFILE\.openclaw\extensions\deepjelly-openclaw-plugin" "$env:USERPROFILE\.openclaw\extensions\deepjelly"
```

### 1.3 验证安装

检查以下文件是否存在：
- `~/.openclaw/extensions/deepjelly/openclaw.plugin.json`
- `~/.openclaw/extensions/deepjelly/src/index.js`
- `~/.openclaw/extensions/deepjelly/dist/index.js`

**注意**：插件使用 OpenClaw 主依赖中的 `ws`，无需单独 `npm install`

## 步骤 2：安装 DeepJelly 技能

### 2.1 创建技能目录

在 OpenClaw 根目录创建 `skills` 文件夹：

**Linux/macOS**:
```bash
# 假设 OpenClaw 安装在 /opt/openclaw
mkdir -p /opt/openclaw/skills
```

**Windows**:
```powershell
# 假设 OpenClaw 安装在 C:\OpenClaw
mkdir C:\OpenClaw\skills
```

### 2.2 下载技能文件

从 DeepJelly 仓库下载技能文件：

```bash
# 克隆仓库（或只下载 skills 目录）
git clone --depth 1 --filter=blob:none --sparse https://github.com/GinSing1226/DeepJelly.git
cd DeepJelly
git sparse-checkout set skills
```

或者直接下载两个技能文件夹：
- `deepjelly-integrate`
- `deepjelly-character`

将这两个文件夹复制到步骤 2.1 创建的 `skills` 目录中。

### 2.3 配置 openclaw.json

编辑 OpenClaw 配置文件 `openclaw.json`，添加技能加载路径：

```json
{
  "skills": {
    "load": {
      "extraDirs": [
        "./skills"                    // OpenClaw 根目录下的 skills 文件夹
        // 或其他相对路径，如 "../openclaw/skills"
      ],
      "watch": true
    }
  }
}
```

**注意**：支持相对路径和绝对路径。建议使用相对于 OpenClaw 工作目录的相对路径。

## 步骤 3：获取 DeepJelly 连接信息

### 3.1 引导用户启动 DeepJelly

让用户启动 DeepJelly 应用：

**方式一：使用已安装的应用**
```
请打开 DeepJelly 桌面应用
```

**方式二：使用开发环境**
```bash
# 进入 DeepJelly 项目目录
cd /path/to/DeepJelly

# 启动开发环境
npm run tauri:dev
```

### 3.2 引导用户进入集成引导页

应用启动后，引导用户完成以下操作：

1. 如果是首次启动，会自动显示**集成引导页**
2. 如果已跳过引导，可通过以下路径进入：
   - **设置 → 集成管理 → 添加集成**
   - 或点击界面上的**集成提示**按钮

### 3.3 从集成引导页获取连接参数

引导用户在集成引导页中：

1. **选择应用类型**：选择 "OpenClaw"
2. **填写连接信息**：
   - **IP 地址**：填写 OpenClaw 所在机器的局域网 IP（如 `192.168.10.128`）或 `127.0.0.1`（同机器）
   - **端口**：默认 `18790`，或自定义端口
   - **认证令牌**：可选，如果 OpenClaw 需要认证则填写
3. **点击连接**，验证连接成功
4. **记录 DeepJelly 配置信息**（在页面下方显示）：
   - **DeepJelly API 地址**：如 `127.0.0.1`
   - **DeepJelly API 端口**：如 `12261`
   - **DeepJelly API Token**：32位随机字符串

让用户将这三个参数告诉你，用于后续配置。

### 3.4 配置技能文件

将获取的连接参数保存到两个技能的 `config.md` 文件中：

1. `skills/deepjelly-integrate/config.md`
2. `skills/deepjelly-character/config.md`

每个 `config.md` 文件应包含：

````markdown
# DeepJelly 集成配置文件

## API 配置

### 服务器地址
```
用户提供的DeepJelly API地址
```

### 端口
```
用户提供的DeepJelly API端口
```

### 认证令牌 (Bearer Token)
```
用户提供的DeepJelly API Token
```
````

## 步骤 4：配置网络监听

### 4.1 获取本机局域网 IP

**Windows**:
```powershell
ipconfig
# 查找 "IPv4 地址"，例如：192.168.10.128
```

**Linux/macOS**:
```bash
ip addr show
# 或
hostname -I
```

### 4.2 配置防火墙规则

**Windows (PowerShell - 管理员运行)**:
```powershell
New-NetFirewallRule -DisplayName "DeepJelly OpenClaw" -Direction Inbound -LocalPort 18790 -Protocol TCP -Action Allow
```

**Linux (ufw)**:
```bash
sudo ufw allow 18790/tcp
```

### 4.3 配置 OpenClaw channels

编辑 `openclaw.json`，添加 deepjelly channel：

**本地开发（同机器）**:
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

**局域网部署（不同机器）**:
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

**注意**：
- 本地使用 `127.0.0.1`
- 局域网使用 **OpenClaw 本机的局域网 IP**（不是 `0.0.0.0`）

## 步骤 5：完成并重启

### 5.1 回复用户

在重启网关之前，**必须先**向用户报告以下信息：

```
✅ DeepJelly 集成配置完成！

配置摘要：
• 插件安装路径：~/.openclaw/extensions/deepjelly
• 技能加载路径：[skills 目录路径]
• DeepJelly API：http://[服务器地址]:[端口]
• OpenClaw 监听：ws://[本机IP]:18790

20秒后将自动重启 OpenClaw Gateway 使配置生效。
```

### 5.2 延迟重启

在回复用户后，执行延迟重启命令：

**Linux/macOS**:
```bash
sleep 20 && openclaw-gateway restart
```

**Windows**:
```powershell
Start-Sleep -Seconds 20; Restart-Service -Name "OpenClawGateway"
# 或使用任务计划程序
```

## 验证清单

完成配置后，确认以下检查项：

- [ ] 插件文件夹 `~/.openclaw/extensions/deepjelly` 存在且包含必要文件
- [ ] 技能文件夹 `skills/deepjelly-integrate` 和 `skills/deepjelly-character` 存在
- [ ] `openclaw.json` 包含 `skills.load.extraDirs` 配置
- [ ] 两个技能的 `config.md` 都包含正确的服务器地址、端口和 Token
- [ ] `openclaw.json` 包含 `channels.deepjelly` 配置
- [ ] 防火墙规则允许端口 18790 入站
- [ ] 已向用户报告配置摘要并安排重启

## 常见问题处理

### 端口被占用
```bash
# 检查端口占用
lsof -i :18790  # Linux/macOS
netstat -ano | findstr :18790  # Windows

# 更换端口并同步更新 DeepJelly 配置
```

### 技能加载失败
- 检查 `skills.load.extraDirs` 是否为有效路径（相对或绝对）
- 确认路径使用正斜杠 `/` 或双反斜杠 `\`
- 检查技能文件夹中是否包含有效的 `SKILL.md` 和 `config.md`

### 连接失败
- 确认 DeepJelly 应用已运行
- 检查防火墙规则
- 验证 IP 地址和端口配置正确

---

**版本**: V0.1.0  
**最后更新**: 2025-03-14
