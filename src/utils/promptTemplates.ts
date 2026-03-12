/**
 * Prompt Templates
 *
 * AI应用集成提示词模板
 * @module utils/promptTemplates
 */

import type { AIAppType } from '@/types/appConfig';
import type { SupportedLocale } from '@/i18n/config';

/**
 * OpenClaw集成提示词模板
 */
const OPENCLAW_PROMPTS: Record<SupportedLocale, string> = {
  zh: `请帮我完成与 DeepJelly 的集成：

## 快速安装

1. 复制 DeepJelly 插件文件夹到 OpenClaw 扩展目录：
   cp -r adapters/openclaw ~/.openclaw/extensions/deepjelly

2. 安装依赖（只需要 ws）：
   cd ~/.openclaw/extensions/deepjelly
   npm install

3. 在 openclaw.json 中配置 deepjelly 通道：

本地开发（同一台机器）：
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

局域网部署（不同机器）：
{
  "channels": {
    "deepjelly": {
      "enabled": true,
      "serverHost": "这是你的局域网ip地址",
      "serverPort": 18790,
      "autoStart": true
    }
  }
}

注意：局域网部署需要在防火墙中允许 18790 端口入站连接。

4. 最后，告诉我你的 IP 地址和端口（默认 18790）。并执行一个命令：20s后自动重启gateway。

完成后，我将通过 WebSocket 连接到你的 OpenClaw。`,

  en: `Please help me integrate with DeepJelly:

## Quick Installation

1. Copy the DeepJelly plugin folder to the OpenClaw extensions directory:
   cp -r adapters/openclaw ~/.openclaw/extensions/deepjelly

2. Install dependencies (only ws is needed):
   cd ~/.openclaw/extensions/deepjelly
   npm install

3. Configure the deepjelly channel in openclaw.json:

Local development (same machine):
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

LAN deployment (different machines):
{
  "channels": {
    "deepjelly": {
      "enabled": true,
      "serverHost": "YOUR_LAN_IP_ADDRESS",
      "serverPort": 18790,
      "autoStart": true
    }
  }
}

Note: For LAN deployment, you need to allow port 18790 inbound connections in your firewall.

4. Finally, tell me your IP address and port (default 18790). And execute a command: automatically restart gateway in 20s.

Once completed, I will connect to your OpenClaw via WebSocket.`,

  ja: `DeepJellyとの統合を手伝ってください：

## クイックインストール

1. DeepJellyプラグインフォルダをOpenClaw拡張ディレクトリにコピーします：
   cp -r adapters/openclaw ~/.openclaw/extensions/deepjelly

2. 依存関係をインストールします（wsのみ必要）：
   cd ~/.openclaw/extensions/deepjelly
   npm install

3. openclaw.jsonでdeepjellyチャネルを設定します：

ローカル開発（同じマシン）：
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

LAN展開（異なるマシン）：
{
  "channels": {
    "deepjelly": {
      "enabled": true,
      "serverHost": "あなたのLAN IPアドレス",
      "serverPort": 18790,
      "autoStart": true
    }
  }
}

注意：LAN展開の場合、ファイアウォールでポート18790のインバウンド接続を許可する必要があります。

4. 最後に、IPアドレスとポート（デフォルト18790）を教えてください。そして、次のコマンドを実行してください：20秒後にgatewayを自動的に再起動します。

完了後、WebSocketを介してあなたのOpenClawに接続します。`
};

/**
 * 生成集成提示词
 */
export function generateIntegrationPrompt(
  appType: AIAppType,
  locale: SupportedLocale = 'zh'
): string {
  switch (appType) {
    case 'openclaw':
      return OPENCLAW_PROMPTS[locale] || OPENCLAW_PROMPTS.zh;

    case 'claude':
      return locale === 'zh'
        ? `请帮我完成与DeepJelly的集成：\n[待补充Claude集成步骤]`
        : locale === 'ja'
        ? `DeepJellyとの統合を手伝ってください：\n[Claude統合の手順を追加予定]`
        : `Please help me integrate with DeepJelly:\n[Claude integration steps to be added]`;

    case 'chatgpt':
      return locale === 'zh'
        ? `请帮我完成与DeepJelly的集成：\n[待补充ChatGPT集成步骤]`
        : locale === 'ja'
        ? `DeepJellyとの統合を手伝ってください：\n[ChatGPT統合の手順を追加予定]`
        : `Please help me integrate with DeepJelly:\n[ChatGPT integration steps to be added]`;

    default:
      return locale === 'zh'
        ? '请配置AI应用集成'
        : locale === 'ja'
        ? 'AIアプリ統合を設定してください'
        : 'Please configure AI app integration';
  }
}
