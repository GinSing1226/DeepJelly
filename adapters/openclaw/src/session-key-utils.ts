/**
 * Session Key Utilities
 *
 * Re-exports key functions and constants from OpenClaw's session-key module
 * for use in the DeepJelly plugin.
 */

export const DEFAULT_ACCOUNT_ID = "default";
export const DEFAULT_AGENT_ID = "main";
export const DEFAULT_MAIN_KEY = "main";

/**
 * Parse an agent session key into its components
 * Format: agent:<agentId>[:...]
 */
export function parseAgentSessionKey(sessionKey: string): { agentId: string; rest: string } | null {
  if (!sessionKey || !sessionKey.startsWith('agent:')) {
    return null;
  }

  const parts = sessionKey.split(':');
  if (parts.length < 2) {
    return null;
  }

  const agentId = parts[1];
  const rest = parts.slice(2).join(':');

  return { agentId, rest };
}

/**
 * Normalize account ID to a valid format
 */
export function normalizeAccountId(value: string | undefined | null): string {
  return (value || DEFAULT_ACCOUNT_ID).trim().toLowerCase();
}

/**
 * Normalize optional account ID
 */
export function normalizeOptionalAccountId(value: string | undefined | null): string | undefined {
  const trimmed = (value || '').trim();
  return trimmed ? trimmed.toLowerCase() : undefined;
}
