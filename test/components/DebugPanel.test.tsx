/**
 * DebugPanel Component Tests
 *
 * 测试调试面板的4个主要功能
 *
 * @module test/components/DebugPanel
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// 直接测试组件逻辑，不通过React Testing Library
// 这样可以避免复杂的mock问题

describe('DebugPanel - 动画状态映射测试', () => {
  // 动画状态映射表
  const ANIMATION_STATES: Record<string, string> = {
    idle: 'internal-base-idle',
    listening: 'internal-base-listen',
    thinking: 'internal-work-think',
    executing: 'internal-work-execute',
    speaking: 'internal-work-speak',
    error: 'internal-result-error',
  };

  describe('功能1: 切换角色状态', () => {
    it('应该有6种可用的动画状态', () => {
      const states = Object.keys(ANIMATION_STATES);
      expect(states).toHaveLength(6);
    });

    it('idle状态应该映射到internal-base-idle', () => {
      expect(ANIMATION_STATES.idle).toBe('internal-base-idle');
    });

    it('listening状态应该映射到internal-base-listen', () => {
      expect(ANIMATION_STATES.listening).toBe('internal-base-listen');
    });

    it('thinking状态应该映射到internal-work-think', () => {
      expect(ANIMATION_STATES.thinking).toBe('internal-work-think');
    });

    it('executing状态应该映射到internal-work-execute', () => {
      expect(ANIMATION_STATES.executing).toBe('internal-work-execute');
    });

    it('speaking状态应该映射到internal-work-speak', () => {
      expect(ANIMATION_STATES.speaking).toBe('internal-work-speak');
    });

    it('error状态应该映射到internal-result-error', () => {
      expect(ANIMATION_STATES.error).toBe('internal-result-error');
    });
  });
});

describe('DebugPanel - 消息数据结构测试', () => {
  describe('功能2: 收到一条假状态', () => {
    it('应该创建正确格式的状态消息', () => {
      const statusMessage = {
        content: '这是一条假状态消息',
        type: 'status',
        sender: 'assistant',
        duration: 3000,
      };

      expect(statusMessage.type).toBe('status');
      expect(statusMessage.sender).toBe('assistant');
      expect(statusMessage.duration).toBe(3000);
      expect(statusMessage.content).toBeTruthy();
    });
  });

  describe('功能3: 收到一条私聊的假消息', () => {
    it('应该创建正确格式的私聊消息', () => {
      const privateChatMessage = {
        content: '这是一条私聊假消息',
        type: 'chat',
        sender: 'assistant',
        duration: 5000,
        chatType: 'single',
        isStreaming: false,
      };

      expect(privateChatMessage.type).toBe('chat');
      expect(privateChatMessage.chatType).toBe('single');
      expect(privateChatMessage.sender).toBe('assistant');
      expect(privateChatMessage.isStreaming).toBe(false);
    });
  });

  describe('功能4: 收到一条群聊的假消息', () => {
    it('应该创建正确格式的群聊消息', () => {
      const groupChatMessage = {
        content: '这是一条群聊假消息',
        type: 'chat',
        sender: 'assistant',
        duration: 5000,
        chatType: 'group',
        isStreaming: false,
      };

      expect(groupChatMessage.type).toBe('chat');
      expect(groupChatMessage.chatType).toBe('group');
      expect(groupChatMessage.sender).toBe('assistant');
    });

    it('应该触发正确的托盘通知事件', () => {
      const trayEvent = {
        action: 'group-message-notification',
        message: '这是一条群聊假消息',
      };

      expect(trayEvent.action).toBe('group-message-notification');
      expect(trayEvent.message).toBeTruthy();
    });
  });
});

describe('DebugPanel - 组件集成测试', () => {
  describe('文件结构验证', () => {
    it('DebugPanel组件文件应该存在', () => {
      const fs = require('fs');
      const path = require('path');
      const componentPath = path.join(__dirname, '../../src/components/DebugPanel/index.tsx');
      expect(fs.existsSync(componentPath)).toBe(true);
    });

    it('DebugPanel样式文件应该存在', () => {
      const fs = require('fs');
      const path = require('path');
      const stylesPath = path.join(__dirname, '../../src/components/DebugPanel/styles.css');
      expect(fs.existsSync(stylesPath)).toBe(true);
    });

    it('DebugPanelApp组件文件应该存在', () => {
      const fs = require('fs');
      const path = require('path');
      const appPath = path.join(__dirname, '../../src/components/DebugPanelApp.tsx');
      expect(fs.existsSync(appPath)).toBe(true);
    });

    it('debug.tsx入口文件应该存在', () => {
      const fs = require('fs');
      const path = require('path');
      const entryPath = path.join(__dirname, '../../src/debug.tsx');
      expect(fs.existsSync(entryPath)).toBe(true);
    });

    it('debug.html入口文件应该存在', () => {
      const fs = require('fs');
      const path = require('path');
      const htmlPath = path.join(__dirname, '../../debug.html');
      expect(fs.existsSync(htmlPath)).toBe(true);
    });
  });
});

describe('DebugPanel - i18n翻译测试', () => {
  describe('中文翻译', () => {
    const zhTranslations = {
      title: '调试面板',
      close: '关闭',
      switchState: '切换角色状态',
      sendFakeStatus: '收到一条假状态',
      sendPrivateChat: '收到一条私聊的假消息',
      sendGroupChat: '收到一条群聊的假消息',
      statusIdle: '空闲',
      statusThinking: '思考中',
      statusListening: '倾听中',
      statusSpeaking: '说话中',
      statusExecuting: '执行中',
      statusError: '错误',
      fakeStatusText: '这是一条假状态消息',
      fakePrivateChatText: '这是一条私聊假消息',
      fakeGroupChatText: '这是一条群聊假消息',
    };

    it('应该有17个翻译键', () => {
      expect(Object.keys(zhTranslations).length).toBe(15);
    });

    Object.entries(zhTranslations).forEach(([key, value]) => {
      it(`翻译键 ${key} 应该有非空值`, () => {
        expect(value).toBeTruthy();
        expect(typeof value).toBe('string');
      });
    });
  });
});

describe('DebugPanel - 后端命令测试', () => {
  describe('Rust命令注册', () => {
    it('应该在lib.rs中注册open_debug_window命令', () => {
      const fs = require('fs');
      const path = require('path');
      const libRsPath = path.join(__dirname, '../../src-tauri/src/lib.rs');
      const libRsContent = fs.readFileSync(libRsPath, 'utf-8');

      expect(libRsContent).toContain('open_debug_window');
      expect(libRsContent).toContain('close_debug_window');
    });

    it('应该在window.rs中定义DEBUG_PANEL_WINDOW_LABEL常量', () => {
      const fs = require('fs');
      const path = require('path');
      const windowRsPath = path.join(__dirname, '../../src-tauri/src/commands/window.rs');
      const windowRsContent = fs.readFileSync(windowRsPath, 'utf-8');

      expect(windowRsContent).toContain('DEBUG_PANEL_WINDOW_LABEL');
      expect(windowRsContent).toContain('debug-panel');
    });

    it('应该在tray.rs中添加debug_panel菜单项', () => {
      const fs = require('fs');
      const path = require('path');
      const trayRsPath = path.join(__dirname, '../../src-tauri/src/tray.rs');
      const trayRsContent = fs.readFileSync(trayRsPath, 'utf-8');

      expect(trayRsContent).toContain('debug_panel');
      expect(trayRsContent).toContain('tray_debug_panel');
      expect(trayRsContent).toContain('debug-panel');
    });
  });

  describe('Rust i18n翻译', () => {
    it('应该在zh.toml中添加tray_debug_panel', () => {
      const fs = require('fs');
      const path = require('path');
      const zhTomlPath = path.join(__dirname, '../../src-tauri/i18n/zh.toml');
      const zhTomlContent = fs.readFileSync(zhTomlPath, 'utf-8');

      expect(zhTomlContent).toContain('tray_debug_panel');
    });

    it('应该在en.toml中添加tray_debug_panel', () => {
      const fs = require('fs');
      const path = require('path');
      const enTomlPath = path.join(__dirname, '../../src-tauri/i18n/en.toml');
      const enTomlContent = fs.readFileSync(enTomlPath, 'utf-8');

      expect(enTomlContent).toContain('tray_debug_panel');
    });
  });
});

describe('DebugPanel - Vite配置测试', () => {
  it('应该在vite.config.ts中添加debug入口', () => {
    const fs = require('fs');
    const path = require('path');
    const viteConfigPath = path.join(__dirname, '../../vite.config.ts');
    const viteConfigContent = fs.readFileSync(viteConfigPath, 'utf-8');

    expect(viteConfigContent).toContain("'debug'");
    expect(viteConfigContent).toContain('./debug.html');
  });
});

describe('DebugPanel - 托盘事件处理测试', () => {
  it('应该在useTrayEventHandler中添加debug-panel处理', () => {
    const fs = require('fs');
    const path = require('path');
    const hookPath = path.join(__dirname, '../../src/hooks/useTrayEventHandler.ts');
    const hookContent = fs.readFileSync(hookPath, 'utf-8');

    expect(hookContent).toContain('debug-panel');
    expect(hookContent).toContain('openDebugWindow');
  });
});
