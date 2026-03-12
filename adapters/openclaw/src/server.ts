/**
 * DeepJelly WebSocket Server
 *
 * Implements the BrainAdapter interface that DeepJelly clients connect to.
 * Handles JSON-RPC 2.0 requests and broadcasts CAP events to connected clients.
 */

// Try to load ws from OpenClow's dependencies first
let WebSocketServer: any, WebSocket: any;
try {
  const ws = require("ws");
  WebSocketServer = ws.WebSocketServer;
  WebSocket = ws.WebSocket;
} catch (e) {
  throw new Error(
    "ws module not found. Please install it in the plugin directory: npm install ws"
  );
}
import type {
  DeepJellyConfig,
  ConnectedClient,
  ServerStatus,
  ConnectedClientInfo,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCError,
  CAPMessage,
  Assistant,
  Message,
  SessionState,
  OpenClawRuntime,
  InboundContext,
  DeliverPayload,
  DeliverInfo,
} from "./types";
import * as Converter from "./converter";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { DEFAULT_ACCOUNT_ID } from "./session-key-utils";

// ============================================================================
// Gateway Configuration Resolution
// ============================================================================

/**
 * Resolve Gateway authentication token from multiple sources
 *
 * Priority order (matches dingtalk plugin):
 * 1. Channel config (deepjellyCfg.gatewayToken)
 * 2. Environment variable (OPENCLAW_GATEWAY_TOKEN)
 * 3. OpenClaw config file (~/.openclaw/openclaw.json)
 *
 * This allows the plugin to work even when api.runtime is undefined
 */
function resolveGatewayAuthToken(logger?: { warn: (msg: string) => void }): string | undefined {
  // Priority 1: Check environment variables
  const envToken = process.env.OPENCLAW_GATEWAY_TOKEN || process.env.OPENCLAW_GATEWAY_PASSWORD;
  if (envToken) {
    return envToken;
  }

  // Priority 2: Read from OpenClaw config file
  try {
    const home = os.homedir();
    const candidates = [
      path.join(home, ".openclaw", "openclaw.json"),
      path.join(home, ".openclaw", "config.json"),
    ];

    for (const filePath of candidates) {
      if (!fs.existsSync(filePath)) continue;

      const raw = fs.readFileSync(filePath, "utf8");
      const cleaned = raw.replace(/^\uFEFF/, "").trim();
      if (!cleaned) continue;

      const cfg = JSON.parse(cleaned) as Record<string, unknown>;
      const gateway = (cfg.gateway as Record<string, unknown> | undefined) ?? {};
      const auth = (gateway.auth as Record<string, unknown> | undefined) ?? {};

      const mode = typeof auth.mode === "string" ? auth.mode : "";
      const token = typeof auth.token === "string" ? auth.token : "";
      const password = typeof auth.password === "string" ? auth.password : "";

      if (mode === "token" && token) return token;
      if (mode === "password" && password) return password;
      if (token) return token;
      if (password) return password;
    }
  } catch (error: any) {
    logger?.warn?.(`[DeepJelly] Failed to read gateway config: ${error.message}`);
  }

  logger?.warn?.("[DeepJelly] Gateway auth token not found in environment or config file");
  return undefined;
}

/**
 * Resolve Gateway port from multiple sources
 *
 * Priority order:
 * 1. Environment variable (OPENCLAW_GATEWAY_PORT)
 * 2. OpenClaw config file (~/.openclaw/openclaw.json)
 * 3. Default port (18789)
 */
function resolveGatewayPort(): number {
  // Priority 1: Check environment variable
  const envPort = process.env.OPENCLAW_GATEWAY_PORT;
  if (envPort) {
    const port = parseInt(envPort, 10);
    if (!isNaN(port) && port > 0 && port < 65536) {
      return port;
    }
  }

  // Priority 2: Read from OpenClaw config file
  try {
    const home = os.homedir();
    const candidates = [
      path.join(home, ".openclaw", "openclaw.json"),
      path.join(home, ".openclaw", "config.json"),
    ];

    for (const filePath of candidates) {
      if (!fs.existsSync(filePath)) continue;

      const raw = fs.readFileSync(filePath, "utf8");
      const cleaned = raw.replace(/^\uFEFF/, "").trim();
      if (!cleaned) continue;

      const cfg = JSON.parse(cleaned) as Record<string, unknown>;
      const gateway = (cfg.gateway as Record<string, unknown> | undefined) ?? {};
      const port = typeof gateway.port === "number" ? gateway.port : undefined;

      if (port && port > 0 && port < 65536) {
        return port;
      }
    }
  } catch (error: any) {
    // Silently ignore config read errors
  }

  // Priority 3: Default port
  return 18789;
}

/**
 * Ensure Gateway HTTP API endpoint is enabled
 *
 * OpenClaw Gateway requires explicit enabling of http.endpoints.chatCompletions
 * to expose the /v1/chat/completions endpoint that we use for sending messages.
 */
