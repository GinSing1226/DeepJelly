/**
 * i18n Translation Test
 *
 * 验证翻译功能是否正常工作
 */

import { describe, it, expect } from 'vitest';
import i18n from '@/i18n/config';
import { resources } from '@/i18n/resources';

describe('i18n Translation Test', () => {
  describe('settings namespace translations', () => {
    it('should translate "settings:title" correctly', () => {
      const title = i18n.t('settings:title');
      expect(title).toBe('设置');
    });

    it('should translate "settings:tabs.character" correctly', () => {
      const character = i18n.t('settings:tabs.character');
      expect(character).toBe('角色管理');
    });

    it('should translate "settings:tabs.integration" correctly', () => {
      const integration = i18n.t('settings:tabs.integration');
      expect(integration).toBe('应用集成');
    });

    it('should translate "settings:tabs.system" correctly', () => {
      const system = i18n.t('settings:tabs.system');
      expect(system).toBe('系统设置');
    });

    it('should translate "settings:system.autoLaunch" correctly', () => {
      const autoLaunch = i18n.t('settings:system.autoLaunch');
      expect(autoLaunch).toBe('开机自启动');
    });
  });

  describe('common namespace translations', () => {
    it('should translate "common:connecting" correctly', () => {
      const connecting = i18n.t('common:connecting');
      expect(connecting).toBe('连接中');
    });

    it('should translate "common:connected" correctly', () => {
      const connected = i18n.t('common:connected');
      expect(connected).toBe('已连接');
    });

    it('should translate "common:disconnected" correctly', () => {
      const disconnected = i18n.t('common:disconnected');
      expect(disconnected).toBe('未连接');
    });
  });

  describe('resources structure validation', () => {
    it('should have settings.tabs.character defined', () => {
      expect(resources.zh.settings.tabs.character).toBe('角色管理');
      expect(resources.en.settings.tabs.character).toBe('Character');
      expect(resources.ja.settings.tabs.character).toBe('キャラクター');
    });

    it('should have settings.title defined', () => {
      expect(resources.zh.settings.title).toBe('设置');
      expect(resources.en.settings.title).toBe('Settings');
      expect(resources.ja.settings.title).toBe('設定');
    });
  });
});
