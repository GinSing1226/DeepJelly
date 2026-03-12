/**
 * CharacterIntegrationCard 组件测试
 *
 * 测试角色集成卡片的渲染、交互和功能
 *
 * @module test/components/SettingsApp/IntegrationManagement/CharacterIntegrationCard.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CharacterIntegrationCard } from '@/components/SettingsApp/IntegrationManagement/CharacterIntegrationCard';
import type { CharacterIntegration, AppIntegration } from '@/types/character';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// ============ Test Data ============

const mockAppIntegration: AppIntegration = {
  id: 'app-integration-001',
  applicationId: 'app-123456789012',
  provider: 'openclaw',
  name: 'My OpenClaw',
  endpoint: 'ws://192.168.10.128:18790',
  enabled: true,
};

const mockCharacterIntegration: CharacterIntegration = {
  id: 'char-integration-001',
  characterId: 'char-feishu-private',
  characterName: '飞书私聊',
  assistantId: 'assistant-work',
  assistantName: '工作助手',
  integration: {
    integrationId: 'app-integration-001',
    provider: 'openclaw',
    applicationId: 'app-123456789012',
    agentId: 'christina',
    params: {
      sessionKey: 'agent:christina:main',
    },
  },
  enabled: true,
  createdAt: Date.now(),
};

// ============ Tests ============

describe('CharacterIntegrationCard 组件测试', () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnToggleEnabled = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnToggleEnabled.mockResolvedValue(undefined);
  });

  describe('TC-CHAR-CARD-001: 渲染角色集成卡片', () => {
    it('应显示助手名称和角色名称', () => {
      render(
        <CharacterIntegrationCard
          integration={mockCharacterIntegration}
          appIntegrations={[mockAppIntegration]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      expect(screen.getByText('工作助手')).toBeInTheDocument();
      expect(screen.getByText('飞书私聊')).toBeInTheDocument();
    });

    it('应显示应用名称和端点', () => {
      render(
        <CharacterIntegrationCard
          integration={mockCharacterIntegration}
          appIntegrations={[mockAppIntegration]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      expect(screen.getByText(/My OpenClaw/)).toBeInTheDocument();
      expect(screen.getByText(/192.168.10.128/)).toBeInTheDocument();
    });

    it('应显示Agent ID', () => {
      render(
        <CharacterIntegrationCard
          integration={mockCharacterIntegration}
          appIntegrations={[mockAppIntegration]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      expect(screen.getByText('christina')).toBeInTheDocument();
    });

    it('应显示Session Key', () => {
      render(
        <CharacterIntegrationCard
          integration={mockCharacterIntegration}
          appIntegrations={[mockAppIntegration]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      expect(screen.getByText('agent:christina:main')).toBeInTheDocument();
    });
  });

  describe('TC-CHAR-CARD-002: 未知应用处理', () => {
    it('应用集成不存在时应显示"Unknown App"', () => {
      render(
        <CharacterIntegrationCard
          integration={mockCharacterIntegration}
          appIntegrations={[]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      expect(screen.getByText('Unknown App')).toBeInTheDocument();
    });
  });

  describe('TC-CHAR-CARD-003: 启用/禁用状态', () => {
    it('切换开关应调用onToggleEnabled', async () => {
      render(
        <CharacterIntegrationCard
          integration={mockCharacterIntegration}
          appIntegrations={[mockAppIntegration]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      await waitFor(() => {
        expect(mockOnToggleEnabled).toHaveBeenCalledWith('char-integration-001', false);
      });
    });
  });

  describe('TC-CHAR-CARD-004: 编辑按钮', () => {
    it('点击编辑按钮应调用onEdit', () => {
      render(
        <CharacterIntegrationCard
          integration={mockCharacterIntegration}
          appIntegrations={[mockAppIntegration]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      const editButton = screen.getByText('integration.editBinding');
      fireEvent.click(editButton);

      expect(mockOnEdit).toHaveBeenCalledWith(mockCharacterIntegration);
    });
  });

  describe('TC-CHAR-CARD-005: 删除按钮', () => {
    it('点击删除按钮应调用onDelete', () => {
      render(
        <CharacterIntegrationCard
          integration={mockCharacterIntegration}
          appIntegrations={[mockAppIntegration]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      const deleteButton = screen.getByText('integration.deleteBinding');
      fireEvent.click(deleteButton);

      expect(mockOnDelete).toHaveBeenCalledWith(mockCharacterIntegration);
    });
  });

  describe('TC-CHAR-CARD-006: 禁用状态样式', () => {
    it('禁用的卡片应有disabled类', () => {
      const disabledIntegration = { ...mockCharacterIntegration, enabled: false };
      const { container } = render(
        <CharacterIntegrationCard
          integration={disabledIntegration}
          appIntegrations={[mockAppIntegration]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      const card = container.querySelector('.character-integration-card');
      expect(card).toHaveClass('disabled');
    });
  });

  describe('TC-CHAR-CARD-007: Provider图标', () => {
    it('OpenClaw应显示螃蟹图标', () => {
      const { container } = render(
        <CharacterIntegrationCard
          integration={mockCharacterIntegration}
          appIntegrations={[mockAppIntegration]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      // Check that emoji exists in the document
      const allText = container.textContent || '';
      expect(allText).toContain('🦞');
    });
  });

  describe('TC-CHAR-CARD-008: 无SessionKey时不显示该字段', () => {
    it('不显示Session Key字段', () => {
      const integrationNoSession = {
        ...mockCharacterIntegration,
        integration: {
          ...mockCharacterIntegration.integration,
          params: {},
        },
      };

      render(
        <CharacterIntegrationCard
          integration={integrationNoSession}
          appIntegrations={[mockAppIntegration]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      expect(screen.queryByText('integration.sessionKey')).not.toBeInTheDocument();
    });
  });
});
