/**
 * Endpoint Configuration Types
 *
 * Types for DeepJelly HTTP API endpoint configuration
 * @module types/endpoint
 */

/**
 * DeepJelly HTTP API endpoint configuration
 *
 * Represents the endpoint where DeepJelly HTTP server is accessible.
 * Configuration is stored in data/user/endpoint.json
 */
export interface EndpointConfig {
  /** DeepJelly server host address */
  host: string;

  /** DeepJelly HTTP server port (default: 12260) */
  port: number;
}

/**
 * Create endpoint configuration DTO
 */
export interface CreateEndpointConfigDTO {
  host: string;
  port: number;
}

/**
 * Update endpoint configuration DTO
 * All fields are optional for partial updates
 */
export interface UpdateEndpointConfigDTO {
  host?: string;
  port?: number;
}
