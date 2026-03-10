/**

 * DeepJelly OpenClaw Channel Plugin

 *

 * Main entry point for the DeepJelly plugin.

 * Registers the channel, tools, RPC methods, and CLI commands.

 */




import { execSync } from "child_process";

import type { DeepJellyConfig } from "./types";

import { DeepJellyServer } from "./server";

import { registerTools } from "./tools";

import * as Converter from "./converter";
import {
  createToolStartMessage,
  createToolCompleteMessage,
  createToolErrorMessage,
  createLlmThinkingMessage,
  // createLlmOutputMessage,  // NOT IMPLEMENTED
  createAgentStartMessage,
  createAgentEndMessage,
} from "./converter";



// ============================================================================

// Plugin Main Function

// ============================================================================



import type { OpenClawRuntime } from "./types";

interface PluginAPI {

  registerTool(tool: any, options?: { optional?: boolean }): void;

  registerGatewayMethod(name: string, handler: any): void;

  registerCli(handler: any, options?: { commands?: string[] }): void;

  registerChannel(config: any): void;

  registerCommand(command: any): void;

  registerService(service: any): void;

  /**
   * Register lifecycle hook handler
   * @param hookName - Name of the hook to register (e.g., "before_tool_call", "after_tool_call")
   * @param handler - Hook handler function
   * @param opts - Optional priority setting
   */
  on: (hookName: string, handler: (...args: any[]) => any, opts?: { priority?: number }) => void;

  logger: {

    info(...args: any[]): void;

    warn(...args: any[]): void;

    error(...args: any[]): void;

    debug(...args: any[]): void;

  };

  config: any;

  /** OpenClow Runtime - provides access to channel.reply dispatcher */
  runtime?: OpenClawRuntime;

}



interface RegisterOptions {

  name?: string;

  version?: string;

  description?: string;

  configSchema?: any;

}



// Global server instance for Gateway process

// CLI commands use Gateway RPC to access this instance

(global as any).deepjellyServer = (global as any).deepjellyServer || null;



// Helper function to call Gateway RPC (cross-platform)

// Pass JSON params via base64 encoding for safe command-line passing

function callGatewayRPC(method: string, params: any = {}): any {
  const paramsJson = JSON.stringify(params);
  // Use npx to run openclaw directly - bypasses shell PATH issues
  // Pass params as JSON string (escaped for cmd.exe)
  const cmd = `openclaw gateway call ${method} --params "${paramsJson.replace(/"/g, '\\"')}"`;

  try {
    const result = execSync(cmd, {

      encoding: "utf-8" as BufferEncoding,

      stdio: ["ignore", "pipe", "pipe"] as any,

      env: { ...process.env, FORCE_COLOR: "0" }

    });



    const lines = result.split('\n');

    let jsonStartIndex = -1;



    for (let i = 0; i < lines.length; i++) {

      const trimmed = lines[i].trim();

      if (trimmed.startsWith('{')) {

        jsonStartIndex = i;

        break;

      }

    }



    if (jsonStartIndex >= 0) {

      let jsonStr = '';

      let braceCount = 0;

      for (let i = jsonStartIndex; i < lines.length; i++) {

        const line = lines[i];

        jsonStr += line;




        for (const char of line) {

          if (char === '{') braceCount++;

          if (char === '}') braceCount--;

        }



        if (braceCount === 0) {

          return JSON.parse(jsonStr);

        }

      }

    }



    const jsonMatch = result.match(/\{[\s\S]*?\}/);

    if (jsonMatch) {

      return JSON.parse(jsonMatch[0]);

    }



    // Enhanced error logging with raw output
    console.error(`[DeepJelly] No JSON found in Gateway response`);
    console.error(`[DeepJelly] Command: ${cmd}`);
    console.error(`[DeepJelly] Raw output (${result.length} chars):`);
    console.error('---BEGIN RAW OUTPUT---');
    console.error(result);
    console.error('---END RAW OUTPUT---');

    return { error: "No JSON response from Gateway", raw: result };

  } catch (error: any) {
    console.error(`[DeepJelly] Gateway RPC call failed`);
    console.error(`[DeepJelly] Command: ${cmd}`);
    console.error(`[DeepJelly] Error: ${error.message}`);
    console.error(`[DeepJelly] Stderr: ${error.stderr || ''}`);
    console.error(`[DeepJelly] Stdout: ${error.stdout || ''}`);

    return {

      error: error.message || "Failed to call Gateway RPC",

      stderr: error.stderr || "",

      stdout: error.stdout || "",

      code: error.status

    };

  }

}





