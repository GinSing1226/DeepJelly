# DeepJelly OpenClaw Plugin

> DeepJelly 的 OpenClaw Channel 插件 - 将 AI 助手连接到桌面虚拟形象

---

## 📦 快速安装

### 最简单的安装方法

```bash
# 1. 复制整个插件文件夹到 OpenClaw 扩展目录
cp -r adapters/openclaw ~/.openclaw/extensions/deepjelly

# 2. 安装依赖（只需要 ws）
cd ~/.openclaw/extensions/deepjelly
npm install

# 3. 启动 OpenClaw
openclaw start
```

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
        "openclaw的agent id": {
          "assistantId": "deepjelly的助手id"
        }
      }
    }
  }
}
```

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
        "openclaw的agent id": {
          "assistantId": "deepjelly的助手id"
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