async function ensureGatewayHttpEnabled(): Promise<void> {
  const home = os.homedir();
  const candidates = [
    path.join(home, ".openclaw", "openclaw.json"),
    path.join(home, ".openclaw", "config.json"),
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;

    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const cleaned = raw.replace(/^\uFEFF/, "").trim();
      if (!cleaned) continue;

      const cfg = JSON.parse(cleaned) as Record<string, unknown>;
      const gateway = (cfg.gateway as Record<string, unknown> | undefined) ?? {};
      const http = (gateway.http as Record<string, unknown> | undefined) ?? {};
      const endpoints = (http.endpoints as Record<string, unknown> | undefined) ?? {};
      const chatCompletions = (endpoints.chatCompletions as Record<string, unknown> | undefined) ?? {};

      if (chatCompletions.enabled === true) {
        console.log(`[DeepJelly] Gateway HTTP endpoint already enabled in ${filePath}`);
        return;
      }

      // Enable the chatCompletions endpoint
      chatCompletions.enabled = true;
      endpoints.chatCompletions = chatCompletions;
      http.endpoints = endpoints;
      gateway.http = http;
      cfg.gateway = gateway;

      fs.writeFileSync(filePath, `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
      console.log(`[DeepJelly] ✅ Enabled http.endpoints.chatCompletions in ${filePath}`);
      console.log(`[DeepJelly] ⚠️ Please restart OpenClaw gateway to apply the change`);
      return;
    } catch (error: any) {
      console.warn(`[DeepJelly] Failed to update gateway config: ${error.message}`);
    }
  }

  console.log(`[DeepJelly] ⚠️ Could not find OpenClaw config file to enable HTTP endpoint`);
  console.log(`[DeepJelly] Please manually add this to your ~/.openclaw/openclaw.json:`);
  const exampleConfig = {
    gateway: {
      http: {
        endpoints: {
          chatCompletions: {
            enabled: true
          }
        }
      }
    }
  };
  console.log(JSON.stringify(exampleConfig, null, 2));
}

// ============================================================================
// DeepJelly WebSocket Server
// ============================================================================

export class DeepJellyServer {
  private wss: any = null;
  private httpServer: any = null; // HTTP server for handling WebSocket upgrade
  private clients: Map<string, ConnectedClient> = new Map();
  private config: DeepJellyConfig;
  private assistantCache: Assistant[] | null = null;
  private api: any = null; // Plugin API reference for sending messages to OpenClow
  private runtime: OpenClawRuntime | null = null; // OpenClow Runtime for dispatching to agents

  constructor(config: DeepJellyConfig) {
    this.config = config;
  }

  /**
   * Set the PluginAPI reference
   */
  setApi(api: any): void {
    this.api = api;
    console.log('[DeepJelly] Plugin API reference set');
  }

  /**
   * Set the OpenClow Runtime for dispatching messages to agents
   * This enables direct plugin-to-agent communication instead of CLI calls
   */
  setRuntime(runtime: OpenClawRuntime): void {
    this.runtime = runtime;
    console.log('[DeepJelly] OpenClow Runtime set - dispatcher ready');
  }

  /**
   * Check if dispatcher is available (runtime is set and has reply API)
   */
  private hasDispatcher(): boolean {
    return !!(
      this.runtime?.channel?.reply?.dispatchReplyWithBufferedBlockDispatcher ||
      this.runtime?.channel?.reply?.dispatchReplyFromConfig
    );
  }

  /**
   * Get character ID for a given session key from accounts config
   * @param sessionKey - Session key (e.g., "agent:coder_1:main")
   * @returns Character ID or default from config
   */
  private getCharacterIdForSession(sessionKey: string): string {
    // Try exact match with session key
    if (this.config.accounts?.[sessionKey]?.characterId) {
      return this.config.accounts[sessionKey].characterId;
    }

    // Try matching with agent ID (for session keys like "agent:xxx:...")
    const agentMatch = sessionKey.match(/^agent:([^:]+)(?::|$)/);
    if (agentMatch && this.config.accounts?.[agentMatch[1]]?.characterId) {
      return this.config.accounts[agentMatch[1]].characterId;
    }

    // Fall back to default characterId from config
    return this.config.characterId || "character";
  }

  /**
   * Get application ID for sender identification
   * @returns Application ID or default "openclaw"
   */
  private getApplicationId(): string {
    return this.config.applicationId || "openclaw";
  }

  /**
   * Get agent ID from session key
   * @param sessionKey - Session key (e.g., "agent:coder_1:main")
   * @returns Agent ID or session key if not in agent format
   */
  private getAgentIdFromSession(sessionKey: string): string {
    const match = sessionKey.match(/^agent:([^:]+)(?::|$)/);
    return match ? match[1] : sessionKey;
  }

  /**
   * Start the WebSocket server
   */
  async start(): Promise<void> {
    if (this.wss) {
      throw new Error("Server is already running");
    }

    // Ensure Gateway HTTP API endpoint is enabled
    await ensureGatewayHttpEnabled();

    console.log(`[DeepJelly Server] =======================================`);
    console.log(`[DeepJelly Server] 🚀 Starting WebSocket server...`);
    console.log(`[DeepJelly Server]   host: ${this.config.serverHost}`);
    console.log(`[DeepJelly Server]   port: ${this.config.serverPort}`);

    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server to handle WebSocket upgrade with path checking
        const http = require('http');
        this.httpServer = http.createServer();

        this.wss = new WebSocketServer({
          noServer: true, // Handle upgrade manually to support path
        });

        // Handle HTTP upgrade requests - only allow /ws path
        this.httpServer.on('upgrade', (request: any, socket: any, head: any) => {
          const fullUrl = request.url || '/';
          // Extract pathname (remove query string)
          const pathname = fullUrl.split('?')[0];
          console.log(`[DeepJelly Server] Upgrade request for path: ${pathname} (full: ${fullUrl})`);

          // Accept /ws or / (for backward compatibility)
          if (pathname === '/ws' || pathname === '/') {
            console.log(`[DeepJelly Server] Accepting WebSocket upgrade for path: ${pathname}`);
            this.wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
              this.wss.emit('connection', ws, request);
            });
          } else {
            console.warn(`[DeepJelly Server] Rejecting upgrade for invalid path: ${pathname}`);
            socket.destroy();
          }
        });

        this.httpServer.listen(this.config.serverPort, this.config.serverHost, () => {
          console.log(`[DeepJelly Server] ✅ WebSocket server is listening`);
          console.log(`[DeepJelly Server]   Bound to: ${this.config.serverHost}:${this.config.serverPort}`);
          resolve();
        });

        this.httpServer.on('error', (error: any) => {
          if (error.code === 'EADDRINUSE') {
            reject(new Error(
              `Port ${this.config.serverPort} is already in use. ` +
              `Run 'lsof -i :${this.config.serverPort}' to find the process.`
            ));
          } else {
            reject(error);
          }
        });

        this.wss.on("connection", (ws: WebSocket, req) => {
          this.handleConnection(ws, req);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    if (!this.wss) {
      return;
    }

    // Close all client connections
    this.clients.forEach((client) => {
      client.ws.close();
    });
    this.clients.clear();

    // Close the WebSocket server
    this.wss.close();
    this.wss = null;

    // Close the HTTP server
    if (this.httpServer) {
      return new Promise((resolve) => {
        this.httpServer.close(() => {
          this.httpServer = null;
          resolve();
        });
      });
    }
  }

  /**
   * Get server status
   */
  getStatus(): ServerStatus {
    return {
      running: this.wss !== null,
      port: this.config.serverPort,
      host: this.config.serverHost,
      connected_clients: this.clients.size,
      clients: this.getClientInfos(),
    };
  }

  /**
   * Get agentId by characterId from character_integrations.json
   *
   * @param characterId - Character ID to look up
   * @returns Agent ID if found, undefined otherwise
   */
  private getAgentIdByCharacterId(characterId: string): string | undefined {
    console.log(`[DeepJelly Plugin] getAgentIdByCharacterId called: characterId=${characterId}`);

    // Try to resolve data directory from environment or config
    // Priority: 1. DEEPJELLY_DATA_DIR env var
    //           2. Current working directory /data/user
    //           3. Parent directory /data/user (for development)
    const dataDir = process.env.DEEPJELLY_DATA_DIR ||
                    path.join(process.cwd(), 'data', 'user');

    const integrationsPath = path.join(dataDir, 'character_integrations.json');

    console.log(`[DeepJelly Plugin] Reading integrations from: ${integrationsPath}`);

    try {
      if (!fs.existsSync(integrationsPath)) {
        console.warn(`[DeepJelly Plugin] character_integrations.json not found at ${integrationsPath}`);
        return undefined;
      }

      const raw = fs.readFileSync(integrationsPath, 'utf8');
      const data = JSON.parse(raw) as { bindings: Array<{ characterId: string; integration: { agentId: string } }> };

      // Find binding by characterId
      const binding = data.bindings.find(b => b.characterId === characterId);

      if (binding) {
        const agentId = binding.integration.agentId;
        console.log(`[DeepJelly Plugin] ✅ Found mapping: characterId=${characterId} -> agentId=${agentId}`);
        return agentId;
      }

      console.warn(`[DeepJelly Plugin] ⚠️ No binding found for characterId: ${characterId}`);
      return undefined;
    } catch (error: any) {
      console.error(`[DeepJelly Plugin] ❌ Error reading character_integrations.json: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Broadcast a CAP message to all connected clients
   */
  broadcast(message: CAPMessage): number {
    const data = JSON.stringify(message);
    let sent = 0;

    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(data);
          sent++;
          console.log(`[DeepJelly] Broadcast to ${client.id}: ${message.type}`);
        } catch (error) {
          console.error(`[DeepJelly] Failed to send to ${client.id}:`, error);
        }
      }
    });

    return sent;
  }

  /**
   * Send a CAP message to a specific client
   */
  sendTo(clientId: string, message: CAPMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.ws.send(JSON.stringify(message));
      console.log(`[DeepJelly] Sent to ${clientId}: ${message.type}`);
      return true;
    } catch (error) {
      console.error(`[DeepJelly] Failed to send to ${clientId}:`, error);
      return false;
    }
  }

  // Connection Handling
  // ========================================================================

  private handleConnection(ws: WebSocket, req: any): void {
    console.log(`[DeepJelly Server] =======================================`);
    console.log(`[DeepJelly Server] 🔌 New connection attempt`);
    console.log(`[DeepJelly Server]   URL: ${req.url}`);
    console.log(`[DeepJelly Server]   Headers: ${JSON.stringify(req.headers)}`);

    // Extract token from URL query parameters
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const clientToken = url.searchParams.get("token");

    // Extract role and scopes from URL parameters
    const role = url.searchParams.get("role") || "client";
    const scopesParam = url.searchParams.get("scopes");
    const scopes = scopesParam ? scopesParam.split(",") : [];

    console.log(`[DeepJelly Server] Connection params: role=${role}, scopes=[${scopes.join(", ")}]`);
    console.log(`[DeepJelly Server] Client token: ${clientToken ? `${clientToken.substring(0, 8)}...(${clientToken.length} chars)` : '(none)'}`);
    console.log(`[DeepJelly Server] Server token: ${this.config.gatewayToken ? `${this.config.gatewayToken.substring(0, 8)}...(${this.config.gatewayToken.length} chars)` : '(none)'}`);

    // Verify token if gatewayToken is configured
    if (this.config.gatewayToken) {
      if (!clientToken) {
        console.warn(`[DeepJelly Server] ❌ Connection rejected: No token provided`);
        ws.close(1008, "Authentication token required");
        return;
      }
      if (clientToken !== this.config.gatewayToken) {
        console.warn(`[DeepJelly Server] ❌ Connection rejected: Invalid token (mismatch)`);
        ws.close(1008, "Invalid authentication token");
        return;
      }
      console.log(`[DeepJelly Server] ✅ Token verified for connection`);
    } else {
      console.log(`[DeepJelly Server] ⚠️ No gateway token configured, accepting connection without authentication`);
    }

    // Check if operator.read permission is requested for getAssistants
    const needsOperatorRead = scopes.includes("operator.read");
    if (needsOperatorRead && role !== "operator") {
      console.warn(`[DeepJelly] Connection rejected: operator.read scope requires operator role`);
      ws.close(1008, "Insufficient permissions: operator.read requires operator role");
      return;
    }

    if (needsOperatorRead) {
      console.log(`[DeepJelly] ✅ Operator permissions granted for connection`);
    }

    const clientId = this.generateClientId();
    const wsAny = ws as any;
    const now = Date.now();

    const client: ConnectedClient = {
      id: clientId,
      ws,
      connectedAt: now,
      lastPing: now,
    };

    this.clients.set(clientId, client);
    console.log(`[DeepJelly Server] ✅ Client registered: ${clientId}`);
    console.log(`[DeepJelly Server]    Total clients: ${this.clients.size}`);

    // Setup message handler
    wsAny.on("message", (data: Buffer) => {
      console.log(`[DeepJelly Server] 📨 Message received from ${clientId}`);
      this.handleMessage(clientId, data);
    });

    // Setup close handler
    wsAny.on("close", () => {
      this.clients.delete(clientId);
    });

    // Setup error handler
    wsAny.on("error", (error) => {
      console.error(`[DeepJelly] Client ${clientId} error:`, error);
      this.clients.delete(clientId);
    });

    // Send welcome message
    this.sendResponse(clientId, {
      jsonrpc: "2.0",
      id: null,
      result: {
        event: "connected",
        client_id: clientId,
        server_time: Math.floor(Date.now() / 1000),
      },
    });
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ========================================================================
  // Message Handling (JSON-RPC 2.0)
  // ========================================================================

  private async handleMessage(clientId: string, data: Buffer): Promise<void> {
    console.log(`[DeepJelly Plugin] =======================================`);
    console.log(`[DeepJelly Plugin] Received message from client: ${clientId}`);
    console.log(`[DeepJelly Plugin] Raw data length: ${data.length} bytes`);

    try {
      const request: JSONRPCRequest = JSON.parse(data.toString());
      const { id, method, params } = request;

      console.log(`[DeepJelly Plugin] Parsed JSON-RPC request:`);
      console.log(`[DeepJelly Plugin]   id: ${id}`);
      console.log(`[DeepJelly Plugin]   method: ${method}`);
      console.log(`[DeepJelly Plugin]   params:`, params);

      // Update last ping
      const client = this.clients.get(clientId);
      if (client) {
        client.lastPing = Date.now();
      }

      let result: any;
      try {
        console.log(`[DeepJelly Plugin] Executing method: ${method}`);
        switch (method) {
          case "get_assistants":
            console.log(`[DeepJelly Plugin] -> getAssistants`);
            result = await this.getAssistants();
            break;
          case "get_assistant":
            console.log(`[DeepJelly Plugin] -> getAssistant`);
            result = await this.getAssistant(params?.assistant_id);
            break;
          case "get_all_sessions":
            console.log(`[DeepJelly Plugin] -> getAllSessions`);
            result = await this.getAllSessions(params?.characterId, params?.limit);
            break;
          case "get_session_history":
            console.log(`[DeepJelly Plugin] -> getSessionHistory`);
            result = await this.getSessionHistory(
              params?.session_id,
              params?.limit || 50,
              params?.offset || 0,
              params?.beforeTimestamp
            );
            break;
          case "get_session_state":
            console.log(`[DeepJelly Plugin] -> getSessionState`);
            result = await this.getSessionState(params?.session_id);
            break;
          case "send_message":
            console.log(`[DeepJelly Plugin] -> sendMessage`);
            console.log(`[DeepJelly Plugin]    params object:`, JSON.stringify(params));
            console.log(`[DeepJelly Plugin]    params?.sessionId:`, params?.sessionId);
            console.log(`[DeepJelly Plugin]    params?.session_id:`, params?.session_id);
            // Support both sessionId (camelCase) and session_id (snake_case) for compatibility
            const sessionId = params?.sessionId || params?.session_id;
            console.log(`[DeepJelly Plugin]    ✅ Final sessionId: ${sessionId}`);
            console.log(`[DeepJelly Plugin]    content length: ${params?.content?.length || 0}`);
            result = await this.sendMessage(sessionId, params?.content);
            break;
          case "ping":
            console.log(`[DeepJelly Plugin] -> ping`);
            result = { pong: Date.now() };
            break;
          default:
            console.log(`[DeepJelly Plugin] -> UNKNOWN METHOD: ${method}`);
            throw this.createError(-32601, "Method not found", { method });
        }

        console.log(`[DeepJelly Plugin] Method executed successfully, sending response`);
        this.sendResponse(clientId, { jsonrpc: "2.0", id, result });
      } catch (error: any) {
        console.error(`[DeepJelly Plugin] Error executing method:`, error);
        this.sendError(clientId, {
          jsonrpc: "2.0",
          id,
          error: error.code ? error : this.createError(-32603, "Internal error", error.message),
        });
      }
    } catch (error) {
      // Invalid JSON
      console.error(`[DeepJelly Plugin] Failed to parse JSON-RPC request:`, error);
      this.sendError(clientId, {
        jsonrpc: "2.0",
        id: null,
        error: this.createError(-32700, "Parse error", "Invalid JSON format"),
      });
    }
  }

  private sendResponse(clientId: string, response: JSONRPCResponse): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      client.ws.send(JSON.stringify(response));
    } catch (error) {
      // Client disconnected
    }
  }

  private sendError(
    clientId: string,
    response: JSONRPCResponse,
  ): void {
    this.sendResponse(clientId, response);
  }

  private createError(code: number, message: string, data?: any): JSONRPCError {
    return { code, message, data };
  }

  // ========================================================================
  // BrainAdapter Method Implementations
  // ========================================================================

  /**
   * Get list of assistants (OpenClaw agents)
   * Uses OpenClow's Gateway RPC API to get the agent list
   */
  private async getAssistants(): Promise<Assistant[]> {
    try {
      console.log('[DeepJelly] getAssistants: Reading from config...');

      // Method 1: Read from config (agents.list)
      const agentsList = this.config.agents;
      if (Array.isArray(agentsList) && agentsList.length > 0) {
        console.log(`[DeepJelly] Found ${agentsList.length} agents in config`);
        return this.mapAgents(agentsList);
      }

      console.log('[DeepJelly] No agents in config, returning mock data');
      return [
        {
          id: "mock-claude",
          name: "Claude (Mock)",
          model: "claude-sonnet-4",
          description: "Mock assistant for testing",
          status: "idle"
        },
        {
          id: "mock-gpt",
          name: "GPT-4 (Mock)",
          model: "gpt-4",
          description: "Mock assistant for testing",
          status: "idle"
        }
      ];

    } catch (error) {
      console.error('[DeepJelly] Failed to get agents:', error);
      return [];
    }
  }

  /**
   * Map OpenClow agents to DeepJelly Assistant format
   */
  private mapAgents(agents: any): Assistant[] {
    if (!Array.isArray(agents)) {
      console.log('[DeepJelly] mapAgents: agents is not an array, type:', typeof agents);
      return [];
    }

    const assistants: Assistant[] = [];

    for (const agent of agents) {
      // Log raw agent data for debugging
      console.log(`[DeepJelly] Raw agent data:`, JSON.stringify(agent, null, 2));

      const emoji = agent.identityEmoji || '';
      const model = agent.model || '';

      // Use agent.id if available, otherwise fall back to name or identityName
      let agentId = agent.id;
      if (!agentId || agentId === 'undefined' || agentId === '') {
        agentId = agent.identityName || agent.name;
        console.warn(`[DeepJelly] ⚠️ Agent missing 'id' field, using '${agentId}' as fallback`);
      }

      assistants.push({
        id: agentId,
        name: agent.identityName || agent.name || agentId,
        description: emoji ? `${emoji} ${model}` : model,
        status: agent.status || 'idle',
        model: model,
      });
      console.log(`[DeepJelly] ✅ Mapped agent: id="${agentId}" -> name="${agent.identityName || agent.name}"`);
    }

    return assistants;
  }

  /**
   * Get details of a specific assistant
   */
  private async getAssistant(assistantId?: string): Promise<Assistant> {
    // Stub implementation
    return {
      id: assistantId || "main",
      name: "Assistant",
      description: "Your AI assistant",
      status: "idle",
      model: "gpt-4",
      created_at: Math.floor(Date.now() / 1000),
      sessions_count: 1,
    };
  }

  /**
   * Get session message history from OpenClaw
   * Reads the session .jsonl file from ~/.openclaw/sessions/
   */
  private async getSessionHistory(
    sessionId: string,
    limit: number = 50,
    offset: number = 0,
    beforeTimestamp?: number,
  ): Promise<{ messages: Message[] }> {
    console.log(`[DeepJelly Plugin] =======================================`);
    console.log(`[DeepJelly Plugin] getSessionHistory called (via HTTP API):`);
    console.log(`[DeepJelly Plugin]   session_id: ${sessionId}`);
    console.log(`[DeepJelly Plugin]   limit: ${limit}`);
    console.log(`[DeepJelly Plugin]   offset: ${offset}`);
    console.log(`[DeepJelly Plugin]   beforeTimestamp: ${beforeTimestamp || 'none'}`);

    // Use sessionId directly as sessionKey (no transformation)
    // Frontend is responsible for providing the correct session key format
    const sessionKey = sessionId;
    console.log(`[DeepJelly Plugin]   sessionKey: ${sessionKey}`);

    // Get Gateway configuration
    const gatewayPort = this.config.gatewayPort || 18789;
    const gatewayToken = this.config.gatewayToken;

    if (!gatewayToken) {
      console.error(`[DeepJelly Plugin] ❌ gatewayToken not configured`);
      return { messages: [] };
    }

    try {
      const response = await fetch(`http://127.0.0.1:${gatewayPort}/tools/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${gatewayToken}`,
        },
        body: JSON.stringify({
          tool: 'sessions_history',
          args: {
            sessionKey: sessionKey,
            limit: limit,
            offset: offset,
            includeTools: false
          }
        })
      });

      if (!response.ok) {
        console.error(`[DeepJelly Plugin] ❌ HTTP error: ${response.status} ${response.statusText}`);
        return { messages: [] };
      }

      const data: any = await response.json();
      console.log(`[DeepJelly Plugin] ======== sessions_history response ========`);
      console.log(`[DeepJelly Plugin] sessionKey: ${sessionKey}`);
      console.log(`[DeepJelly Plugin] Full response:`, JSON.stringify(data, null, 2));
      console.log(`[DeepJelly Plugin] data.result:`, data.result ? JSON.stringify(data.result, null, 2) : 'undefined');
      console.log(`[DeepJelly Plugin] data.result?.details:`, data.result?.details ? JSON.stringify(data.result.details, null, 2) : 'undefined');
      console.log(`[DeepJelly Plugin] data.result?.details?.messages:`, data.result?.details?.messages);

      // Check for forbidden/error status in response
      const details = data.result?.details || {};
      if (details.status === 'forbidden' || details.error) {
        console.error(`[DeepJelly Plugin] ❌ Access forbidden: ${details.error || 'Unknown error'}`);
        console.error(`[DeepJelly Plugin] 💡 Tip: Enable agent-to-agent access in OpenClaw config:`);
        console.error(`[DeepJelly Plugin]    Set tools.agentToAgent.enabled=true in ~/.openclaw/openclaw.json`);
        return { messages: [] };
      }

      // ⬅️ 修复：从 result.details.messages 读取（OpenClow 响应结构）
      const messagesList = details.messages || [];
      console.log(`[DeepJelly Plugin] Found ${messagesList.length} messages in result.details.messages`);

      // If no messages found, try alternative paths
      if (messagesList.length === 0) {
        console.warn(`[DeepJelly Plugin] ⚠️ No messages in result.details.messages, checking alternative paths...`);
        if (data.result?.messages && Array.isArray(data.result.messages)) {
          console.log(`[DeepJelly Plugin] Found ${data.result.messages.length} messages in result.messages (alternative path)`);
        }
        if (data.messages && Array.isArray(data.messages)) {
          console.log(`[DeepJelly Plugin] Found ${data.messages.length} messages in data.messages (alternative path)`);
        }
      }

      // ⬇️ 调试：打印原始数据结构和顺序
      console.log(`[DeepJelly Plugin] 🔍 Raw message item structure:`, JSON.stringify(messagesList[0], null, 2));
      console.log(`[DeepJelly Plugin] 🔍 Message count: ${messagesList.length}`);
      if (messagesList.length > 0) {
        const firstTs = messagesList[0]?.timestamp || messagesList[0]?.created_at;
        const lastTs = messagesList[messagesList.length - 1]?.timestamp || messagesList[messagesList.length - 1]?.created_at;
        console.log(`[DeepJelly Plugin] 🔍 Message time range: first=${firstTs}, last=${lastTs}`);
        console.log(`[DeepJelly Plugin] 🔍 Messages appear to be in ${firstTs > lastTs ? 'DESCENDING (newest first)' : 'ASCENDING (oldest first)'} order`);
      }

      let messages: Message[] = [];

      for (const item of messagesList) {
        const role = item.role || 'assistant';

        // 尝试从多个可能的字段获取时间戳
        let timestamp = item.timestamp || item.created_at || item.time || item.date;
        if (timestamp && typeof timestamp === 'string') {
          timestamp = new Date(timestamp).getTime();
        } else if (timestamp && typeof timestamp === 'number') {
          // 判断是秒级还是毫秒级时间戳（10位=秒，13位=毫秒）
          if (timestamp < 10000000000) {
            // 秒级时间戳，转换为毫秒
            timestamp = timestamp * 1000;
          }
          // 否则已经是毫秒级时间戳，直接使用
        } else if (!timestamp) {
          console.warn(`[DeepJelly Plugin] ⚠️ No timestamp found in item:`, Object.keys(item));
          timestamp = Date.now(); // 最后的备选方案
        }

        console.log(`[DeepJelly Plugin] 🕐 Processed timestamp: ${timestamp} (from ${item.timestamp ? 'item.timestamp' : item.created_at ? 'item.created_at' : 'Date.now()'})`);

        // item.content 是一个数组，包含不同类型的内容块
        const contentBlocks = item.content || [];
        const textBlocks = contentBlocks.filter((block: any) => block.type === 'text');

        // 提取所有文本内容并合并
        const textParts = textBlocks.map((block: any) => block.text || '').join('\n');

        // 只有当有文本内容时才添加消息
        if (textParts) {
          messages.push({
            id: `msg_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            role: role as 'user' | 'assistant' | 'system',
            content: textParts,
            timestamp: timestamp,
          });

          console.log(`[DeepJelly Plugin]   Message: role=${role}, content_length=${textParts.length}, timestamp=${timestamp}`);
        }
      }

      console.log(`[DeepJelly Plugin] ✅ Loaded ${messages.length} messages from OpenClow API`);

      // Apply beforeTimestamp filter FIRST (before sorting)
      // This ensures we correctly filter messages based on timestamp
      if (beforeTimestamp) {
        console.log(`[DeepJelly Plugin] 🔍 Filtering messages before timestamp: ${beforeTimestamp}`);
        const beforeCount = messages.length;
        messages = messages.filter(m => m.timestamp < beforeTimestamp);
        console.log(`[DeepJelly Plugin] ✅ Filtered to ${messages.length} messages (from ${beforeCount})`);
      }

      // Then sort messages by timestamp ascending (oldest first - traditional IM order)
      messages.sort((a, b) => a.timestamp - b.timestamp);

      return { messages };
    } catch (error: any) {
      console.error(`[DeepJelly Plugin] ❌ Error calling sessions_history API:`, error.message);
      return { messages: [] };
    }
  }

  /**
   * Get all sessions with optional message previews
   *
   * Uses direct file-system reading from OpenClaw's sessions directory
   * to bypass API visibility restrictions and get ALL session keys.
   *
   * @param characterId - Optional character ID to filter sessions by agent
   * @param limit - Maximum number of sessions to return (default: no limit)
   */
  private async getAllSessions(characterId?: string, limit?: number): Promise<{
    sessions: Array<{
      sessionKey: string;
      sessionId: string;
      label?: string;
      kind: string;
      channel?: string;
      updatedAt?: number;
      messages?: Message[];
    }>;
  }> {
    console.log(`[DeepJelly Plugin] =======================================`);
    console.log(`[DeepJelly Plugin] getAllSessions called (WebSocket mode)`);
    console.log(`[DeepJelly Plugin]   characterId: ${characterId || 'none'}`);
    console.log(`[DeepJelly Plugin]   limit: ${limit || 'none'}`);

    const gatewayPort = this.config.gatewayPort || resolveGatewayPort();
    const gatewayToken = this.config.gatewayToken || resolveGatewayAuthToken({
      warn: (msg: string) => console.warn(`[DeepJelly Plugin] ${msg}`)
    });

    if (!gatewayToken) {
      console.error(`[DeepJelly Plugin] ❌ gatewayToken not configured`);
      return { sessions: [] };
    }

    try {
      // Create a temporary WebSocket connection to Gateway
      const wsUrl = `ws://127.0.0.1:${gatewayPort}`;
      console.log(`[DeepJelly Plugin] 📡 Connecting to Gateway: ${wsUrl}`);

      const sessions = await new Promise<any[]>((resolve, reject) => {
        const ws = new (require('ws') as any).WebSocket(wsUrl, {
          headers: {
            'Authorization': `Bearer ${gatewayToken}`,
          },
        });

        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Gateway request timeout'));
        }, 10000);

        let connectNonce: string | null = null;
        let isConnected = false;
        let sessionsRequested = false;

        ws.on('open', () => {
          console.log(`[DeepJelly Plugin] ✅ WebSocket connected, waiting for challenge`);
        });

        ws.on('message', (data: any) => {
          try {
            const frame = JSON.parse(data.toString());
            console.log(`[DeepJelly Plugin] 📦 Received frame:`, JSON.stringify(frame).substring(0, 500));

            // Handle connect.challenge event
            if (frame.type === 'event' && frame.event === 'connect.challenge') {
              connectNonce = frame.payload?.nonce;
              console.log(`[DeepJelly Plugin] 🔑 Received challenge, nonce: ${connectNonce?.substring(0, 8)}...`);

              // Send connect request with proper Gateway protocol format
              // Based on OpenClaw Gateway client spec (study/openclaw/src/gateway/client.ts)
              const connectRequest = {
                type: 'req',
                id: `connect_${Date.now()}`,
                method: 'connect',
                params: {
                  minProtocol: 3,
                  maxProtocol: 3,
                  client: {
                    id: 'gateway-client', // Must use predefined client ID
                    displayName: 'DeepJelly Plugin',
                    version: '0.1.0',
                    platform: process.platform || 'unknown',
                    mode: 'backend',
                    instanceId: `deepjelly-${Date.now()}`,
                  },
                  auth: {
                    token: gatewayToken,
                  },
                  role: 'operator',
                  scopes: ['operator.read'],
                  caps: [],
                },
              };
              console.log(`[DeepJelly Plugin] 📤 Sending connect request`);
              ws.send(JSON.stringify(connectRequest));
              return;
            }

            // Handle connect response
            if (frame.type === 'res' && frame.id?.startsWith('connect_')) {
              if (frame.ok) {
                isConnected = true;
                console.log(`[DeepJelly Plugin] ✅ Connected, sending sessions.list request`);

                // Now we can send sessions.list
                // Build params
                const requestParams: Record<string, any> = {};
                if (limit !== undefined) {
                  requestParams.limit = limit;
                }

                // Add agentId filter if characterId is provided
                if (characterId) {
                  const agentId = this.getAgentIdByCharacterId(characterId);
                  if (agentId) {
                    requestParams.agentId = agentId;
                    console.log(`[DeepJelly Plugin] 🎯 Filtering sessions by agentId: ${agentId}`);
                  } else {
                    console.warn(`[DeepJelly Plugin] ⚠️ Could not find agentId for characterId: ${characterId}`);
                    // Return empty sessions if characterId provided but no agentId found
                    clearTimeout(timeout);
                    ws.close();
                    return [];
                  }
                }

                const sessionsRequest = {
                  type: 'req',
                  id: `sessions_list_${Date.now()}`,
                  method: 'sessions.list',
                  params: requestParams,
                };
                console.log(`[DeepJelly Plugin] 📤 Sending sessions.list request`);
                console.log(`[DeepJelly Plugin] 📤 Request params:`, JSON.stringify(requestParams));
                ws.send(JSON.stringify(sessionsRequest));
                sessionsRequested = true;
              } else {
                clearTimeout(timeout);
                ws.close();
                reject(new Error(frame.error?.message || 'Connection failed'));
              }
              return;
            }

            // Handle sessions.list response
            if (frame.type === 'res' && frame.id?.startsWith('sessions_list_')) {
              clearTimeout(timeout);
              ws.close();

              if (frame.ok) {
                // Parse sessions from result or payload (Gateway returns payload)
                let sessionsList: any[] = [];
                if (frame.payload?.sessions && Array.isArray(frame.payload.sessions)) {
                  sessionsList = frame.payload.sessions;
                } else if (frame.result?.sessions && Array.isArray(frame.result.sessions)) {
                  sessionsList = frame.result.sessions;
                } else if (frame.result && Array.isArray(frame.result)) {
                  sessionsList = frame.result;
                } else if (Array.isArray(frame.payload)) {
                  sessionsList = frame.payload;
                }

                console.log(`[DeepJelly Plugin] ✅ Got ${sessionsList.length} sessions`);
                resolve(sessionsList);
              } else {
                reject(new Error(frame.error?.message || 'Failed to get sessions'));
              }
              return;
            }

            // Handle errors
            if (frame.type === 'error') {
              clearTimeout(timeout);
              ws.close();
              reject(new Error(frame.error?.message || 'Gateway error'));
              return;
            }

            // Log unexpected frames
            console.log(`[DeepJelly Plugin] ⚠️ Unexpected frame: type=${frame.type}, event=${frame.event}`);
          } catch (e) {
            clearTimeout(timeout);
            ws.close();
            reject(e);
          }
        });

        ws.on('error', (error: any) => {
          clearTimeout(timeout);
          reject(new Error(`WebSocket error: ${error.message}`));
        });

        ws.on('close', () => {
          clearTimeout(timeout);
        });
      });

      // Normalize sessions
      const normalizedSessions = sessions.map((s: any) => {
        const sessionKey = s.key || '';
        const parts = sessionKey.split(':');

        // Determine kind from session key
        let kind = s.kind || 'other';
        if (sessionKey.endsWith(':main')) {
          kind = 'main';
        } else if (parts.length >= 4) {
          const kindPart = parts[3];
          if (['direct', 'group', 'channel'].includes(kindPart)) {
            kind = kindPart;
          }
        }

        // Determine channel
        let channel = s.channel;
        if (!channel && parts.length >= 3 && parts[0] === 'agent') {
          channel = parts[2];
        }

        return {
          sessionKey,
          sessionId: parts[parts.length - 1] || sessionKey,
          label: s.label || s.displayName,
          kind,
          channel,
          updatedAt: s.updatedAt || s.updated_at,
        };
      });

      // Sort: main first, then by updatedAt
      normalizedSessions.sort((a: any, b: any) => {
        if (a.sessionKey.endsWith(':main') && !b.sessionKey.endsWith(':main')) return -1;
        if (!a.sessionKey.endsWith(':main') && b.sessionKey.endsWith(':main')) return 1;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });

      // Log first few sessions
      normalizedSessions.slice(0, 10).forEach((s: any, i: number) => {
        console.log(`[DeepJelly Plugin]   [${i}] sessionKey="${s.sessionKey}", kind="${s.kind}"`);
      });

      return { sessions: normalizedSessions };
    } catch (error: any) {
      console.error(`[DeepJelly Plugin] ❌ Error in getAllSessions:`, error.message);
      console.error(`[DeepJelly Plugin] Error stack:`, error.stack);
      return { sessions: [] };
    }
  }

  /**
   * Get current session state
   */
  private async getSessionState(sessionId: string): Promise<SessionState> {
    // Stub - would query OpenClow's session state
    return {
      session_id: sessionId,
      status: "idle",
      current_action: "Ready",
    };
  }

  /**
   * Send a message to an OpenClaw agent session
   *
   * Priority order:
   * 1. Use OpenClow Plugin API (dispatcher) - high efficiency
   * 2. Fallback to CLI call - compatibility mode
   *
   * Note: sessionId is the direct agent id (e.g., "christina"), not a full session key
   */
  private async sendMessage(sessionId: string, content: string): Promise<{
    message_id: string;
    status: string;
    error?: string;
  }> {
    console.log(`[DeepJelly Plugin] =======================================`);
    console.log(`[DeepJelly Plugin] 📨 sendMessage START`);
    console.log(`[DeepJelly Plugin]   sessionId: ${sessionId} (type: ${typeof sessionId})`);
    console.log(`[DeepJelly Plugin]   content: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''} (${content.length} chars)`);
    console.log(`[DeepJelly Plugin]   runtime exists: ${!!this.runtime}`);
    console.log(`[DeepJelly Plugin]   dispatcher available: ${this.hasDispatcher()}`);
    console.log(`[DeepJelly Plugin]   runtime.channel: ${!!this.runtime?.channel}`);
    console.log(`[DeepJelly Plugin]   runtime.channel.reply: ${!!this.runtime?.channel?.reply}`);
    console.log(`[DeepJelly Plugin]   dispatchReplyWithBufferedBlockDispatcher: ${!!this.runtime?.channel?.reply?.dispatchReplyWithBufferedBlockDispatcher}`);

    const message_id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[DeepJelly Plugin]   message_id: ${message_id}`);

    // Try using Plugin API dispatcher first (like feishu plugin does)
    if (this.hasDispatcher()) {
      console.log(`[DeepJelly Plugin] 🚀 Using Plugin API dispatcher (high efficiency mode)`);

      try {
        const result = await this.sendMessageViaDispatcher(sessionId, content);
        console.log(`[DeepJelly Plugin] ✅ sendMessageViaDispatcher SUCCESS`);
        return result;
      } catch (error: any) {
        console.error(`[DeepJelly Plugin] ❌ Dispatcher failed: ${error.message}`);
        console.error(`[DeepJelly Plugin] Error stack: ${error.stack}`);
        console.log(`[DeepJelly Plugin] 🔄 Falling back to CLI mode...`);
      }
    }

    // Fallback 1: Try Gateway HTTP API (cross-machine compatible)
    console.log(`[DeepJelly Plugin] Checking Gateway HTTP API availability...`);
    console.log(`[DeepJelly Plugin]   gatewayToken (config): ${this.config.gatewayToken ? `${this.config.gatewayToken.substring(0, 8)}...(${this.config.gatewayToken.length} chars)` : 'undefined'}`);
    console.log(`[DeepJelly Plugin]   gatewayPort (config): ${this.config.gatewayPort || 'undefined'}`);

    // Try to resolve gateway token at runtime if not in config
    let gatewayToken = this.config.gatewayToken;
    let gatewayPort = this.config.gatewayPort;
    if (!gatewayToken || !gatewayPort) {
      console.log(`[DeepJelly Plugin] Gateway config incomplete, trying fallbacks...`);
      if (!gatewayToken) {
        gatewayToken = resolveGatewayAuthToken({
          warn: (msg: string) => console.warn(`[DeepJelly Plugin] ${msg}`)
        });
        if (gatewayToken) {
          console.log(`[DeepJelly Plugin] ✅ Gateway token resolved from fallback`);
        }
      }
      if (!gatewayPort) {
        gatewayPort = resolveGatewayPort();
        console.log(`[DeepJelly Plugin] ✅ Gateway port resolved: ${gatewayPort}`);
      }
    }

    console.log(`[DeepJelly Plugin]   gatewayToken (final): ${gatewayToken ? `${gatewayToken.substring(0, 8)}...(${gatewayToken.length} chars)` : 'undefined'}`);
    console.log(`[DeepJelly Plugin]   gatewayPort (final): ${gatewayPort || 'undefined'}`);

    if (gatewayToken && gatewayPort) {
      console.log(`[DeepJelly Plugin] 🌐 Using Gateway HTTP API mode`);
      try {
        // Temporarily override config for this call
        const originalToken = this.config.gatewayToken;
        const originalPort = this.config.gatewayPort;
        this.config.gatewayToken = gatewayToken;
        this.config.gatewayPort = gatewayPort;

        const result = await this.sendMessageViaGatewayHTTP(sessionId, content, message_id);

        // Restore original config
        this.config.gatewayToken = originalToken;
        this.config.gatewayPort = originalPort;

        console.log(`[DeepJelly Plugin] ✅ Gateway HTTP API SUCCESS`);
        return result;
      } catch (error: any) {
        console.error(`[DeepJelly Plugin] ❌ Gateway HTTP API failed: ${error.message}`);
        console.log(`[DeepJelly Plugin] 🔄 Trying CLI mode as last resort...`);
      }
    } else {
      console.log(`[DeepJelly Plugin] ⚠️ Gateway HTTP API not available (missing token or port)`);
    }

    // Fallback 2: Use CLI call (original implementation)
    console.log(`[DeepJelly Plugin] 📞 Using CLI mode (compatibility mode)`);
    const result = await this.sendMessageViaCLI(sessionId, content, message_id);
    console.log(`[DeepJelly Plugin] =======================================`);
    return result;
  }

  /**
   * Send message using OpenClow Plugin API dispatcher
   * This is the preferred method - similar to how feishu plugin works
   */
  private async sendMessageViaDispatcher(
    sessionId: string,
    content: string
  ): Promise<{
    message_id: string;
    status: string;
    error?: string;
  }> {
    console.log(`[DeepJelly Plugin] >>> sendMessageViaDispatcher START`);
    console.log(`[DeepJelly Plugin]   sessionId: ${sessionId}`);
    console.log(`[DeepJelly Plugin]   content: ${content.substring(0, 50)}...`);

    const message_id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check runtime availability
    console.log(`[DeepJelly Plugin] Checking runtime availability...`);
    console.log(`[DeepJelly Plugin]   this.runtime exists: ${!!this.runtime}`);
    console.log(`[DeepJelly Plugin]   this.runtime.channel exists: ${!!this.runtime?.channel}`);
    console.log(`[DeepJelly Plugin]   this.runtime.channel.routing exists: ${!!this.runtime?.channel?.routing}`);
    console.log(`[DeepJelly Plugin]   this.runtime.channel.routing.resolveAgentRoute exists: ${!!this.runtime?.channel?.routing?.resolveAgentRoute}`);

    if (!this.runtime?.channel?.routing?.resolveAgentRoute) {
      console.error(`[DeepJelly Plugin] ❌ resolveAgentRoute not available!`);
      throw new Error('runtime.channel.routing.resolveAgentRoute not available');
    }

    if (!this.runtime?.channel?.reply?.dispatchReplyWithBufferedBlockDispatcher &&
        !this.runtime?.channel?.reply?.dispatchReplyFromConfig) {
      console.error(`[DeepJelly Plugin] ❌ dispatcher not available!`);
      throw new Error('runtime.channel.reply dispatcher not available');
    }

    console.log(`[DeepJelly Plugin] ✅ Runtime checks passed`);

    // Check if sessionId is already a complete agent session key
    // Format: agent:<agentId>[:...]
    let sessionKey: string;
    let agentId: string;
    let accountId: string;

    if (sessionId.startsWith('agent:')) {
      // sessionId is already a complete agent session key
      // Parse it to extract agentId
      const parts = sessionId.split(':');
      agentId = parts[1]; // agent:<agentId>:...
      sessionKey = sessionId;
      accountId = DEFAULT_ACCOUNT_ID;
      console.log(`[DeepJelly Plugin] ✅ Using complete session key directly: ${sessionKey}`);
      console.log(`[DeepJelly Plugin]   agentId: ${agentId}`);
    } else {
      // sessionId is just an agent ID or peer ID, use resolveAgentRoute
      console.log(`[DeepJelly Plugin] Calling resolveAgentRoute...`);
      const resolveParams = {
        cfg: { channels: { deepjelly: this.config } },
        channel: "deepjelly",
        peer: {
          id: sessionId,
          kind: "direct" as "dm" | "group" | "direct" | "channel"
        }
      };
      console.log(`[DeepJelly Plugin]   resolveParams:`, JSON.stringify(resolveParams, null, 2));

      const route = this.runtime.channel.routing.resolveAgentRoute(resolveParams);

      console.log(`[DeepJelly Plugin] ✅ Route resolved:`);
      console.log(`[DeepJelly Plugin]   sessionKey: ${route.sessionKey}`);
      console.log(`[DeepJelly Plugin]   accountId: ${route.accountId}`);
      console.log(`[DeepJelly Plugin]   agentId: ${route.agentId}`);

      sessionKey = route.sessionKey;
      agentId = route.agentId;
      accountId = route.accountId;
    }

    // Build inbound context (similar to feishu's buildInboundContext)
    const inboundCtx: InboundContext = {
      Body: content,
      RawBody: content,
      CommandBody: content,
      From: `deepjelly:${sessionId}`,
      To: `agent:${agentId}`,
      SessionKey: sessionKey,
      AccountId: accountId,
      ChatType: "direct",
      SenderId: sessionId,
      Provider: "deepjelly",
      MessageSid: message_id,
      Timestamp: Date.now(),
      WasMentioned: false,
      CommandAuthorized: true,
      OriginatingChannel: "deepjelly",
      OriginatingTo: `agent:${agentId}`,
      ContentType: "text"
    };

    // Use dispatcher with deliver callback
    const dispatcher = this.runtime.channel.reply.dispatchReplyWithBufferedBlockDispatcher ||
                        this.runtime.channel.reply.dispatchReplyFromConfig;

    console.log(`[DeepJelly Plugin] Dispatcher obtained: ${dispatcher ? 'YES' : 'NO'}`);
    console.log(`[DeepJelly Plugin] Building dispatcher params...`);

    const dispatcherParams = {
      ctx: inboundCtx,
      cfg: { channels: { deepjelly: this.config } },
      dispatcherOptions: {
        deliver: async (payload: DeliverPayload, info?: DeliverInfo) => {
          // Deliver callback: send Agent's response back to DeepJelly
          console.log(`[DeepJelly Plugin] =======================================`);
          console.log(`[DeepJelly Plugin] 📨 Deliver callback called!`);
          console.log(`[DeepJelly Plugin]   info:`, JSON.stringify(info, null, 2));
          console.log(`[DeepJelly Plugin]   payload:`, JSON.stringify(payload, null, 2));

          const text = payload.text || "";
          console.log(`[DeepJelly Plugin]   extracted text: ${text.substring(0, 100)}...`);

          if (!text) {
            console.warn(`[DeepJelly Plugin]   No text in payload, skipping`);
            return false;
          }

          // Convert to CAP session message and broadcast
          // Use the original sessionId for session_id in response (not route.sessionKey)
          const message = Converter.createSessionMessage(
            {
              content: text,
              display_mode: "bubble_and_panel",
              session_id: sessionKey,
              chat_type: "private",
            },
            // sender: AI application with routing info
            {
              id: this.getApplicationId(),
              routing: { sessionKey },
            },
            // receiver: DeepJelly character
            {
              id: this.getCharacterIdForSession(sessionKey),
            }
          );

          console.log(`[DeepJelly Plugin] Broadcasting CAP message...`);
          const sent = this.broadcast(message);
          console.log(`[DeepJelly Plugin] ✅ Broadcast to ${sent} client(s)`);
          console.log(`[DeepJelly Plugin]   message content: ${text.substring(0, 50)}...`);
          console.log(`[DeepJelly Plugin] =======================================`);
          return sent > 0;
        }
      }
    };

    console.log(`[DeepJelly Plugin] Calling dispatcher...`);
    console.log(`[DeepJelly Plugin]   ctx.SessionKey: ${inboundCtx.SessionKey}`);
    console.log(`[DeepJelly Plugin]   ctx.Body: ${inboundCtx.Body.substring(0, 50)}...`);

    const dispatcherResult = await dispatcher(dispatcherParams);

    console.log(`[DeepJelly Plugin] ✅ Dispatcher completed`);
    console.log(`[DeepJelly Plugin]   result:`, JSON.stringify(dispatcherResult, null, 2));
    console.log(`[DeepJelly Plugin] <<< sendMessageViaDispatcher COMPLETE`);

    return {
      message_id,
      status: "sent"
    };
  }

  /**
   * Send message using Gateway HTTP API (cross-machine compatible)
   * Uses OpenClaw Gateway's HTTP API to send messages to agents
   */
  private async sendMessageViaGatewayHTTP(
    sessionId: string,
    content: string,
    message_id?: string
  ): Promise<{
    message_id: string;
    status: string;
    error?: string;
  }> {
    const id = message_id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[DeepJelly Plugin] =======================================`);
    console.log(`[DeepJelly Plugin] 🌐 sendMessageViaGatewayHTTP START`);
    console.log(`[DeepJelly Plugin]   sessionId: ${sessionId}`);
    console.log(`[DeepJelly Plugin]   content: ${content.substring(0, 50)}...`);
    console.log(`[DeepJelly Plugin]   gatewayPort: ${this.config.gatewayPort}`);

    // Gateway runs on 127.0.0.1 (same machine as the plugin)
    // Use OpenAI-compatible /v1/chat/completions endpoint
    const gatewayPort = this.config.gatewayPort || resolveGatewayPort();
    const gatewayUrl = `http://127.0.0.1:${gatewayPort}/v1/chat/completions`;
    // Use sessionId directly as sessionKey (no transformation)
    // Frontend is responsible for providing the correct session key format
    const sessionKey = sessionId;

    // Try to get gateway token with fallback
    let gatewayToken = this.config.gatewayToken;
    if (!gatewayToken) {
      console.log(`[DeepJelly Plugin] Gateway token not in config, trying fallbacks...`);
      gatewayToken = resolveGatewayAuthToken({
        warn: (msg: string) => console.warn(`[DeepJelly Plugin] ${msg}`)
      });
      if (gatewayToken) {
        console.log(`[DeepJelly Plugin] ✅ Gateway token resolved from fallback`);
      }
    }

    if (!gatewayToken) {
      throw new Error('Gateway token not configured. Set OPENCLAW_GATEWAY_TOKEN environment variable or configure gateway.auth.token in ~/.openclaw/openclaw.json');
    }

    console.log(`[DeepJelly Plugin]   sessionKey: ${sessionKey}`);
    console.log(`[DeepJelly Plugin]   gatewayUrl: ${gatewayUrl}`);

    // Parse agent ID from session key for the model parameter
    // Session key format: agent:<agentId>[:...]
    let agentIdForModel = 'default';
    if (sessionKey.startsWith('agent:')) {
      const parts = sessionKey.split(':');
      if (parts.length >= 2) {
        agentIdForModel = parts[1];
      }
    }

    console.log(`[DeepJelly Plugin]   agentId (for model): ${agentIdForModel}`);

    try {
      // Use OpenAI-compatible format with proper headers
      // IMPORTANT: Pass session key via x-openclaw-session-key header, NOT user parameter
      // The user parameter would be used as part of mainKey, not the full session key
      const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${gatewayToken}`,
          'x-openclaw-session-key': sessionKey,  // Use header to pass full session key
        },
        body: JSON.stringify({
          model: agentIdForModel,  // Use agent ID from session key
          messages: [{ role: 'user', content: content }],
          stream: false,  // Non-streaming for simpler response handling
          // Don't pass user parameter - let header define the session
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DeepJelly Plugin] ❌ HTTP error: ${response.status} ${response.statusText}`);
        console.error(`[DeepJelly Plugin] Error response: ${errorText}`);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data: any = await response.json();
      console.log(`[DeepJelly Plugin] Gateway response:`, JSON.stringify(data, null, 2));

      // Check if the call was successful
      if (data.error) {
        throw new Error(data.error.message || data.error);
      }

      // OpenAI-compatible format: choices[0].message.content
      const replyText = data.choices?.[0]?.message?.content || '';

      if (!replyText) {
        throw new Error('No content in Gateway response');
      }

      if (replyText) {
        console.log(`[DeepJelly Plugin] ✅ Received reply from agent (${replyText.length} chars)`);

        // Convert to CAP session message and broadcast to clients
        const message = Converter.createSessionMessage(
          {
            content: replyText,
            display_mode: "bubble_and_panel",
            session_id: sessionKey,
            chat_type: "private",
          },
          // sender: AI application with routing info
          {
            id: this.getApplicationId(),
            routing: { sessionKey },
          },
          // receiver: DeepJelly character
          {
            id: this.getCharacterIdForSession(sessionKey),
          }
        );

        console.log(`[DeepJelly Plugin] Broadcasting CAP message...`);
        const sent = this.broadcast(message);
        console.log(`[DeepJelly Plugin] ✅ Broadcast to ${sent} client(s)`);
      }

      console.log(`[DeepJelly Plugin] ✅ sendMessageViaGatewayHTTP COMPLETE`);
      console.log(`[DeepJelly Plugin] =======================================`);

      return {
        message_id: id,
        status: "sent"
      };

    } catch (error: any) {
      console.error(`[DeepJelly Plugin] ❌ sendMessageViaGatewayHTTP failed: ${error.message}`);
      console.error(`[DeepJelly Plugin] Error stack: ${error.stack}`);
      throw error;
    }
  }

  /**
   * Send message using OpenClaw CLI (fallback/compatibility mode)
   * Original implementation - uses external CLI command
   */
  private async sendMessageViaCLI(
    sessionId: string,
    content: string,
    message_id?: string
  ): Promise<{
    message_id: string;
    status: string;
    error?: string;
  }> {
    const id = message_id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Determine openclaw command path
    let openclawCmd = this.config.openclawPath || 'openclaw';

    // If no custom path, try common locations
    if (!this.config.openclawPath) {
      const commonPaths = [
        'openclaw',
        '/usr/local/bin/openclaw',
        '/usr/bin/openclaw',
        'C:\\Program Files\\OpenClaw\\openclaw.exe',
        'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Programs\\openclaw\\openclaw.exe',
      ];

      // Try to find openclaw in common paths
      const { existsSync } = require('fs');
      for (const path of commonPaths) {
        if (existsSync(path)) {
          openclawCmd = path;
          console.log(`[DeepJelly Plugin] Found OpenClaw at: ${openclawCmd}`);
          break;
        }
      }
    }

    try {
      // Import child_process for CLI execution
      const { execSync } = require('child_process');

      // Escape content for shell - properly handle quotes and special characters
      const escapedContent = content
        .replace(/\\/g, '\\\\')  // Escape backslashes
        .replace(/"/g, '\\"')    // Escape quotes
        .replace(/\$/g, '\\$')   // Escape dollar signs
        .replace(/`/g, '\\`')    // Escape backticks
        .replace(/\n/g, '\\n');  // Escape newlines

      // Build the OpenClaw CLI command
      const cmd = `"${openclawCmd}" agent --agent "${sessionId}" --message "${escapedContent}"`;

      console.log(`[DeepJelly Plugin] Executing OpenClaw CLI command...`);
      console.log(`[DeepJelly Plugin]   Full command: ${cmd}`);
      console.log(`[DeepJelly Plugin]   OpenClaw path: ${openclawCmd}`);
      console.log(`[DeepJelly Plugin]   Agent: ${sessionId}`);
      console.log(`[DeepJelly Plugin]   Message: ${content}`);
      console.log(`[DeepJelly Plugin]   Message length: ${content.length} chars`);

      // Execute the command with a timeout
      const result = execSync(cmd, {
        encoding: "utf-8" as BufferEncoding,
        stdio: ["ignore", "pipe", "pipe"] as any,
        timeout: 300000,  // 300 second timeout (5 minutes) for AI response
        env: { ...process.env, FORCE_COLOR: "0" },
        shell: true,     // Use shell for proper command parsing
        windowsHide: true // Hide command window on Windows
      });

      console.log(`[DeepJelly Plugin] ✅ Message sent successfully to agent '${sessionId}'`);
      if (result && result.length > 0) {
        console.log(`[DeepJelly Plugin] Response:`, result.substring(0, 200));
        console.log(`[DeepJelly Plugin] Broadcasting response to ${this.clients.size} client(s)...`);

        // Convert CLI response to CAP message and broadcast to clients
        const responseMessage = Converter.createSessionMessage(
          {
            content: result.trim(),
            display_mode: "bubble_and_panel",
            session_id: sessionId,
          },
          // sender: AI application with routing info
          {
            id: this.getApplicationId(),
            routing: { sessionKey: sessionId },
          },
          // receiver: DeepJelly character
          {
            id: this.getCharacterIdForSession(sessionId),
          }
        );

        const sentCount = this.broadcast(responseMessage);
        console.log(`[DeepJelly Plugin] ✅ Broadcasted response to ${sentCount} client(s)`);
      }

      return {
        message_id: id,
        status: "sent"
      };

    } catch (error: any) {
      const errorMsg = error.message || 'Unknown error';
      const stderr = error.stderr || '';
      const stdout = error.stdout || '';

      console.error(`[DeepJelly Plugin] ❌ Failed to send message to agent '${sessionId}'`);
      console.error(`[DeepJelly Plugin] Error: ${errorMsg}`);
      console.error(`[DeepJelly Plugin] Stdout: ${stdout}`);
      console.error(`[DeepJelly Plugin] Stderr: ${stderr}`);
      console.error(`[DeepJelly Plugin] Exit code: ${error.status || error.code || 'unknown'}`);

      // Provide helpful error messages
      let helpfulError = `Failed to send message: ${errorMsg}`;
      if (errorMsg.includes('not found') || errorMsg.includes('command not found') || error.code === 'ENOENT') {
        helpfulError = `OpenClaw CLI not found at '${openclawCmd}'. Please ensure OpenClaw is installed and in your PATH, or configure 'openclawPath' in the plugin settings.`;
      } else if (stderr.includes('unknown agent') || stderr.includes('agent not found')) {
        helpfulError = `Agent '${sessionId}' not found in OpenClaw. Please check the agent ID.`;
      } else if (stderr) {
        helpfulError = `OpenClaw error: ${stderr}`;
      }

      return {
        message_id: id,
        status: "failed",
        error: helpfulError
      };
    }
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  private getClientInfos(): ConnectedClientInfo[] {
    const now = Date.now();
    return Array.from(this.clients.values()).map((client) => {
      const duration = now - client.connectedAt;
      return {
        id: client.id,
        connected_at: client.connectedAt,
        connected_duration: this.formatDuration(duration),
      };
    });
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}
