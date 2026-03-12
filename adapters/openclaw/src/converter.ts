/**
 * CAP Message Converter
 *
 * Converts between OpenClaw's internal message format and
 * DeepJelly's CAP (Character Animation Protocol) format.
 */

import type {
  CAPMessage,
  BehaviorMentalPayload,
  SessionPayload,
  NotificationPayload,
  SendMessageParams,
  AnimationRequest,
  NotificationRequest,
} from "./types";

// ============================================================================
// Message ID Generator
// ============================================================================

let msgCounter = 0;

export function generateMsgId(): string {
  return `msg_${Date.now()}_${++msgCounter}`;
}

/**
 * Reset message counter (for testing purposes)
 * @internal
 */
export function _resetMsgCounter(): void {
  msgCounter = 0;
}

// ============================================================================
// CAP Message Builders
// ============================================================================

/**
 * Optional participant info for overriding default sender/receiver
 */
export interface ParticipantOptions {
  id?: string;
  routing?: {
    sessionKey?: string;
  };
}

/**
 * Create a CAP session message for displaying chat
 */
export function createSessionMessage(
  params: SendMessageParams,
  sender?: ParticipantOptions,
  receiver?: ParticipantOptions,
  app_params?: Record<string, any>
): CAPMessage {
  const payload: SessionPayload = {
    session_id: params.session_id || "default",
    chat_type: params.chat_type || "private",
    display_mode: params.display_mode || "bubble_and_panel",
    is_streaming: false,
    message: {
      role: "assistant",
      type: "text",
      content: params.content,
    },
  };

  // Add app_params if provided
  if (app_params) {
    (payload as any).app_params = app_params;
  }

  return {
    msg_id: generateMsgId(),
    timestamp: Math.floor(Date.now() / 1000),
    type: "session",
    sender: {
      id: sender?.id || "openclaw",
      type: "assistant",
      source_app: "openclaw",
      ...(sender?.routing && { routing: sender.routing }),
    },
    receiver: {
      id: receiver?.id || "character",
      type: "assistant",
      source_app: "deepjelly",
      ...(receiver?.routing && { routing: receiver.routing }),
    },
    payload,
  };
}

/**
 * Create a CAP behavior_mental message for playing animations
 */
export function createBehaviorMentalMessage(
  params: AnimationRequest,
  sender?: ParticipantOptions,
  receiver?: ParticipantOptions,
  app_params?: Record<string, any>
): CAPMessage {
  const { animation_id, thought_text, emotion_icon, show_bubble, ...behavior } = params;

  const payload: BehaviorMentalPayload = {
    behavior: {
      domain: behavior.domain || "internal",
      category: behavior.category || "base",
      action_id: animation_id,
      urgency: behavior.urgency ?? 5,
      intensity: behavior.intensity ?? 1.0,
      duration_ms: null,
    },
    mental: {
      show_bubble: show_bubble ?? false,
      thought_text: thought_text || "",
      emotion_icon: emotion_icon || "",
    },
  };

  // Add app_params if provided
  if (app_params) {
    (payload as any).app_params = app_params;
  }

  return {
    msg_id: generateMsgId(),
    timestamp: Math.floor(Date.now() / 1000),
    type: "behavior_mental",
    sender: {
      id: sender?.id || "openclaw",
      type: "assistant",
      source_app: "openclaw",
      ...(sender?.routing && { routing: sender.routing }),
    },
    receiver: {
      id: receiver?.id || "character",
      type: "assistant",
      source_app: "deepjelly",
      ...(receiver?.routing && { routing: receiver.routing }),
    },
    payload,
  };
}

/**
 * Create a CAP notification message for tray notifications
 */
export function createNotificationMessage(
  params: NotificationRequest,
  sender?: ParticipantOptions,
  receiver?: ParticipantOptions
): CAPMessage {
  return {
    msg_id: generateMsgId(),
    timestamp: Math.floor(Date.now() / 1000),
    type: "notification",
    sender: {
      id: sender?.id || "openclaw",
      type: "assistant",
      source_app: "openclaw",
      ...(sender?.routing && { routing: sender.routing }),
    },
    receiver: {
      id: receiver?.id || "character",
      type: "assistant",
      source_app: "deepjelly",
      ...(receiver?.routing && { routing: receiver.routing }),
    },
    payload: {
      urgency: params.urgency || "medium",
      type: params.type || "info",
      content: {
        title: params.title,
        summary: params.content,
      },
    } satisfies NotificationPayload,
  };
}

