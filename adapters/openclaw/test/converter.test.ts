import { describe, it, expect } from "vitest";
import {
  createSessionMessage,
  createBehaviorMentalMessage,
  createNotificationMessage,
  AnimationPresets,
} from "../src/converter";

describe("CAP Message Converter", () => {
  describe("createSessionMessage", () => {
    it("should create a session message with default values", () => {
      const params = {
        content: "Hello, world!",
      };
      const message = createSessionMessage(params);

      expect(message.type).toBe("session");
      expect(message.msg_id).toMatch(/^msg_\d+_\d+$/);
      expect(message.payload.message.content).toBe("Hello, world!");
      expect(message.payload.display_mode).toBe("bubble_and_panel");
      expect(message.payload.chat_type).toBe("private");
    });

    it("should create a session message with custom values", () => {
      const params = {
        content: "Custom message",
        session_id: "sess_123",
        display_mode: "panel_only" as const,
        chat_type: "group" as const,
      };
      const message = createSessionMessage(params);

      expect(message.payload.session_id).toBe("sess_123");
      expect(message.payload.display_mode).toBe("panel_only");
      expect(message.payload.chat_type).toBe("group");
    });
  });

  describe("createBehaviorMentalMessage", () => {
    it("should create a behavior_mental message", () => {
      const params = {
        animation_id: "wave",
        urgency: 7,
        intensity: 0.8,
      };
      const message = createBehaviorMentalMessage(params);

      expect(message.type).toBe("behavior_mental");
      expect(message.payload.behavior.action_id).toBe("wave");
      expect(message.payload.behavior.urgency).toBe(7);
      expect(message.payload.behavior.intensity).toBe(0.8);
      expect(message.payload.mental.show_bubble).toBe(false);
    });

    it("should include mental state when specified", () => {
      const params = {
        animation_id: "think",
        show_bubble: true,
        emotion_icon: "bulb",
        thought_text: "Thinking...",
      };
      const message = createBehaviorMentalMessage(params);

      expect(message.payload.mental.show_bubble).toBe(true);
      expect(message.payload.mental.emotion_icon).toBe("bulb");
      expect(message.payload.mental.thought_text).toBe("Thinking...");
    });
  });

  describe("createNotificationMessage", () => {
    it("should create a notification message", () => {
      const params = {
        title: "Test",
        content: "Test content",
      };
      const message = createNotificationMessage(params);

      expect(message.type).toBe("notification");
      expect(message.payload.content.title).toBe("Test");
      expect(message.payload.content.summary).toBe("Test content");
      expect(message.payload.urgency).toBe("medium");
      expect(message.payload.type).toBe("info");
    });

    it("should support custom urgency and type", () => {
      const params = {
        title: "Alert",
        content: "Important",
        urgency: "high" as const,
        type: "warning" as const,
      };
      const message = createNotificationMessage(params);

      expect(message.payload.urgency).toBe("high");
      expect(message.payload.type).toBe("warning");
    });
  });

  describe("AnimationPresets", () => {
    it("should create thinking animation preset", () => {
      const message = AnimationPresets.thinking();

      expect(message.type).toBe("behavior_mental");
      expect(message.payload.behavior.action_id).toBe("think");
      expect(message.payload.mental.emotion_icon).toBe("bulb");
      expect(message.payload.mental.thought_text).toBe("Thinking...");
    });

    it("should allow custom thought text in presets", () => {
      const message = AnimationPresets.success({
        thought_text: "All done!",
      });

      expect(message.payload.behavior.action_id).toBe("cheer");
      expect(message.payload.mental.thought_text).toBe("All done!");
    });
  });
});
