# DeepJelly OpenClaw Plugin

> DeepJelly 的 OpenClaw Channel 插件 - 将 AI 助手连接到桌面虚拟形象

---

## 📦 快速安装

### 方法一：使用安装脚本（推荐）

```bash
# 在 DeepJelly 项目根目录执行
cd adapters/openclaw
npm run install:openclaw
```

### 方法二：手动安装

```bash
# 1. 复制插件文件到 OpenClaw 扩展目录（只复制必要文件）
cd adapters/openclaw
mkdir -p ~/.openclaw/extensions/deepjelly
cp -r src dist openclaw.plugin.json README.md ~/.openclaw/extensions/deepjelly/

# 2. 在目标目录安装依赖（只需要 ws）
cd ~/.openclaw/extensions/deepjelly
npm install --production

# 3. 启动 OpenClaw
openclaw start
```

**重要说明**：
- **不要复制 `node_modules` 文件夹** - OpenClaw 已有自己的依赖
- 使用 `--production` 标志只安装运行时依赖（ws），跳过开发依赖

### 验证安装

```bash
# 查看连接状态
openclaw deepjelly status
```

---

## 🌐 网络配置

### 本地开发（同一台机器）

**防火墙**: 无需配置

**OpenClaw 配置** (`openclaw.json`):
```json
{
  "channels": {
    "deepjelly": {
      "enabled": true,
      "serverHost": "127.0.0.1",
      "serverPort": 18790,
      "autoStart": true,
      "applicationId": "deepjelly为openclaw生成的应用id",
      "accounts": {
        "agent:christina:main": {
          "assistantId": "work_assistant",
          "characterId": "char_feishu_private"
        },
        "agent:christina:group": {
          "assistantId": "work_assistant",
          "characterId": "char_feishu_group"
        }
      }
    }
  }
}
```

**accounts 配置说明**:
- **键**: sessionKey（OpenClaw的会话标识）
- **assistantId**: DeepJelly的助手ID（便于逻辑分组）
- **characterId**: DeepJelly的角色ID（用于消息路由）

**DeepJelly 连接**: `ws://127.0.0.1:18790`

### 局域网部署（不同机器）

**防火墙**: 需要允许 18790 端口入站连接

**OpenClaw 配置** (`openclaw.json`):
```json
{
  "channels": {
    "deepjelly": {
      "enabled": true,
      "serverHost": "0.0.0.0",
      "serverPort": 18790,
      "autoStart": true,
      "applicationId": "deepjelly为openclaw生成的应用id",
      "accounts": {
        "agent:christina:main": {
          "assistantId": "work_assistant",
          "characterId": "char_feishu_private"
        }
      }
    }
  }
}
```

**DeepJelly 连接**: `ws://192.168.10.128:18790`（OpenClaw 机器的局域网 IP）

---

## 📚 依赖

本项目仅需一个运行时依赖：

```json
{
  "dependencies": {
    "ws": "^8.18.0"
  }
}
```

安装依赖：
```bash
cd adapters/openclaw
npm install
```

---

## 📖 使用方法

安装插件后，按照 DeepJelly 引导页的步骤进行集成即可：

1. 启动 DeepJelly 应用
2. 进入引导页，输入 OpenClaw 的 IP 地址和端口（默认 18790）
3. 选择要绑定的助手
4. 完成集成

**引导页代码参考**: [src/components/Onboarding/steps/InputEndpointStep.tsx](../../src/components/Onboarding/steps/InputEndpointStep.tsx)

---

## 🔗 相关链接

- **DeepJelly 主项目**: [https://github.com/GinSing1226/DeepJelly](https://github.com/GinSing1226/DeepJelly)

---

## 📄 License

MIT

---

> **提示**: 本插件作为 DeepJelly 项目的一部分（位于 `adapters/openclaw` 目录），无需单独开源仓库。