// ============================================================================
// Preset Animation Helpers
// ============================================================================

/**
 * Extended animation options with participant info
 */
export interface AnimationRequestWithOptions extends AnimationRequest {
  sender?: ParticipantOptions;
  receiver?: ParticipantOptions;
}

/**
 * Preset animations for common AI states
 * All presets accept optional animation options and optional participant info
 */
export const AnimationPresets = {
  thinking: (
    animationOptions?: Partial<AnimationRequest>,
    sender?: ParticipantOptions,
    receiver?: ParticipantOptions
  ): CAPMessage =>
    createBehaviorMentalMessage({
      animation_id: "think",
      category: "work",
      urgency: 5,  // Same as other non-speak animations
      intensity: 0.8,
      show_bubble: true,
      emotion_icon: "bulb",
      thought_text: "Thinking...",
      ...animationOptions,
    }, sender, receiver),

  working: (
    animationOptions?: Partial<AnimationRequest>,
    sender?: ParticipantOptions,
    receiver?: ParticipantOptions
  ): CAPMessage =>
    createBehaviorMentalMessage({
      animation_id: "typing",
      category: "work",
      urgency: 5,  // Same as other non-speak animations
      intensity: 1.0,
      ...animationOptions,
    }, sender, receiver),

  success: (
    animationOptions?: Partial<AnimationRequest>,
    sender?: ParticipantOptions,
    receiver?: ParticipantOptions
  ): CAPMessage =>
    createBehaviorMentalMessage({
      animation_id: "cheer",
      category: "result",
      urgency: 5,  // Same as other non-speak animations
      intensity: 1.0,
      show_bubble: true,
      emotion_icon: "sparkles",
      thought_text: "Done!",
      ...animationOptions,
    }, sender, receiver),

  error: (
    animationOptions?: Partial<AnimationRequest>,
    sender?: ParticipantOptions,
    receiver?: ParticipantOptions
  ): CAPMessage =>
    createBehaviorMentalMessage({
      animation_id: "sad",
      category: "emotion",
      urgency: 5,  // Same as other non-speak animations
      intensity: 0.8,
      show_bubble: true,
      emotion_icon: "sweat_drop",
      thought_text: "Oops!",
      ...animationOptions,
    }, sender, receiver),

  greeting: (
    animationOptions?: Partial<AnimationRequest>,
    sender?: ParticipantOptions,
    receiver?: ParticipantOptions
  ): CAPMessage =>
    createBehaviorMentalMessage({
      animation_id: "wave",
      category: "emotion",
      urgency: 5,  // Same as other non-speak animations
      intensity: 1.0,
      show_bubble: true,
      emotion_icon: "heart_eyes",
      thought_text: "Hello!",
      ...animationOptions,
    }, sender, receiver),

  confused: (
    animationOptions?: Partial<AnimationRequest>,
    sender?: ParticipantOptions,
    receiver?: ParticipantOptions
  ): CAPMessage =>
    createBehaviorMentalMessage({
      animation_id: "wonder",
      category: "emotion",
      urgency: 5,  // Same as other non-speak animations
      intensity: 0.7,
      show_bubble: true,
      emotion_icon: "question_mark",
      thought_text: "Hmm...",
      ...animationOptions,
    }, sender, receiver),

  idle: (
    animationOptions?: Partial<AnimationRequest>,
    sender?: ParticipantOptions,
    receiver?: ParticipantOptions
  ): CAPMessage =>
    createBehaviorMentalMessage({
      animation_id: "idle",
      category: "base",
      urgency: 1,  // Low priority, will be interrupted
      intensity: 0.5,
      ...animationOptions,
    }, sender, receiver),
};

// ============================================================================
// Tool Call Status Messages
// ============================================================================

/**
 * Message direction for tool status notifications
 */
export type MessageDirection = "aiToAssistant" | "assistantToAi";

/**
 * Common options for tool status messages
 */
export interface ToolStatusMessageOptions {
  /** AI application ID (from DeepJelly) */
  applicationId: string;
  /** Character ID (from DeepJelly) */
  characterId: string;
  /** Session key for routing */
  sessionKey: string;
  /** Message direction - who is sending to whom */
  direction?: MessageDirection;
  /** Application-specific parameters (extensible for different AI apps) */
  app_params?: {
    /** Hook type for event engine to identify the trigger source */
    hookType?: string;
    /** Additional app-specific parameters */
    [key: string]: any;
  };
}

/**
 * Create a tool call start status message
 *
 * @param options - Message routing options
 */
