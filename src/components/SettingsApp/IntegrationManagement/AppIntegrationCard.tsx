/**
 * App Integration Card
 *
 * Meta-Name: App Integration Card
 * Meta-Description: Modern card component for displaying app integration details
 *
 * Design: Refined minimalism with precise spacing, subtle shadows, and smooth animations
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppIntegration } from '@/types/character';
import type { Assistant } from '@/types/character';
import type { CharacterIntegration } from '@/stores/integrationStore';
import './AppIntegrationCard.css';

export interface AppIntegrationCardProps {
  /** Application integration data */
  integration: AppIntegration;
  /** List of all assistants (to show bound ones) */
  assistants: Assistant[];
  /** List of character integrations (to show bound characters) */
  characterIntegrations: CharacterIntegration[];
  /** Edit callback */
  onEdit: (integration: AppIntegration) => void;
  /** Delete callback */
  onDelete: (integration: AppIntegration) => void;
  /** Toggle enabled callback */
  onToggleEnabled: (id: string, enabled: boolean) => Promise<void>;
}

export function AppIntegrationCard({
  integration,
  assistants,
  characterIntegrations,
  onEdit,
  onDelete,
  onToggleEnabled,
}: AppIntegrationCardProps) {
  const { t } = useTranslation(['settings', 'common']);
  const [toggling, setToggling] = useState(false);

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

  // Get assistants bound to this integration (via assistant.integrations)
  const getBoundAssistants = () => {
    return assistants.filter((assistant) =>
      assistant.integrations?.some(
        (int) => int.params.applicationId === integration.applicationId
      )
    );
  };

  // Get character integrations bound to this app integration
  const getBoundCharacterIntegrations = () => {
    return characterIntegrations.filter(
      (ci) => ci.integration.integrationId === integration.id
    );
  };

  const boundAssistants = getBoundAssistants();
  const boundCharacterIntegrations = getBoundCharacterIntegrations();
  const isEnabled = integration.enabled !== false;
  const hasBindings = boundAssistants.length > 0 || boundCharacterIntegrations.length > 0;

  // Connection status (simulated - in real app, would check actual connection)
  const connectionStatus = isEnabled ? 'connected' : 'disconnected';

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

  return (
    <div className={`app-integration-card ${!isEnabled ? 'disabled' : ''}`}>
      {/* Card Header */}
      <div className="card-header">
        <div className="card-left">
          <span className="provider-icon">{getProviderIcon(integration.provider)}</span>
          <div className="card-title-section">
            <h3 className="card-title">{integration.name}</h3>
            <span className="card-provider">{integration.provider}</span>
          </div>
        </div>
        {/* Connection Status Indicator - Top Right */}
        <div className={`connection-status-indicator ${connectionStatus}`}>
          <span className={`status-dot ${connectionStatus}`}></span>
          <span className="status-text">
            {connectionStatus === 'connected' ? t('common:connected') : t('common:disconnected')}
          </span>
        </div>
      </div>

      {/* Card Content */}
      <div className="card-content">
        <div className="info-row">
          <span className="info-label">{t('integration.appId')}:</span>
          <span className="info-value mono">{integration.applicationId}</span>
        </div>
        <div className="info-row">
          <span className="info-label">{t('integration.endpoint')}:</span>
          <span className="info-value mono">{extractHostname(integration.endpoint)}</span>
        </div>
        {integration.description && (
          <div className="info-row">
            <span className="info-label">{t('integration.description')}:</span>
            <span className="info-value">{integration.description}</span>
          </div>
        )}
        <div className="info-row">
          <span className="info-label">{t('integration.boundAssistants')}:</span>
          <div className="info-value">
            {boundAssistants.length > 0 || boundCharacterIntegrations.length > 0 ? (
              <div className="bound-list">
                {boundAssistants.length > 0 && (
                  <div className="bound-section">
                    {boundAssistants.map(assistant => (
                      <span key={assistant.id} className="bound-item">
                        🤖 {assistant.name}
                      </span>
                    ))}
                  </div>
                )}
                {boundCharacterIntegrations.length > 0 && (
                  <div className="bound-section">
                    {boundCharacterIntegrations.map(ci => (
                      <span key={ci.id} className="bound-item">
                        👤 {ci.assistantName} / {ci.characterName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <span className="empty-value">{t('integration.none')}</span>
            )}
          </div>
        </div>
      </div>

      {/* Card Footer - Bottom Actions */}
      <div className="card-footer">
        {/* Bottom Left - Toggle Switch */}
        <div className="card-footer-left">
          <label className={`toggle-switch ${toggling ? 'animating' : ''}`}>
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={handleToggle}
              disabled={toggling}
            />
            <span className="toggle-slider">
              <span className="toggle-knob"></span>
            </span>
            <span className="toggle-label">
              {isEnabled ? t('integration.enabled') : t('integration.disabled')}
            </span>
          </label>
        </div>

        {/* Bottom Right - Action Buttons */}
        <div className="card-footer-right">
          <button
            className="icon-btn edit-btn"
            onClick={() => onEdit(integration)}
            title={t('integration.edit')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M13.5 6.5L3 17M9 11l4.5-4.5M13 3l3 3-3 3" />
            </svg>
          </button>
          <button
            className="icon-btn delete-btn"
            onClick={() => onDelete(integration)}
            disabled={hasBindings}
            title={hasBindings ? t('integration.deleteHasBindingsWarning') : t('integration.deleteIntegration')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 4h10M5 4v9a2 2 0 002 2h2a2 2 0 002-2V4M7 4V2a1 1 0 011-1h2a1 1 0 011 1v2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
