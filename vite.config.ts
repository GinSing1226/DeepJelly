import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  clearScreen: false,

  server: {
    port: 12260,
    strictPort: true,
    // 确保能访问项目根目录下的 data 文件夹
    fs: {
      allow: ['..'],
    },
  },

  envPrefix: ["VITE_", "TAURI_"],

  build: {
    target: ["es2021", "chrome100", "safari13"],
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    // 在生产构建时移除 console 语句
    // 注意：这会移除所有 console.* 调用，包括 console.error
    // 如需保留错误日志，请在调试模式下运行或使用专门的日志系统
    ...(process.env.TAURI_DEBUG ? {} : {
      esbuild: {
        drop: ['console', 'debugger'],
      },
    }),
    rollupOptions: {
      input: {
        main: './index.html',
        dialog: './dialog.html',
        settings: './settings.html',
        'quit-confirm': './quit-confirm.html',
        'debug': './debug.html',
        'onboarding': './onboarding.html',
      },
    },
    // 确保 resources 目录被复制到构建输出
    assetsDir: 'assets',
    copyPublicDir: true,
  },

  resolve: {
    alias: {
      "@": "/src",
      // 在开发模式下将 /resources 映射到 ../data
      '/resources': '../data',
    },
  },

  // 开发环境下，禁用 publicDir 以避免冲突
  publicDir: false,

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.{test,spec}.{js,ts,tsx}'],
    exclude: ['node_modules', 'dist', 'src-tauri/target', 'src/**/*.test.*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/test/**/*',
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