export function createToolStartMessage(
  options: ToolStatusMessageOptions
): CAPMessage {
  const { applicationId, characterId, sessionKey, direction = "aiToAssistant", app_params } = options;

  // Determine sender and receiver based on direction
  const sender = direction === "aiToAssistant"
    ? { id: applicationId, routing: { sessionKey } }
    : { id: characterId, routing: { sessionKey } };

  const receiver = direction === "aiToAssistant"
    ? { id: characterId }
    : { id: applicationId };

  return createBehaviorMentalMessage({
    animation_id: "execute",
    category: "work",
    urgency: 5,
    intensity: 0.8,
    show_bubble: true,
    emotion_icon: "keyboard",
    thought_text: "Tool running",
  }, sender, receiver, app_params);
}

/**
 * Create a tool call complete status message
 *
 * @param options - Message routing options
 */
export function createToolCompleteMessage(
  options: ToolStatusMessageOptions
): CAPMessage {
  const { applicationId, characterId, sessionKey, direction = "aiToAssistant", app_params } = options;

  // Determine sender and receiver based on direction
  const sender = direction === "aiToAssistant"
    ? { id: applicationId, routing: { sessionKey } }
    : { id: characterId, routing: { sessionKey } };

  const receiver = direction === "aiToAssistant"
    ? { id: characterId }
    : { id: applicationId };

  return createBehaviorMentalMessage({
    animation_id: "execute",
    category: "result",
    urgency: 5,  // Same as other non-speak animations
    intensity: 0.6,
    show_bubble: true,
    emotion_icon: "check",
    thought_text: "Tool Done",
  }, sender, receiver, app_params);
}

/**
 * Create a tool call error status message
 *
 * @param options - Message routing options
 */
export function createToolErrorMessage(
  options: ToolStatusMessageOptions
): CAPMessage {
  const { applicationId, characterId, sessionKey, direction = "aiToAssistant", app_params } = options;

  // Determine sender and receiver based on direction
  const sender = direction === "aiToAssistant"
    ? { id: applicationId, routing: { sessionKey } }
    : { id: characterId, routing: { sessionKey } };

  const receiver = direction === "aiToAssistant"
    ? { id: characterId }
    : { id: applicationId };

  return createBehaviorMentalMessage({
    animation_id: "execute",
    category: "emotion",
    urgency: 5,  // Same as other non-speak animations
    intensity: 0.8,
    show_bubble: true,
    emotion_icon: "x",
    thought_text: "Tool Failed",
  }, sender, receiver, app_params);
}

/**
 * Create a message received status message
 *
 * @param options - Message routing options
 */
export function createMessageReceivedMessage(
  options: ToolStatusMessageOptions
): CAPMessage {
  const { applicationId, characterId, sessionKey, direction = "aiToAssistant" } = options;

  // Determine sender and receiver based on direction
  const sender = direction === "aiToAssistant"
    ? { id: applicationId, routing: { sessionKey } }
    : { id: characterId, routing: { sessionKey } };

  const receiver = direction === "aiToAssistant"
    ? { id: characterId }
    : { id: applicationId };

  return createBehaviorMentalMessage({
    animation_id: "execute",
    category: "work",
    urgency: 5,
    intensity: 0.8,
    show_bubble: true,
    emotion_icon: "envelope",
    thought_text: "Got it",
  }, sender, receiver);
}

// ============================================================================
// Session End Message
// ============================================================================

/**
 * Create a session end message that triggers 'speak' animation
 *
 * @param options - Message routing options
 */
export function createSessionEndMessage(
  options: ToolStatusMessageOptions
): CAPMessage {
  const { applicationId, characterId, sessionKey, direction = "aiToAssistant" } = options;

  // Determine sender and receiver based on direction
  const sender = direction === "aiToAssistant"
    ? { id: applicationId, routing: { sessionKey } }
    : { id: characterId, routing: { sessionKey } };

  const receiver = direction === "aiToAssistant"
    ? { id: characterId }
    : { id: applicationId };

  return createBehaviorMentalMessage({
    animation_id: "speak",
    category: "result",
    urgency: 9,  // High priority - only speak should have high priority
    intensity: 0.5,
    show_bubble: false,
    thought_text: "",
  }, sender, receiver);
}

/**
 * Create an LLM thinking status message
 * Triggered when sending input to LLM (agent is thinking)
 *
 * @param options - Message routing options
 */
