/**
 * Vitest Setup File
 *
 * Configures global test environment and handles unhandled errors.
 */

import { beforeEach, afterEach } from "vitest";
import { _resetMsgCounter } from "../src/converter";

// Track all WebSocket connections for cleanup
const websockets: any[] = [];

// Monkey-patch ws to track all connections
global.__websockets = websockets;

// Setup cleanup before each test
beforeEach(() => {
  // Clear tracked WebSockets
  websockets.length = 0;
  // Reset message counter
  _resetMsgCounter();
});

// Cleanup after each test
afterEach(async () => {
  // Close any remaining WebSocket connections
  const closePromises = websockets.map((ws) => {
    if (ws && ws.readyState === 1) { // OPEN
      return new Promise<void>((resolve) => {
        ws.once("close", () => resolve());
        ws.close();
        // Timeout fallback
        setTimeout(() => resolve(), 100);
      });
    }
    return Promise.resolve();
  });

  await Promise.all(closePromises);
  websockets.length = 0;
});

// Handle unhandled errors
process.on("unhandledRejection", (reason) => {
  console.error("[Vitest Setup] Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[Vitest Setup] Uncaught Exception:", error);
});
