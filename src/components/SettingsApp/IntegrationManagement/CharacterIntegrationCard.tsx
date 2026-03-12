/**
 * Character Integration Card
 *
 * Meta-Name: Character Integration Card
 * Meta-Description: Card component displaying character-app integration binding
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CharacterIntegration, AppIntegration } from '@/types/character';

export interface CharacterIntegrationCardProps {
  /** Character integration data */
  integration: CharacterIntegration;
  /** App integrations (to get app name/endpoint) */
  appIntegrations: AppIntegration[];
  /** Edit callback */
  onEdit: (integration: CharacterIntegration) => void;
  /** Delete callback */
  onDelete: (integration: CharacterIntegration) => void;
  /** Toggle enabled callback */
  onToggleEnabled: (id: string, enabled: boolean) => Promise<void>;
}

export function CharacterIntegrationCard({
  integration,
  appIntegrations,
  onEdit,
  onDelete,
  onToggleEnabled,
}: CharacterIntegrationCardProps) {
  const { t } = useTranslation('settings');
  const [toggling, setToggling] = useState(false);

  // Find related app integration
  const appIntegration = appIntegrations.find(
    (app) => app.id === integration.integration.integrationId
  );

  // Get provider icon
  const getProviderIcon = (provider: string) => {
    const icons: Record<string, string> = {
      openclaw: '🦞',
      claude: '🤖',
      chatgpt: '💬',
    };
    return icons[provider] || '🔌';
  };

  // Extract hostname from endpoint
  const extractHostname = (endpoint: string) => {
    try {
      const url = new URL(endpoint);
      return url.hostname || endpoint;
    } catch {
      return endpoint;
    }
  };

  const isEnabled = integration.enabled !== false;

  // Handle toggle
  const handleToggle = async () => {
    if (toggling) return;
    setToggling(true);
    try {
      await onToggleEnabled(integration.id, !isEnabled);
    } finally {
      setToggling(false);
    }
  };

  // Get session key for display (support both sessionKey string and sessionKeys array)
  const sessionKey = (integration.integration.params?.sessionKey as string | undefined)
    || (integration.integration.params?.sessionKeys as string[] | undefined)?.[0];

  return (
    <div className={`character-integration-card ${!isEnabled ? 'disabled' : ''}`}>
      {/* Card Header */}
      <div className="character-card-header">
        <h4 className="character-title">
          <span>{integration.assistantName}</span>
          <span className="separator">/</span>
          <span>{integration.characterName}</span>
        </h4>
        <div className="card-toggle" style={{ transform: 'scale(0.85)' }}>
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={handleToggle}
            disabled={toggling}
          />
          <span className="card-toggle-slider"></span>
        </div>
      </div>

      {/* Card Details */}
      <div className="character-details">
        <div className="character-detail-row">
          <span className="character-detail-label">{t('integration.appType')}:</span>
          <span className="character-detail-value">
            {appIntegration && (
              <>
                {getProviderIcon(appIntegration.provider)} {appIntegration.name}
                {` (${extractHostname(appIntegration.endpoint)})`}
              </>
            )}
            {!appIntegration && <span style={{ color: 'var(--dj-danger)' }}>Unknown App</span>}
          </span>
        </div>
        <div className="character-detail-row">
          <span className="character-detail-label">{t('integration.agentId')}:</span>
          <span className="character-detail-value">{integration.integration.agentId}</span>
        </div>
        {sessionKey && (
          <div className="character-detail-row">
            <span className="character-detail-label">{t('integration.sessionKey')}:</span>
            <span className="character-detail-value">{sessionKey}</span>
          </div>
        )}
      </div>

      {/* Card Actions */}
      <div className="character-card-actions">
        <button
          className="card-action-btn primary"
          onClick={() => onEdit(integration)}
          style={{ flex: 1 }}
        >
          {t('integration.editBinding')}
        </button>
        <button
          className="card-action-btn danger"
          onClick={() => onDelete(integration)}
          style={{ flex: 1 }}
        >
          {t('integration.deleteBinding')}
        </button>
      </div>
    </div>
  );
}
