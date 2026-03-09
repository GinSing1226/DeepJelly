import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DeepJellyServer } from "../src/server";
import type { DeepJellyConfig } from "../src/types";
import { WebSocket } from "ws";

describe("DeepJellyServer", () => {
  let server: DeepJellyServer;
  let config: DeepJellyConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      serverPort: 18792,
      serverHost: "127.0.0.1",
      autoStart: false,
    };
    server = new DeepJellyServer(config);
  });

  afterEach(async () => {
    if (server.getStatus().running) {
      await server.stop();
    }
  });

  describe("Lifecycle", () => {
    it("should start and stop successfully", async () => {
      expect(server.getStatus().running).toBe(false);

      await server.start();
      expect(server.getStatus().running).toBe(true);
      expect(server.getStatus().port).toBe(18792);

      await server.stop();
      expect(server.getStatus().running).toBe(false);
    });

    it("should throw error when starting already running server", async () => {
      await server.start();

      await expect(server.start()).rejects.toThrow("Server is already running");
    });

    it("should return correct status", () => {
      const status = server.getStatus();

      expect(status.running).toBe(false);
      expect(status.port).toBe(18792);
      expect(status.host).toBe("127.0.0.1");
      expect(status.connected_clients).toBe(0);
      expect(status.clients).toEqual([]);
    });
  });

  describe("Broadcasting", () => {
    beforeEach(async () => {
      await server.start();
    });

    it("should broadcast CAP message to connected clients", async () => {
      const client = new WebSocket("ws://127.0.0.1:18792");

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          client.close();
          reject(new Error("Connection timeout"));
        }, 5000);

        client.once("open", () => {
          clearTimeout(timeout);

          const message = {
            msg_id: "test_001",
            timestamp: Date.now(),
            type: "behavior_mental" as const,
            sender: { id: "test", type: "system" as const },
            receiver: { id: "ui_core", type: "system" as const },
            payload: {
              behavior: {
                domain: "internal" as const,
                category: "base" as const,
                action_id: "wave",
                urgency: 5,
                intensity: 1.0,
                duration_ms: null,
              },
              mental: {
                show_bubble: false,
                thought_text: "",
                emotion_icon: "",
              },
            },
          };

          const sent = server.broadcast(message);
          expect(sent).toBe(1);
          resolve();
        });

        client.once("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      }).finally(() => {
        client.close();
      });
    });

    it("should return 0 when no clients connected", () => {
      const message = {
        msg_id: "test_002",
        timestamp: Date.now(),
        type: "session" as const,
        sender: { id: "test", type: "system" as const },
        receiver: { id: "ui_core", type: "system" as const },
        payload: {
          session_id: "test",
          chat_type: "private" as const,
          display_mode: "bubble_and_panel" as const,
          is_streaming: false,
          message: {
            role: "assistant" as const,
            type: "text" as const,
            content: "Hello",
          },
        },
      };

      const sent = server.broadcast(message);
      expect(sent).toBe(0);
    });
  });

  describe("JSON-RPC Handlers", () => {
    let client: WebSocket;

    beforeEach(async () => {
      await server.start();
    });

    afterEach(() => {
      if (client && client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });

    it("should handle ping request", async () => {
      client = new WebSocket("ws://127.0.0.1:18792");

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          client.close();
          reject(new Error("Test timeout"));
        }, 5000);

        let welcomeReceived = false;

        client.once("open", () => {
          client.send(
            JSON.stringify({
              jsonrpc: "2.0",
              id: "1",
              method: "ping",
              params: {},
            }),
          );
        });

        client.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());

            // Skip the welcome message
            if (response.result?.event === "connected") {
              welcomeReceived = true;
              return;
            }

            // Check for ping response
            if (response.result?.pong) {
              expect(response.result.pong).toBeGreaterThan(0);
              expect(welcomeReceived).toBe(true);
              clearTimeout(timeout);
              resolve();
            }
          } catch (err) {
            clearTimeout(timeout);
            reject(err);
          }
        });

        client.once("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    });

    it("should handle get_assistants request", async () => {
      client = new WebSocket("ws://127.0.0.1:18792");

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          client.close();
          reject(new Error("Test timeout"));
        }, 5000);

        client.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());

            // Skip the welcome message
            if (response.result?.event === "connected") {
              // Now send the request
              client.send(
                JSON.stringify({
                  jsonrpc: "2.0",
                  id: "2",
                  method: "get_assistants",
                  params: {},
                }),
              );
              return;
            }

            // Check for get_assistants response
            if (response.result?.assistants) {
              expect(Array.isArray(response.result.assistants)).toBe(true);
              clearTimeout(timeout);
              resolve();
            }
          } catch (err) {
            clearTimeout(timeout);
            reject(err);
          }
        });

        client.once("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });

        client.once("open", () => {
          // Wait for welcome message before sending request
        });
      });
    });

    it("should return error for unknown method", async () => {
      client = new WebSocket("ws://127.0.0.1:18792");

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          client.close();
          reject(new Error("Test timeout"));
        }, 5000);

        client.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());

            // Skip the welcome message
            if (response.result?.event === "connected") {
              // Now send the request
              client.send(
                JSON.stringify({
                  jsonrpc: "2.0",
                  id: "3",
                  method: "unknown_method",
                  params: {},
                }),
              );
              return;
            }

            // Check for error response
            if (response.error) {
              expect(response.error.code).toBe(-32601);
              expect(response.error.message).toBe("Method not found");
              clearTimeout(timeout);
              resolve();
            }
          } catch (err) {
            clearTimeout(timeout);
            reject(err);
          }
        });

        client.once("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });

        client.once("open", () => {
          // Wait for welcome message before sending request
        });
      });
    });
  });
});