export function createLlmThinkingMessage(
  options: ToolStatusMessageOptions
): CAPMessage {
  const { applicationId, characterId, sessionKey, direction = "aiToAssistant", app_params } = options;

  // Determine sender and receiver based on direction
  const sender = direction === "aiToAssistant"
    ? { id: applicationId, routing: { sessionKey } }
    : { id: characterId, routing: { sessionKey } };

  const receiver = direction === "aiToAssistant"
    ? { id: characterId }
    : { id: applicationId };

  return createBehaviorMentalMessage({
    animation_id: "execute",
    category: "work",
    urgency: 5,
    intensity: 0.8,
    show_bubble: true,
    emotion_icon: "bulb",
    thought_text: "Thinking",
  }, sender, receiver, app_params);
}

/**
 * Create an LLM output status message
 * Triggered when LLM generates output (agent is writing)
 *
 * @param options - Message routing options
 */
export function createLlmOutputMessage(
  options: ToolStatusMessageOptions
): CAPMessage {
  const { applicationId, characterId, sessionKey, direction = "aiToAssistant", app_params } = options;

  // Determine sender and receiver based on direction
  const sender = direction === "aiToAssistant"
    ? { id: applicationId, routing: { sessionKey } }
    : { id: characterId, routing: { sessionKey } };

  const receiver = direction === "aiToAssistant"
    ? { id: characterId }
    : { id: applicationId };

  return createBehaviorMentalMessage({
    animation_id: "execute",
    category: "work",
    urgency: 5,
    intensity: 0.8,
    show_bubble: true,
    emotion_icon: "pencil",
    thought_text: "Writing",
  }, sender, receiver, app_params);
}

/**
 * Create a session message with conversation content
 * This is used to send the actual conversation to DeepJelly
 *
 * @param content - The conversation content/summary
 * @param options - Message routing options containing characterId, sessionKey, etc.
 */
export function createConversationContentMessage(
  content: string,
  options: ToolStatusMessageOptions
): CAPMessage {
  const { applicationId, characterId, sessionKey, direction = "aiToAssistant" } = options;

  // Determine sender and receiver based on direction
  const sender = direction === "aiToAssistant"
    ? { id: applicationId, routing: { sessionKey } }
    : { id: characterId, routing: { sessionKey } };

  const receiver = direction === "aiToAssistant"
    ? { id: characterId }
    : { id: applicationId };

  return createSessionMessage(
    {
      content,
      display_mode: "bubble_and_panel",
      session_id: sessionKey,
      chat_type: "private",
    },
    sender,
    receiver
  );
}

/**
 * Create a message when agent starts processing
 * Triggered by before_agent_start hook
 *
 * @param options - Message routing options
 */
export function createAgentStartMessage(
  options: ToolStatusMessageOptions
): CAPMessage {
  const { applicationId, characterId, sessionKey, direction = "aiToAssistant", app_params } = options;

  // Determine sender and receiver based on direction
  const sender = direction === "aiToAssistant"
    ? { id: applicationId, routing: { sessionKey } }
    : { id: characterId, routing: { sessionKey } };

  const receiver = direction === "aiToAssistant"
    ? { id: characterId }
    : { id: applicationId };

  return createBehaviorMentalMessage({
    animation_id: "execute",
    category: "work",
    urgency: 5,  // Normal priority, same as other non-speak animations
    intensity: 0.8,
    show_bubble: true,
    emotion_icon: "keyboard",
    thought_text: "Got it",
  }, sender, receiver, app_params);
}

/**
 * Create a message when agent ends with final output
 * Triggered by agent_end hook
 * Uses session type to send the actual conversation content
 *
 * @param finalContent - The final assistant response content
 * @param options - Message routing options containing characterId, sessionKey, etc.
 */
export function createAgentEndMessage(
  finalContent: string,
  options: ToolStatusMessageOptions
): CAPMessage {
  const { applicationId, characterId, sessionKey, direction = "aiToAssistant", app_params } = options;

  // Determine sender and receiver based on direction
  const sender = direction === "aiToAssistant"
    ? { id: applicationId, routing: { sessionKey } }
    : { id: characterId, routing: { sessionKey } };

  const receiver = direction === "aiToAssistant"
    ? { id: characterId }
    : { id: applicationId };

  return createSessionMessage(
    {
      content: finalContent,
      display_mode: "bubble_and_panel",
      session_id: sessionKey,
      chat_type: "private",
    },
    sender,
    receiver,
    { ...app_params, finalContent, hookType: "agent_end" }
  );
}
