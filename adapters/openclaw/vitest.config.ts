import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    setupFiles: ["./test/setup.ts"],
    reporters: ["verbose"],
    onConsoleLog: (log) => {
      // Suppress noisy logs during tests
      if (log.includes("[DeepJelly]")) return false;
      return true;
    },
    isolate: true,
    include: ["test/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
  },
});