export default function register(api: PluginAPI, options?: RegisterOptions) {

  const config = getConfig(api.config);



  // Singleton: reuse existing server or create new one

  // This prevents duplicate instances when plugin is loaded multiple times

  if (!(global as any).deepjellyServer) {

    (global as any).deepjellyServer = new DeepJellyServer(config);

  }

  const server = (global as any).deepjellyServer;

  // Log API and runtime availability
  api.logger.info("[DeepJelly] Plugin registration started");
  api.logger.info(`[DeepJelly] api.runtime exists: ${!!api.runtime}`);
  if (api.runtime) {
    api.logger.info(`[DeepJelly] api.runtime.channel exists: ${!!api.runtime.channel}`);
    api.logger.info(`[DeepJelly] api.runtime.channel.reply exists: ${!!api.runtime.channel?.reply}`);
    api.logger.info(`[DeepJelly] api.runtime.channel.routing exists: ${!!api.runtime.channel?.routing}`);
  }

  // Set API reference so server can send messages to OpenClow
  server.setApi(api);

  // Register channel

  api.registerChannel({

    plugin: {

      id: "deepjelly",

      meta: {

        id: "deepjelly",

        label: "DeepJelly",

        selectionLabel: "DeepJelly (Desktop Avatar)",

        docsPath: "/channels/deepjelly",

        blurb: "Connect OpenClaw to DeepJelly desktop avatar for visual AI assistant experience",

        aliases: ["dj", "avatar"],

      },

      capabilities: {

        chatTypes: ["direct"],

      },

      config: {

        listAccountIds: (cfg: any) => {

          // In Agent session context, local server won't be running

          // But Gateway process has the actual server

          // Always return default account - Gateway will route the message

          return ["default"];

        },

        resolveAccount: (cfg: any, accountId?: string) => ({

          accountId: accountId || "default",

          connection: {

            host: cfg.channels?.deepjelly?.serverHost || "127.0.0.1",

            port: cfg.channels?.deepjelly?.serverPort || 18790,

          },

        }),

      },

      outbound: {

        deliveryMode: "direct",

        sendText: async ({ text, to, accountId, cfg }) => {

          // Check if server is running in this process

          const status = server.getStatus();

          if (status.running) {

            // Server is running in this process (Gateway context)

            // Get routing information from context
            const applicationId = cfg?.channels?.deepjelly?.applicationId || "openclaw";
            const characterId = cfg?.channels?.deepjelly?.accounts?.[accountId || "default"]?.characterId || "character";
            const sessionKey = to || "unknown";

            const message = Converter.createSessionMessage(

              {

                content: text,

                display_mode: "bubble_and_panel",

              },

              // sender: AI application (OpenClaw)
              {

                id: applicationId,

                routing: { sessionKey }

              },

              // receiver: Character (DeepJelly)
              {

                id: characterId

              }

            );

            const sent = server.broadcast(message);

            return { ok: sent > 0 };

          } else {

            // Server is NOT running in this process (Agent session context)

            // The Gateway process has the actual running server

            // We can't directly broadcast across processes, but the message

            // will still be delivered through the Gateway's routing

            // Return ok: true to indicate acceptance

            api.logger.info("[DeepJelly] Message routed through Gateway (cross-process)");

            return { ok: true };

          }

        },

      },

      setup: {

        configure: async (ctx: any) => {

          const { config } = ctx;

          const port = config.channels?.deepjelly?.serverPort || 18790;



          try {

              // Check if already running

              const status = server.getStatus();

              if (!status.running) {

                await server.start();

                // Set OpenClow Runtime reference to enable Plugin API dispatcher
                // This allows direct in-process message dispatching instead of CLI calls
                if (api.runtime) {
                  server.setRuntime(api.runtime);
                  api.logger.info("[DeepJelly] OpenClow Runtime linked - dispatcher enabled");
                }

                api.logger.info(`[DeepJelly] Server started on port ${port}`);

              } else {

                api.logger.info("[DeepJelly] Server already running");

                // Still set runtime even if server was already running
                if (api.runtime) {
                  server.setRuntime(api.runtime);
                  api.logger.info("[DeepJelly] OpenClow Runtime linked to existing server");
                }

              }



            return {

              cfg: {

                channels: {

                  deepjelly: {

                    enabled: true,

                    serverPort: port,

                    serverHost: config.channels?.deepjelly?.serverHost || "0.0.0.0",

                    autoStart: true,

                  },

                },

              },

              accountId: "default",

            };

          } catch (error: any) {

            api.logger.error(`[DeepJelly] Failed to start server: ${error.message}`);

            throw error;

          }

        },

      },

      status: {

        getStatus: async () => {

          const status = server.getStatus();

          return {

            status: status.running ? "ok" : "error",

            detail: status.running

              ? `Connected (${status.connected_clients} client(s))`

              : "Server not running",

            info: {

              port: status.port,

              host: status.host,

              connected_clients: status.connected_clients,

            },

          };

        },

      },

      gateway: {

        startAccount: async (ctx: {
          cfg: any;
          accountId: string;
          account: any;
          runtime: any;
          channelRuntime?: any;
          abortSignal: AbortSignal;
          log?: { info: (msg: string) => void; error: (msg: string) => void };
          getStatus: () => any;
          setStatus: (status: any) => void;
        }) => {
          const logger = ctx.log || api.logger;

          // Start server if not already running
          if (!server.getStatus().running) {
            await server.start();
            logger.info("[DeepJelly] Server started");
          } else {
            logger.info("[DeepJelly] Server already running");
          }

          // Set OpenClow Runtime reference to enable Plugin API dispatcher
          // This should always be set, regardless of whether server was just started or already running
          // Priority: channelRuntime (with dispatcher) > runtime (full) > undefined
          const runtimeToUse = ctx.channelRuntime || ctx.runtime;
          if (runtimeToUse) {
            server.setRuntime(runtimeToUse);
            logger.info("[DeepJelly] OpenClow Runtime linked via gateway.startAccount");
            logger.info(`[DeepJelly] channelRuntime exists: ${!!ctx.channelRuntime}`);
            logger.info(`[DeepJelly] runtime exists: ${!!ctx.runtime}`);
            logger.info(`[DeepJelly] runtime.channel exists: ${!!runtimeToUse.channel}`);
            logger.info(`[DeepJelly] runtime.channel.reply exists: ${!!runtimeToUse.channel?.reply}`);
          } else {
            logger.error("[DeepJelly] No runtime available in gateway.startAccount context");
          }
        },

        stopAccount: async (ctx: {
          accountId: string;
        }) => {
          await server.stop();
        },

      },

    },

  });



  // Register agent tools

  registerTools(api, server);



  // Register gateway RPC methods

  api.registerGatewayMethod("deepjelly.connect", async ({ respond }) => {

    try {

      await server.start();

      respond(true, { ok: true, ...server.getStatus() });

    } catch (error: any) {

      respond(true, { ok: false, error: error.message });

    }

  });



  api.registerGatewayMethod("deepjelly.disconnect", async ({ respond }) => {

    try {

      await server.stop();

      respond(true, { ok: true });

    } catch (error: any) {

      respond(true, { ok: false, error: error.message });

    }

  });



  api.registerGatewayMethod("deepjelly.status", async ({ respond }) => {

    respond(true, server.getStatus());

  });



  api.registerGatewayMethod("deepjelly.broadcast", async ({ respond, params }) => {

    const sent = server.broadcast(params.message);

    respond(true, { sent, client_count: server.getStatus().connected_clients });

  });



  api.registerGatewayMethod("deepjelly.send", async ({ respond, params }) => {

    const sent = server.sendTo(params.client_id, params.message);

    respond(true, { sent });

  });


  // ========================================================================
  // BrainAdapter Interface Methods
  // ========================================================================

  /**
   * get_assistants - Get list of available assistants
   * Returns assistants configured in this OpenClaw instance
   */
  api.registerGatewayMethod("get_assistants", async ({ respond }) => {
    const accounts = api.config?.channels?.deepjelly?.accounts || {};

    const assistants = Object.entries(accounts).map(([agentId, account]: [string, any]) => ({
      id: account.assistantId || agentId,
      name: account.name || agentId,
      description: account.description || `OpenClaw agent: ${agentId}`,
      status: "idle" as const,
      model: api.config?.agents?.[agentId]?.model,
      // Additional metadata
      metadata: {
        agentId,
        provider: "openclaw",
      }
    }));

    respond(true, { assistants });
  });

  /**
   * get_assistant - Get detailed assistant info
   * @param params.assistant_id - The assistant ID to query
   */
  api.registerGatewayMethod("get_assistant", async ({ respond, params }) => {
    const { assistant_id } = params;
    const accounts = api.config?.channels?.deepjelly?.accounts || {};

    // Find the account that matches this assistant_id
    const matchedAccount = Object.entries(accounts).find(([agentId, account]: [string, any]) =>
      account.assistantId === assistant_id || agentId === assistant_id
    );

    if (!matchedAccount) {
      respond(true, {
        error: {
          code: -32001,
          message: "Assistant not found",
          data: { assistant_id }
        }
      });
      return;
    }

    const [agentId, account] = matchedAccount as [string, any];
    const agentConfig = api.config?.agents?.[agentId];

    respond(true, {
      id: account.assistantId || agentId,
      name: account.name || agentId,
      description: account.description || `OpenClaw agent: ${agentId}`,
      status: "idle" as const,
      model: agentConfig?.model,
      avatar: account.avatar,
      created_at: account.createdAt,
      sessions_count: 0, // TODO: implement session counting
      // Extended configuration for character animations
      character_config: {
        character_id: account.characterId,
        appearance_id: account.appearanceId,
        available_animations: account.availableAnimations || [
          "working", "nod", "confused", "idle", "thinking",
          "success", "error", "greeting", "wave"
        ],
      }
    });
  });

  /**
   * get_session_state - Get current session state
   * @param params.session_id - The session ID (sessionKey in OpenClow)
   */
  api.registerGatewayMethod("get_session_state", async ({ respond, params }) => {
    const { session_id } = params;

    // TODO: Implement actual session state tracking
    // For now, return a default idle state
    respond(true, {
      session_id,
      status: "idle",
      current_action: undefined,
      tool_execution: undefined
    });
  });


  // ========================================================================
  // Register Tool Call Status Hooks
  // ========================================================================

  /**
   * Get applicationId from config
   * This is the ID assigned by DeepJelly for this AI application
   */
  function getApplicationId(): string {
    return api.config?.channels?.deepjelly?.applicationId || "openclaw_default";
  }

  /**
   * Get assistantId for a given agentId
   * This maps OpenClow agents to DeepJelly assistants
   * TODO: In the future, this should query from DeepJelly backend
   */
  function getAssistantId(agentId?: string): string {
    // For now, check the config for the mapping
    const accounts = api.config?.channels?.deepjelly?.accounts;
    if (accounts && agentId && accounts[agentId]?.assistantId) {
      return accounts[agentId].assistantId;
    }
    // Fallback: use agentId as assistantId (should be replaced with proper query)
    return agentId || "assistant";
  }

  /**
   * Get characterId for a given agentId (sessionKey)
   * This maps OpenClow agents to DeepJelly characters for message routing
   * The agentId in hook context is the sessionKey
   */
  function getCharacterId(agentId?: string): string {
    const accounts = api.config?.channels?.deepjelly?.accounts;
    if (accounts && agentId && accounts[agentId]?.characterId) {
      return accounts[agentId].characterId;
    }
    // Fallback: use agentId as characterId
    return agentId || "character";
  }

  /**
   * Helper: Extract text content from a message
   * Handles different message content formats (string, array, object)
   */
  function extractTextContent(content: unknown): string {
    if (typeof content === "string") {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object") {
            // Handle content blocks with text property
            if ("text" in item && typeof item.text === "string") return item.text;
            // Handle content blocks with type and content
            if ("type" in item && item.type === "text" && "content" in item && typeof item.content === "string") {
              return item.content;
            }
          }
          return "";
        })
        .join("");
    }
    if (content && typeof content === "object") {
      if ("text" in content && typeof content.text === "string") return content.text;
      if ("content" in content && typeof content.content === "string") return content.content;
    }
    return "";
  }

  /**
   * before_agent_start hook (global hook)
   * Replaces message_received - works across all channels
   * Broadcasts when agent starts processing
   */
  api.on("before_agent_start", async (event, ctx) => {
    api.logger.debug(`[DeepJelly] before_agent_start: ${ctx.sessionKey}`);

    const applicationId = getApplicationId();
    const characterId = getCharacterId(ctx.sessionKey);
    const sessionKey = ctx.sessionKey || "unknown";

    // Create and broadcast agent start message
    const statusMessage = createAgentStartMessage({
      applicationId,
      characterId,
      sessionKey,
      direction: "aiToAssistant",
      app_params: { hookType: "before_agent_start" },
    });
    server.broadcast(statusMessage);
  });

  /**
   * llm_input hook
   * Broadcasts thinking status when sending input to LLM
   */
  api.on("llm_input", async (event, ctx) => {
    api.logger.debug(`[DeepJelly] llm_input: ${ctx.sessionKey}`);

    const applicationId = getApplicationId();
    const characterId = getCharacterId(ctx.sessionKey);
    const sessionKey = ctx.sessionKey || "unknown";

    // Create and broadcast thinking status message
    const thinkingMessage = createLlmThinkingMessage({
      applicationId,
      characterId,
      sessionKey,
      direction: "aiToAssistant",
      app_params: { hookType: "llm_input" },
    });
    server.broadcast(thinkingMessage);
  });

  /**
   * llm_output hook (NOT IMPLEMENTED)
   * Broadcasts writing status when LLM generates output
   */
  // TODO: Not implemented - commented out
  // api.on("llm_output", async (event, ctx) => {
  //   api.logger.debug(`[DeepJelly] llm_output: ${ctx.sessionKey}`);
  //
  //   const applicationId = getApplicationId();
  //   const assistantId = getAssistantId(ctx.agentId);
  //   const sessionKey = ctx.sessionKey || "unknown";
  //
  //   // Create and broadcast writing status message
  //   const writingMessage = createLlmOutputMessage({
  //     applicationId,
  //     assistantId,
  //     sessionKey,
  //     direction: "aiToAssistant",
  //     app_params: { hookType: "llm_output" },
  //   });
  //   server.broadcast(writingMessage);
  // });

  /**
   * before_tool_call hook
   * Broadcasts tool start status to trigger character animation
   */
  api.on("before_tool_call", async (event, ctx) => {
    api.logger.debug(`[DeepJelly] before_tool_call: ${event.toolName}`);

    const applicationId = getApplicationId();
    const characterId = getCharacterId(ctx.sessionKey);
    const sessionKey = ctx.sessionKey || "unknown";

    // Create and broadcast tool start message with proper routing
    const statusMessage = createToolStartMessage({
      applicationId,
      characterId,
      sessionKey,
      direction: "aiToAssistant",
      app_params: { hookType: "before_tool_call", toolName: event.toolName },
    });
    server.broadcast(statusMessage);
  });

  /**
   * after_tool_call hook
   * Broadcasts tool complete/error status to trigger character animation
   */
  api.on("after_tool_call", async (event, ctx) => {
    api.logger.debug(`[DeepJelly] after_tool_call: ${event.toolName}, error: ${!!event.error}`);

    const applicationId = getApplicationId();
    const characterId = getCharacterId(ctx.sessionKey);
    const sessionKey = ctx.sessionKey || "unknown";

    // Create appropriate status message based on result
    const statusMessage = event.error
      ? createToolErrorMessage({
          applicationId,
          characterId,
          sessionKey,
          direction: "aiToAssistant",
          app_params: { hookType: "after_tool_call", toolName: event.toolName },
        })
      : createToolCompleteMessage({
          applicationId,
          characterId,
          sessionKey,
          direction: "aiToAssistant",
          app_params: { hookType: "after_tool_call", toolName: event.toolName },
        });

    server.broadcast(statusMessage);
  });

  /**
   * agent_end hook
   * Extracts the final assistant message from the conversation
   * and sends it to DeepJelly with speak animation
   */
  api.on("agent_end", async (event, ctx) => {
    api.logger.debug(`[DeepJelly] agent_end: ${ctx.sessionKey}, success: ${event.success}`);

    // Only process successful agent runs
    if (!event.success) {
      return;
    }

    const applicationId = getApplicationId();
    const characterId = getCharacterId(ctx.sessionKey);
    const sessionKey = ctx.sessionKey || "unknown";

    // Extract the last assistant message from the conversation
    let finalContent = "";
    for (let i = event.messages.length - 1; i >= 0; i--) {
      const msg = event.messages[i] as Record<string, unknown> | undefined;
      if (!msg) continue;

      const role = msg.role;
      if (role === "assistant" && msg.content) {
        finalContent = extractTextContent(msg.content);
        break;
      }
    }

    // Only send if we found content
    if (finalContent) {
      api.logger.debug(`[DeepJelly] agent_end: sending final content (${finalContent.length} chars)`);
      const agentEndMessage = createAgentEndMessage(
        finalContent,
        {
          applicationId,
          characterId,
          sessionKey,
          direction: "aiToAssistant",
          app_params: { hookType: "agent_end" },
        }
      );
      server.broadcast(agentEndMessage);
    }
  });


  // Register CLI commands

  api.registerCli(

    ({ program }) => {

      const deepjellyCmd = program

        .command("deepjelly")

        .description("DeepJelly desktop avatar commands");



      // Connect command

      deepjellyCmd

        .command("connect")

        .description("Start the DeepJelly WebSocket server")

        .action(async () => {

          const result = callGatewayRPC("deepjelly.connect");

          if (result.error) {

            console.error(`Failed to start server: ${result.error}`);

            process.exit(1);

          }

          if (result.ok) {

            console.log(`DeepJelly server started on ${result.host}:${result.port}`);

          } else if (result.running) {

            console.log(`DeepJelly server already running on ${result.host}:${result.port}`);

          }

        });



      // Disconnect command

      deepjellyCmd

        .command("disconnect")

        .description("Stop the DeepJelly WebSocket server")

        .action(async () => {

          const result = callGatewayRPC("deepjelly.disconnect");

          if (result.error) {

            console.error(`Failed to stop server: ${result.error}`);

            process.exit(1);

          }

          if (result.ok) {

            console.log("DeepJelly server stopped");

          }

        });



      // Status command

      deepjellyCmd

        .command("status")

        .description("Show DeepJelly server status")

        .action(async () => {

          const result = callGatewayRPC("deepjelly.status");

          if (result.error) {

            console.error(`Error: ${result.error}`);

            process.exit(1);

          }

          console.log(JSON.stringify(result, null, 2));

        });



      // Clients command

      deepjellyCmd

        .command("clients")

        .description("List connected DeepJelly clients")

        .action(async () => {

          const result = callGatewayRPC("deepjelly.status");

          if (result.error) {

            console.error(`Error: ${result.error}`);

            process.exit(1);

          }

          if (result.connected_clients === 0) {

            console.log("No clients connected");

          } else {

            console.log(`Connected clients (${result.connected_clients}):`);

            result.clients?.forEach((client: any) => {

              console.log(`  - ${client.id} (${client.connected_duration})`);

            });

          }

        });



      // Test commands

      const testCmd = deepjellyCmd

        .command("test")

        .description("Test DeepJelly functionality");



      testCmd

        .command("message <content>")

        .description("Test sending a message")

        .action(async (content: string) => {

          const message = Converter.createSessionMessage({

            content,

          });

          const result = callGatewayRPC("deepjelly.broadcast", { message });

          if (result.error) {

            console.error(`Error: ${result.error}`);

            process.exit(1);

          }

          console.log(`Message sent to ${result.client_count} client(s)`);

        });



      testCmd

        .command("animation <animationId>")

        .description("Test playing an animation")

        .action(async (animationId: string) => {

          const message = Converter.createBehaviorMentalMessage({

            animation_id: animationId,

          });

          const result = callGatewayRPC("deepjelly.broadcast", { message });

          if (result.error) {

            console.error(`Error: ${result.error}`);

            process.exit(1);

          }

          console.log(`Animation '${animationId}' sent to ${result.client_count} client(s)`);

        });



      testCmd

        .command("emotion <emotionIcon>")

        .description("Test showing an emotion")

        .option("-t, --text <text>", "Thought text")

        .action(async (emotionIcon: string, options: any) => {

          const message = Converter.createBehaviorMentalMessage({

            animation_id: "idle",

            emotion_icon: emotionIcon,

            thought_text: options.text,

            show_bubble: true,

          });

          const result = callGatewayRPC("deepjelly.broadcast", { message });

          if (result.error) {

            console.error(`Error: ${result.error}`);

            process.exit(1);

          }

          console.log(`Emotion '${emotionIcon}' sent to ${result.client_count} client(s)`);

        });



      testCmd

        .command("notification <title> <content>")

        .description("Test showing a notification")

        .action(async (title: string, content: string) => {

          const message = Converter.createNotificationMessage({

            title,

            content,

          });

          const result = callGatewayRPC("deepjelly.broadcast", { message });

          if (result.error) {

            console.error(`Error: ${result.error}`);

            process.exit(1);

          }

          console.log(`Notification sent to ${result.client_count} client(s)`);

        });

    },

    { commands: ["deepjelly"] },

  );



  // Register background service for auto-start

  if (config.autoStart) {

    api.registerService({

      id: "deepjelly-server",

      start: async () => {

        if (!server.getStatus().running) {

          await server.start();

          api.logger.info("[DeepJelly] Auto-started server");

        }

      },

      stop: async () => {

        await server.stop();

      },

    });

  }



  // Log initialization

  api.logger.info("[DeepJelly] Channel plugin loaded");

  api.logger.info(`[DeepJelly] Configured for ${config.serverHost}:${config.serverPort}`);

}



