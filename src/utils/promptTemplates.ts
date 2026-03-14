/**
 * Prompt Templates
 *
 * AI应用集成提示词模板
 * @module utils/promptTemplates
 */

import type { AIAppType } from '@/types/appConfig';
import type { SupportedLocale } from '@/i18n/config';

/**
 * 生成OpenClaw集成提示词
 * @param deepjellyHost DeepJelly地址
 * @param deepjellyPort DeepJelly端口
 * @param deepjellyToken DeepJelly Token
 * @param locale 语言
 */
function generateOpenClawPrompt(
  deepjellyHost: string,
  deepjellyPort: string,
  deepjellyToken: string,
  locale: SupportedLocale = 'zh'
): string {
  const prompts = {
    zh: `请帮我完成与 DeepJelly 的集成：

## 步骤1：检查并安装 deepjelly 插件

首先检查插件是否已安装：
\`\`\`bash
ls ~/.openclaw/extensions/deepjelly/openclaw.plugin.json 2>/dev/null || echo "NOT_INSTALLED"
\`\`\`

如果插件未安装，执行以下命令自动安装：
\`\`\`bash
# 下载插件
wget https://github.com/GinSing1226/DeepJelly/releases/download/deepjelly-V0.1.0/deepjelly-openclaw-plugin.zip -O /tmp/deepjelly-plugin.zip

# 解压到扩展目录
unzip -o /tmp/deepjelly-plugin.zip -d ~/.openclaw/extensions/

# 重命名文件夹（如果需要）
mv ~/.openclaw/extensions/deepjelly-openclaw-plugin ~/.openclaw/extensions/deepjelly 2>/dev/null || true
\`\`\`

## 步骤2：检查并安装 deepjelly 技能

首先检查技能是否已安装：
\`\`\`bash
# 找到 OpenClaw 根目录（包含 openclaw.json 的目录）
OPENCLAW_ROOT=\$(find ~ -name "openclaw.json" -not -path "*/node_modules/*" -exec dirname {} \\; | head -1)

# 检查技能目录
ls "\$OPENCLAW_ROOT/skills/deepjelly-integrate/SKILL.md" 2>/dev/null || echo "SKILLS_NOT_INSTALLED"
\`\`\`

如果技能未安装，执行以下命令：
\`\`\`bash
# 创建 skills 目录
mkdir -p "\$OPENCLAW_ROOT/skills"

# 克隆 DeepJelly 仓库并复制技能
cd /tmp
rm -rf DeepJelly
git clone --depth 1 --filter=blob:none --sparse https://github.com/GinSing1226/DeepJelly.git
cd DeepJelly
git sparse-checkout set skills
cp -r skills/deepjelly-integrate skills/deepjelly-character "\$OPENCLAW_ROOT/skills/"
\`\`\`

然后配置 openclaw.json 添加技能加载路径：
\`\`\`bash
# 检查是否已配置
grep -q '"extraDirs"' "\$OPENCLAW_ROOT/openclaw.json" 2>/dev/null || echo "NOT_CONFIGURED"
\`\`\`

如果未配置，使用 jq 或手动编辑添加：
\`\`\`json
{
  "skills": {
    "load": {
      "extraDirs": ["./skills"],
      "watch": true
    }
  }
}
\`\`\`

## 步骤3：保存 DeepJelly 连接信息

将以下配置保存到两个技能的 config.md 文件中：
- \`skills/deepjelly-integrate/config.md\`
- \`skills/deepjelly-character/config.md\`

\`\`\`markdown
# DeepJelly 集成配置

### 服务器地址
\`\`\`
${deepjellyHost}
\`\`\`

### 端口
\`\`\`
${deepjellyPort}
\`\`\`

### 认证令牌 (Bearer Token)
\`\`\`
${deepjellyToken}
\`\`\`
\`\`\`

## 步骤4：配置 openclaw.json 的 channels

获取本机局域网 IP：
\`\`\`bash
# Linux/macOS
hostname -I | awk '{print $1}'
# 或
ip addr show | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | cut -d/ -f1 | head -1
\`\`\`

在 openclaw.json 中添加 deepjelly channel：
\`\`\`json
{
  "channels": {
    "deepjelly": {
      "enabled": true,
      "serverHost": "本机局域网IP或127.0.0.1",
      "serverPort": 18790,
      "autoStart": true
    }
  }
}
\`\`\`

## 步骤5：完成并重启

先回复我以下信息：
- 本机局域网 IP 地址
- 监听端口（默认 18790）
- 插件和技能安装状态

然后执行延迟重启命令：
\`\`\`bash
sleep 20 && openclaw-gateway restart
\`\`\`

完成后我将通过 WebSocket 连接。`,

    en: `Please help me integrate with DeepJelly:

## Step 1: Check and install deepjelly plugin

First check if the plugin is already installed:
\`\`\`bash
ls ~/.openclaw/extensions/deepjelly/openclaw.plugin.json 2>/dev/null || echo "NOT_INSTALLED"
\`\`\`

If not installed, execute:
\`\`\`bash
# Download plugin
wget https://github.com/GinSing1226/DeepJelly/releases/download/deepjelly-V0.1.0/deepjelly-openclaw-plugin.zip -O /tmp/deepjelly-plugin.zip

# Extract to extensions directory
unzip -o /tmp/deepjelly-plugin.zip -d ~/.openclaw/extensions/

# Rename folder if needed
mv ~/.openclaw/extensions/deepjelly-openclaw-plugin ~/.openclaw/extensions/deepjelly 2>/dev/null || true
\`\`\`

## Step 2: Check and install deepjelly skills

First check if skills are already installed:
\`\`\`bash
# Find OpenClaw root directory
OPENCLAW_ROOT=\$(find ~ -name "openclaw.json" -not -path "*/node_modules/*" -exec dirname {} \\; | head -1)

# Check skills directory
ls "\$OPENCLAW_ROOT/skills/deepjelly-integrate/SKILL.md" 2>/dev/null || echo "SKILLS_NOT_INSTALLED"
\`\`\`

If not installed, execute:
\`\`\`bash
# Create skills directory
mkdir -p "\$OPENCLAW_ROOT/skills"

# Clone DeepJelly repo and copy skills
cd /tmp
rm -rf DeepJelly
git clone --depth 1 --filter=blob:none --sparse https://github.com/GinSing1226/DeepJelly.git
cd DeepJelly
git sparse-checkout set skills
cp -r skills/deepjelly-integrate skills/deepjelly-character "\$OPENCLAW_ROOT/skills/"
\`\`\`

Then configure openclaw.json to add skills loading path:
\`\`\`json
{
  "skills": {
    "load": {
      "extraDirs": ["./skills"],
      "watch": true
    }
  }
}
\`\`\`

## Step 3: Save DeepJelly connection info

Save the following config to both skills' config.md files:
- \`skills/deepjelly-integrate/config.md\`
- \`skills/deepjelly-character/config.md\`

\`\`\`markdown
# DeepJelly Integration Config

### Server Address
\`\`\`
${deepjellyHost}
\`\`\`

### Port
\`\`\`
${deepjellyPort}
\`\`\`

### Auth Token (Bearer Token)
\`\`\`
${deepjellyToken}
\`\`\`
\`\`\`

## Step 4: Configure openclaw.json channels

Get local LAN IP:
\`\`\`bash
hostname -I | awk '{print $1}'
\`\`\`

Add deepjelly channel to openclaw.json:
\`\`\`json
{
  "channels": {
    "deepjelly": {
      "enabled": true,
      "serverHost": "your_LAN_IP_or_127.0.0.1",
      "serverPort": 18790,
      "autoStart": true
    }
  }
}
\`\`\`

## Step 5: Complete and restart

Reply to me with:
- Your LAN IP address
- Listening port (default 18790)
- Plugin and skills installation status

Then execute delayed restart:
\`\`\`bash
sleep 20 && openclaw-gateway restart
\`\`\`

I will connect via WebSocket after completion.`,

    ja: `DeepJellyとの統合を手伝ってください：

## ステップ1：deepjellyプラグインを確認・インストール

まずプラグインが既にインストールされているか確認：
\`\`\`bash
ls ~/.openclaw/extensions/deepjelly/openclaw.plugin.json 2>/dev/null || echo "NOT_INSTALLED"
\`\`\`

未インストールの場合、以下を実行：
\`\`\`bash
# プラグインをダウンロード
wget https://github.com/GinSing1226/DeepJelly/releases/download/deepjelly-V0.1.0/deepjelly-openclaw-plugin.zip -O /tmp/deepjelly-plugin.zip

# extensionsディレクトリに解凍
unzip -o /tmp/deepjelly-plugin.zip -d ~/.openclaw/extensions/

# フォルダ名を変更（必要な場合）
mv ~/.openclaw/extensions/deepjelly-openclaw-plugin ~/.openclaw/extensions/deepjelly 2>/dev/null || true
\`\`\`

## ステップ2：deepjellyスキルを確認・インストール

まずスキルが既にインストールされているか確認：
\`\`\`bash
# OpenClawルートディレクトリを検索
OPENCLAW_ROOT=\$(find ~ -name "openclaw.json" -not -path "*/node_modules/*" -exec dirname {} \\; | head -1)

# スキルディレクトリを確認
ls "\$OPENCLAW_ROOT/skills/deepjelly-integrate/SKILL.md" 2>/dev/null || echo "SKILLS_NOT_INSTALLED"
\`\`\`

未インストールの場合、以下を実行：
\`\`\`bash
# skillsディレクトリを作成
mkdir -p "\$OPENCLAW_ROOT/skills"

# DeepJellyリポジトリをクローンしてスキルをコピー
cd /tmp
rm -rf DeepJelly
git clone --depth 1 --filter=blob:none --sparse https://github.com/GinSing1226/DeepJelly.git
cd DeepJelly
git sparse-checkout set skills
cp -r skills/deepjelly-integrate skills/deepjelly-character "\$OPENCLAW_ROOT/skills/"
\`\`\`

openclaw.jsonにスキル読み込みパスを追加：
\`\`\`json
{
  "skills": {
    "load": {
      "extraDirs": ["./skills"],
      "watch": true
    }
  }
}
\`\`\`

## ステップ3：DeepJelly接続情報を保存

以下の設定を両方のスキルのconfig.mdファイルに保存：
- \`skills/deepjelly-integrate/config.md\`
- \`skills/deepjelly-character/config.md\`

\`\`\`markdown
# DeepJelly統合設定

### サーバーアドレス
\`\`\`
${deepjellyHost}
\`\`\`

### ポート
\`\`\`
${deepjellyPort}
\`\`\`

### 認証トークン (Bearer Token)
\`\`\`
${deepjellyToken}
\`\`\`
\`\`\`

## ステップ4：openclaw.jsonのchannelsを設定

LAN IPを取得：
\`\`\`bash
hostname -I | awk '{print $1}'
\`\`\`

openclaw.jsonにdeepjelly channelを追加：
\`\`\`json
{
  "channels": {
    "deepjelly": {
      "enabled": true,
      "serverHost": "LAN_IPまたは127.0.0.1",
      "serverPort": 18790,
      "autoStart": true
    }
  }
}
\`\`\`

## ステップ5：完了して再起動

以下の情報を返信してください：
- LAN IPアドレス
- 待ち受けポート（デフォルト18790）
- プラグインとスキルのインストール状況

その後、遅延再起動コマンドを実行：
\`\`\`bash
sleep 20 && openclaw-gateway restart
\`\`\`

完了後、WebSocketで接続します。`
  };

  return prompts[locale] || prompts.zh;
}

