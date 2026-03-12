/**
 * AppIntegrationCard 组件测试
 *
 * 测试应用集成卡片的渲染、交互和功能
 *
 * @module test/components/SettingsApp/IntegrationManagement/AppIntegrationCard.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AppIntegrationCard } from '@/components/SettingsApp/IntegrationManagement/AppIntegrationCard';
import type { AppIntegration } from '@/types/character';
import type { Assistant } from '@/types/character';

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
  description: 'Development environment',
  endpoint: 'ws://192.168.10.128:18790',
  authToken: 'sk-test-token-12345',
  enabled: true,
  createdAt: Date.now(),
};

const mockAssistants: Assistant[] = [
  {
    id: 'assistant-1',
    name: '工作助手',
    description: 'Work assistant',
    characters: [
      { id: 'char-1', name: '飞书私聊' },
      { id: 'char-2', name: '飞书群聊' },
    ],
    integrations: [
      {
        provider: 'openclaw',
        params: { applicationId: 'app-123456789012' },
        enabled: true,
        createdAt: Date.now(),
      },
    ],
  },
  {
    id: 'assistant-2',
    name: '学习助手',
    description: 'Study assistant',
    characters: [],
    integrations: [],
  },
];

// ============ Tests ============

describe('AppIntegrationCard 组件测试', () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnToggleEnabled = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock async toggle to return resolved promise
    mockOnToggleEnabled.mockResolvedValue(undefined);
  });

  describe('TC-APP-CARD-001: 渲染应用集成卡片', () => {
    it('应显示应用名称', () => {
      render(
        <AppIntegrationCard
          integration={mockAppIntegration}
          assistants={mockAssistants}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      expect(screen.getByText('My OpenClaw')).toBeInTheDocument();
    });

    it('应显示应用类型', () => {
      render(
        <AppIntegrationCard
          integration={mockAppIntegration}
          assistants={mockAssistants}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      expect(screen.getByText('openclaw')).toBeInTheDocument();
    });

    it('应显示应用ID', () => {
      render(
        <AppIntegrationCard
          integration={mockAppIntegration}
          assistants={mockAssistants}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      expect(screen.getByText('app-123456789012')).toBeInTheDocument();
    });

    it('应显示端点地址', () => {
      render(
        <AppIntegrationCard
          integration={mockAppIntegration}
          assistants={mockAssistants}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      expect(screen.getByText('ws://192.168.10.128:18790')).toBeInTheDocument();
    });

    it('应显示描述', () => {
      render(
        <AppIntegrationCard
          integration={mockAppIntegration}
          assistants={mockAssistants}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      expect(screen.getByText('Development environment')).toBeInTheDocument();
    });

    it('应显示Token（截断）', () => {
      render(
        <AppIntegrationCard
          integration={mockAppIntegration}
          assistants={mockAssistants}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      // Token should be truncated and shown with ...
      expect(screen.getByText(/sk-test-token-/)).toBeInTheDocument();
    });
  });

  describe('TC-APP-CARD-002: 显示绑定助手', () => {
    it('应显示绑定的助手列表', () => {
      render(
        <AppIntegrationCard
          integration={mockAppIntegration}
          assistants={mockAssistants}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      expect(screen.getByText('工作助手')).toBeInTheDocument();
    });

    it('无绑定时应显示"无"', () => {
      const integrationNoBindings = { ...mockAppIntegration };
      render(
        <AppIntegrationCard
          integration={integrationNoBindings}
          assistants={[]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      expect(screen.getByText('integration.none')).toBeInTheDocument();
    });
  });

  describe('TC-APP-CARD-003: 启用/禁用状态', () => {
    it('启用状态应显示"已启用"标签', () => {
      render(
        <AppIntegrationCard
          integration={mockAppIntegration}
          assistants={mockAssistants}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      expect(screen.getByText('integration.enabled')).toBeInTheDocument();
    });

    it('禁用状态应显示"已禁用"标签', () => {
      const disabledIntegration = { ...mockAppIntegration, enabled: false };
      render(
        <AppIntegrationCard
          integration={disabledIntegration}
          assistants={mockAssistants}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      expect(screen.getByText('integration.disabled')).toBeInTheDocument();
    });

    it('切换开关应调用onToggleEnabled', async () => {
      render(
        <AppIntegrationCard
          integration={mockAppIntegration}
          assistants={mockAssistants}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      await waitFor(() => {
        expect(mockOnToggleEnabled).toHaveBeenCalledWith('app-integration-001', false);
      });
    });
  });

  describe('TC-APP-CARD-004: 编辑按钮', () => {
    it('点击编辑按钮应调用onEdit', () => {
      render(
        <AppIntegrationCard
          integration={mockAppIntegration}
          assistants={mockAssistants}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      const editButton = screen.getByText('integration.edit');
      fireEvent.click(editButton);

      expect(mockOnEdit).toHaveBeenCalledWith(mockAppIntegration);
    });
  });

  describe('TC-APP-CARD-005: 删除按钮', () => {
    it('点击删除按钮应调用onDelete', () => {
      render(
        <AppIntegrationCard
          integration={mockAppIntegration}
          assistants={[]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      const deleteButton = screen.getByText('integration.deleteIntegration');
      fireEvent.click(deleteButton);

      expect(mockOnDelete).toHaveBeenCalledWith(mockAppIntegration);
    });

    it('有绑定时删除按钮应被禁用', () => {
      render(
        <AppIntegrationCard
          integration={mockAppIntegration}
          assistants={mockAssistants}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      const deleteButton = screen.getByText('integration.deleteIntegration');
      expect(deleteButton).toBeDisabled();
    });
  });

  describe('TC-APP-CARD-006: Provider图标', () => {
    it('OpenClaw应显示螃蟹图标', () => {
      render(
        <AppIntegrationCard
          integration={mockAppIntegration}
          assistants={[]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      expect(screen.getByText('🦞')).toBeInTheDocument();
    });

    it('Claude应显示机器人图标', () => {
      const claudeIntegration = { ...mockAppIntegration, provider: 'claude' as const };
      render(
        <AppIntegrationCard
          integration={claudeIntegration}
          assistants={[]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      expect(screen.getByText('🤖')).toBeInTheDocument();
    });

    it('ChatGPT应显示对话图标', () => {
      const chatgptIntegration = { ...mockAppIntegration, provider: 'chatgpt' as const };
      render(
        <AppIntegrationCard
          integration={chatgptIntegration}
          assistants={[]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      expect(screen.getByText('💬')).toBeInTheDocument();
    });
  });

  describe('TC-APP-CARD-007: 禁用状态样式', () => {
    it('禁用的卡片应有disabled类', () => {
      const disabledIntegration = { ...mockAppIntegration, enabled: false };
      const { container } = render(
        <AppIntegrationCard
          integration={disabledIntegration}
          assistants={[]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onToggleEnabled={mockOnToggleEnabled}
        />
      );

      const card = container.querySelector('.integration-card');
      expect(card).toHaveClass('disabled');
    });
  });
});