// ============================================================================

// Configuration Helper

// ============================================================================



function getConfig(globalConfig: any): DeepJellyConfig {

  const deepjellyConfig = globalConfig.channels?.deepjelly || {};

  // Gateway configuration with multiple fallbacks
  // Priority order (matches dingtalk plugin):
  // 1. Channel config (deepjellyCfg.gatewayToken)
  // 2. Global config (globalConfig.gateway.auth.token)
  // 3. Environment variable (OPENCLAW_GATEWAY_TOKEN)
  // 4. Config file (~/.openclaw/openclaw.json) - resolved in server.ts

  // Try to get token from multiple sources
  let gatewayToken: string | undefined =
    deepjellyConfig.gatewayToken ??  // Channel config
    (globalConfig.gateway as any)?.auth?.token ??  // Global config
    process.env.OPENCLAW_GATEWAY_TOKEN ??  // Environment
    process.env.OPENCLAW_GATEWAY_PASSWORD;  // Environment (alternative)

  // If still not found, we'll try reading from config file in server.ts
  // (The server.ts has resolveGatewayAuthToken function that reads the file)

  let gatewayPort: number =
    deepjellyConfig.gatewayPort ??
    (globalConfig.gateway as any)?.port ??
    parseInt(process.env.OPENCLAW_GATEWAY_PORT || "18789", 10);

  // Log configuration for debugging
  console.log('[DeepJelly Config] =======================================');
  console.log('[DeepJelly Config] gatewayToken (from channel):', deepjellyConfig.gatewayToken ? 'YES' : 'NO');
  console.log('[DeepJelly Config] gatewayToken (from global):', (globalConfig.gateway as any)?.auth?.token ? 'YES' : 'NO');
  console.log('[DeepJelly Config] gatewayToken (from env):', process.env.OPENCLAW_GATEWAY_TOKEN ? 'YES' : 'NO');
  console.log('[DeepJelly Config] gatewayToken (final):', gatewayToken ? `${(gatewayToken as string).substring(0, 8)}...(${(gatewayToken as string).length} chars)` : 'undefined');
  console.log('[DeepJelly Config] gatewayPort:', gatewayPort);
  console.log('[DeepJelly Config] deepjellyConfig.serverPort:', deepjellyConfig.serverPort);
  console.log('[DeepJelly Config] deepjellyConfig.serverHost:', deepjellyConfig.serverHost);
  console.log('[DeepJelly Config] =======================================');

  return {

    enabled: deepjellyConfig.enabled ?? true,

    serverPort: deepjellyConfig.serverPort ?? 18790,

    serverHost: deepjellyConfig.serverHost ?? "0.0.0.0",  // Bind to all interfaces for remote access

    autoStart: deepjellyConfig.autoStart ?? true,

    characterId: deepjellyConfig.characterId,

    appearanceId: deepjellyConfig.appearanceId,

    animationMappings: deepjellyConfig.animationMappings,

    gatewayToken: gatewayToken,

    gatewayPort: gatewayPort,

    // Read agents from OpenClow config
    agents: globalConfig.agents?.list,

  };

}



// ============================================================================

// Exports

// ============================================================================



export { DeepJellyServer } from "./server";

export * from "./types";

export * from "./converter";

export * as AnimationPresets from "./converter";