/**
 * 生成集成提示词
 * @param appType 应用类型
 * @param deepjellyHost DeepJelly地址
 * @param deepjellyPort DeepJelly端口
 * @param deepjellyToken DeepJelly Token
 * @param locale 语言
 */
export function generateIntegrationPrompt(
  appType: AIAppType,
  deepjellyHost: string,
  deepjellyPort: string,
  deepjellyToken: string,
  locale: SupportedLocale = 'zh'
): string {
  switch (appType) {
    case 'openclaw':
      return generateOpenClawPrompt(deepjellyHost, deepjellyPort, deepjellyToken, locale);

    case 'claude':
      const claudePrompts = {
        zh: `请帮我完成与DeepJelly的集成：\n[待补充Claude集成步骤]`,
        en: `Please help me integrate with DeepJelly:\n[Claude integration steps to be added]`,
        ja: `DeepJellyとの統合を手伝ってください：\n[Claude統合の手順を追加予定]`
      };
      return claudePrompts[locale] || claudePrompts.zh;

    case 'chatgpt':
      const chatgptPrompts = {
        zh: `请帮我完成与DeepJelly的集成：\n[待补充ChatGPT集成步骤]`,
        en: `Please help me integrate with DeepJelly:\n[ChatGPT integration steps to be added]`,
        ja: `DeepJellyとの統合を手伝ってください：\n[ChatGPT統合の手順を追加予定]`
      };
      return chatgptPrompts[locale] || chatgptPrompts.zh;

    default:
      const defaultPrompts = {
        zh: '请配置AI应用集成',
        en: 'Please configure AI app integration',
        ja: 'AIアプリ統合を設定してください'
      };
      return defaultPrompts[locale] || defaultPrompts.zh;
  }
}
