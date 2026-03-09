/**
 * Agent Tools Registration
 *
 * Registers all DeepJelly agent tools that can be called by the LLM.
 */

import type {
  SendMessageParams,
  PlayAnimationParams,
  ShowEmotionParams,
  SetAppearanceParams,
  ShowNotificationParams,
} from "./types";

import {
  createSessionMessage,
  createBehaviorMentalMessage,
  createNotificationMessage,
  AnimationPresets,
} from "./converter";

// ============================================================================
// Tool Registration
// ============================================================================

export function registerTools(api: PluginAPI, server: any): void {
  // -----------------------------------------------------------------
  // deepjelly_send_message
  // -----------------------------------------------------------------
  api.registerTool({
    name: "deepjelly_send_message",
    description: "Send a message to display in the DeepJelly avatar chat bubble or dialog panel",
    parameters: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "Session ID for the conversation",
        },
        content: {
          type: "string",
          description: "Message content to display",
        },
        display_mode: {
          type: "string",
          enum: ["bubble_only", "panel_only", "bubble_and_panel"],
          description: "Where to display the message",
        },
        chat_type: {
          type: "string",
          enum: ["private", "group"],
          description: "Chat type",
        },
      },
      required: ["content"],
    },
    async execute(_id, params: SendMessageParams) {
      const message = createSessionMessage(params);
      const sent = server.broadcast(message);
      return {
        content: [{ type: "text", text: `Message sent to ${sent} client(s)` }],
      };
    },
  });

  // -----------------------------------------------------------------
  // deepjelly_play_animation
  // -----------------------------------------------------------------
  api.registerTool({
    name: "deepjelly_play_animation",
    description: "Play a character animation on the DeepJelly avatar. Use this to visually express what the AI is doing or feeling.",
    parameters: {
      type: "object",
      properties: {
        animation_id: {
          type: "string",
          description: "Animation ID (e.g., 'wave', 'think', 'work', 'cheer', 'sad', 'typing')",
        },
        domain: {
          type: "string",
          enum: ["internal", "social"],
          description: "Animation domain",
        },
        category: {
          type: "string",
          enum: ["base", "work", "result", "emotion", "physics"],
          description: "Animation category",
        },
        urgency: {
          type: "number",
          minimum: 1,
          maximum: 10,
          description: "Priority (1-10, higher interrupts current animation)",
        },
        intensity: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Animation intensity (0-1, affects scale)",
        },
        loop: {
          type: "boolean",
          description: "Whether to loop the animation",
        },
      },
      required: ["animation_id"],
    },
    async execute(_id, params: PlayAnimationParams) {
      const message = createBehaviorMentalMessage(params);
      const sent = server.broadcast(message);
      return {
        content: [{ type: "text", text: `Animation '${params.animation_id}' sent to ${sent} client(s)` }],
      };
    },
  });

  // -----------------------------------------------------------------
  // deepjelly_show_emotion
  // -----------------------------------------------------------------
  api.registerTool({
    name: "deepjelly_show_emotion",
    description: "Show an emotion bubble with icon and optional thought text. Use this to express feelings or quick reactions.",
    parameters: {
      type: "object",
      properties: {
        emotion_icon: {
          type: "string",
          description: "Emotion icon ID (e.g., 'sweat_drop', 'question_mark', 'exclamation_mark', 'heart_eyes', 'sparkles', 'gear', 'bulb', 'zzz', 'fire', 'check_mark')",
        },
        thought_text: {
          type: "string",
          description: "Thought/OS text to display in the bubble",
        },
        duration_ms: {
          type: "number",
          description: "Duration in milliseconds (null for indefinite)",
        },
        show_bubble: {
          type: "boolean",
          description: "Whether to show the bubble",
        },
      },
      required: ["emotion_icon"],
    },
    async execute(_id, params: ShowEmotionParams) {
      const message = createBehaviorMentalMessage({
        animation_id: "idle", // Emotion only, no animation
        urgency: 1,
        ...params,
      });
      const sent = server.broadcast(message);
      return {
        content: [{ type: "text", text: `Emotion '${params.emotion_icon}' shown to ${sent} client(s)` }],
      };
    },
  });

  // -----------------------------------------------------------------
  // deepjelly_set_appearance (optional)
  // -----------------------------------------------------------------
  api.registerTool(
    {
      name: "deepjelly_set_appearance",
      description: "Change the character appearance (costume/outfit). Use this to match the visual style to the context.",
      parameters: {
        type: "object",
        properties: {
          character_id: {
            type: "string",
            description: "Character ID (e.g., 'miku_01', 'neuro_01')",
          },
          appearance_id: {
            type: "string",
            description: "Appearance ID within the character",
          },
        },
        required: ["character_id"],
      },
      async execute(_id, params: SetAppearanceParams) {
        // This would be implemented as a special CAP event or stored in config
        return {
          content: [
            {
              type: "text",
              text: `Appearance set to ${params.character_id}${params.appearance_id ? "/" + params.appearance_id : ""}`,
            },
          ],
        };
      },
    },
    { optional: true },
  );

  // -----------------------------------------------------------------
  // deepjelly_get_status
  // -----------------------------------------------------------------
  api.registerTool({
    name: "deepjelly_get_status",
    description: "Get the current status of the DeepJelly connection and avatar",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    async execute(_id, _params) {
      const status = server.getStatus();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                running: status.running,
                connected_clients: status.connected_clients,
                port: status.port,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  });

  // -----------------------------------------------------------------
  // deepjelly_show_notification (optional)
  // -----------------------------------------------------------------
  api.registerTool(
    {
      name: "deepjelly_show_notification",
      description: "Show a notification in the system tray",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Notification title",
          },
          content: {
            type: "string",
            description: "Notification content/summary",
          },
          urgency: {
            type: "string",
            enum: ["low", "medium", "high"],
            description: "Notification urgency level",
          },
          type: {
            type: "string",
            enum: ["info", "success", "warning", "error"],
            description: "Notification type",
          },
        },
        required: ["title", "content"],
      },
      async execute(_id, params: ShowNotificationParams) {
        const message = createNotificationMessage(params);
        const sent = server.broadcast(message);
        return {
          content: [{ type: "text", text: `Notification sent to ${sent} client(s)` }],
        };
      },
    },
    { optional: true },
  );

  // -----------------------------------------------------------------
  // Preset animation shortcuts (optional tools)
  // -----------------------------------------------------------------
  api.registerTool(
    {
      name: "deepjelly_thinking",
      description: "Show thinking animation with bulb icon",
      parameters: {
        type: "object",
        properties: {
          thought_text: {
            type: "string",
            description: "Custom thought text",
          },
        },
        required: [],
      },
      async execute(_id, params: { thought_text?: string }) {
        const message = AnimationPresets.thinking({
          thought_text: params.thought_text,
        });
        server.broadcast(message);
        return { content: [{ type: "text", text: "Thinking animation started" }] };
      },
    },
    { optional: true },
  );

  api.registerTool(
    {
      name: "deepjelly_working",
      description: "Show working/typing animation",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      async execute(_id, _params) {
        const message = AnimationPresets.working();
        server.broadcast(message);
        return { content: [{ type: "text", text: "Working animation started" }] };
      },
    },
    { optional: true },
  );

  api.registerTool(
    {
      name: "deepjelly_success",
      description: "Show success animation with sparkles",
      parameters: {
        type: "object",
        properties: {
          thought_text: {
            type: "string",
            description: "Custom thought text",
          },
        },
        required: [],
      },
      async execute(_id, params: { thought_text?: string }) {
        const message = AnimationPresets.success({
          thought_text: params.thought_text,
        });
        server.broadcast(message);
        return { content: [{ type: "text", text: "Success animation started" }] };
      },
    },
    { optional: true },
  );

  api.registerTool(
    {
      name: "deepjelly_error",
      description: "Show error animation with sad emotion",
      parameters: {
        type: "object",
        properties: {
          thought_text: {
            type: "string",
            description: "Custom thought text",
          },
        },
        required: [],
      },
      async execute(_id, params: { thought_text?: string }) {
        const message = AnimationPresets.error({
          thought_text: params.thought_text,
        });
        server.broadcast(message);
        return { content: [{ type: "text", text: "Error animation started" }] };
      },
    },
    { optional: true },
  );

  api.registerTool(
    {
      name: "deepjelly_greeting",
      description: "Show greeting animation with wave and heart eyes",
      parameters: {
        type: "object",
        properties: {
          thought_text: {
            type: "string",
            description: "Custom greeting text",
          },
        },
        required: [],
      },
      async execute(_id, params: { thought_text?: string }) {
        const message = AnimationPresets.greeting({
          thought_text: params.thought_text,
        });
        server.broadcast(message);
        return { content: [{ type: "text", text: "Greeting animation started" }] };
      },
    },
    { optional: true },
  );
}

// ============================================================================
// Type Definitions for PluginAPI
// ============================================================================

interface PluginAPI {
  registerTool(tool: any, options?: { optional?: boolean }): void;
  registerGatewayMethod(name: string, handler: any): void;
  registerCli(handler: any, options?: { commands?: string[] }): void;
  registerCommand(command: any): void;
  registerService(service: any): void;
  logger: {
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
    debug(...args: any[]): void;
  };
  config: any;
}
