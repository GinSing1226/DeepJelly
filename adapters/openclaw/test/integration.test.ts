/**
 * DeepJelly OpenClaw Plugin - Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocket } from "ws";
import { DeepJellyServer } from "../src/server";
import type { DeepJellyConfig } from "../src/types";

describe("DeepJelly Server Integration Tests", () => {
  let server: DeepJellyServer;
  let config: DeepJellyConfig;
  let client: WebSocket;

  beforeEach(() => {
    config = {
      enabled: true,
      serverPort: 18791, // Use different port for tests
      serverHost: "127.0.0.1",
      autoStart: false,
    };
    server = new DeepJellyServer(config);
  });

  afterEach(async () => {
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
    }
    if (server.getStatus().running) {
      await server.stop();
    }
  });

  describe("Server Lifecycle", () => {
    it("should start successfully", async () => {
      await server.start();
      const status = server.getStatus();
      expect(status.running).toBe(true);
      expect(status.port).toBe(18791);
    });

    it("should stop successfully", async () => {
      await server.start();
      await server.stop();
      const status = server.getStatus();
      expect(status.running).toBe(false);
    });

    it("should throw error when starting already running server", async () => {
      await server.start();
      await expect(server.start()).rejects.toThrow("Server is already running");
    });
  });

  describe("Client Connection", () => {
    beforeEach(async () => {
      await server.start();
    });

    it("should accept client connections", async () => {
      client = new WebSocket("ws://127.0.0.1:18791");

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          client.close();
          reject(new Error("Connection timeout"));
        }, 5000);

        client.once("open", () => {
          clearTimeout(timeout);
          const status = server.getStatus();
          expect(status.connected_clients).toBe(1);
          resolve();
        });

        client.once("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    });

    it("should send welcome message on connection", async () => {
      client = new WebSocket("ws://127.0.0.1:18791");

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          client.close();
          reject(new Error("Connection timeout"));
        }, 5000);

        client.once("message", (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.result?.event === "connected") {
              expect(message.result.client_id).toBeDefined();
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

    it("should track connected clients", async () => {
      const client1 = new WebSocket("ws://127.0.0.1:18791");
      const client2 = new WebSocket("ws://127.0.0.1:18791");

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          client1.close();
          client2.close();
          reject(new Error("Connection timeout"));
        }, 5000);

        let connections = 0;
        const checkConnections = () => {
          connections++;
          if (connections === 2) {
            const status = server.getStatus();
            expect(status.connected_clients).toBe(2);
            clearTimeout(timeout);
            client1.close();
            client2.close();
            resolve();
          }
        };

        client1.once("open", checkConnections);
        client2.once("open", checkConnections);

        client1.once("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });

        client2.once("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    });
  });

  describe("JSON-RPC Methods", () => {
    beforeEach(async () => {
      await server.start();
      client = new WebSocket("ws://127.0.0.1:18791");
    });

    it("should handle get_assistants request", async () => {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          client.close();
          reject(new Error("Request timeout"));
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
                  id: "1",
                  method: "get_assistants",
                  params: {},
                }),
              );
              return;
            }

            // Check for get_assistants response
            if (response.result?.assistants) {
              expect(response.result.assistants).toBeInstanceOf(Array);
              expect(response.result.assistants.length).toBeGreaterThan(0);
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

    it("should handle ping request", async () => {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          client.close();
          reject(new Error("Request timeout"));
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
                  method: "ping",
                  params: {},
                }),
              );
              return;
            }

            // Check for ping response
            if (response.result?.pong) {
              expect(response.result.pong).toBeGreaterThan(0);
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
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          client.close();
          reject(new Error("Request timeout"));
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

  describe("CAP Message Broadcasting", () => {
    beforeEach(async () => {
      await server.start();
    });

    it("should broadcast CAP message to all clients", async () => {
      const client1 = new WebSocket("ws://127.0.0.1:18791");
      const client2 = new WebSocket("ws://127.0.0.1:18791");

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          client1.close();
          client2.close();
          reject(new Error("Broadcast timeout"));
        }, 5000);

        let received = 0;
        const handleMessage = (data: any) => {
          try {
            const message = JSON.parse(data.toString());

            // Skip welcome messages
            if (message.result?.event === "connected") {
              return;
            }

            if (message.type === "behavior_mental") {
              received++;
              if (received === 2) {
                expect(message.payload.behavior.action_id).toBe("wave");
                clearTimeout(timeout);
                client1.close();
                client2.close();
                resolve();
              }
            }
          } catch (err) {
            clearTimeout(timeout);
            reject(err);
          }
        };

        let bothConnected = false;
        const checkBothConnected = () => {
          if (!bothConnected && client1.readyState === WebSocket.OPEN && client2.readyState === WebSocket.OPEN) {
            bothConnected = true;
            const capMessage = {
              msg_id: "test_001",
              timestamp: Math.floor(Date.now() / 1000),
              type: "behavior_mental",
              sender: { id: "openclaw", type: "system" },
              receiver: { id: "ui_core", type: "system" },
              payload: {
                behavior: {
                  domain: "social",
                  category: "base",
                  action_id: "wave",
                  urgency: 7,
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
            const sent = server.broadcast(capMessage);
            expect(sent).toBe(2);
          }
        };

        client1.once("open", checkBothConnected);
        client2.once("open", checkBothConnected);

        client1.on("message", handleMessage);
        client2.on("message", handleMessage);

        client1.once("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });

        client2.once("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    });
  });
});
