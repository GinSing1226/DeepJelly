/**
 * DeepJelly - Application Entry Point
 *
 * Meta-Name: Application Bootstrap
 * Meta-Description: Initializes i18n, sets up error handlers, and renders the app
 */

import ReactDOM from "react-dom/client";
import { initI18n } from "./i18n/init";
import App from "./App";
import "./styles.css";

// ========== 全局错误处理 ==========

// 辅助函数：格式化错误对象
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

// 捕获未处理的 Promise 拒绝
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const errorMessage = formatError(reason);
  console.error('[Global] Unhandled Promise Rejection:', errorMessage, reason);
  event.preventDefault(); // 防止默认的错误处理
});

// 捕获全局错误
window.addEventListener('error', (event) => {
  console.error('[Global] Uncaught Error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error ? formatError(event.error) : event.error,
  });
});

// ========== 应用启动 ==========

/**
 * Bootstrap the application with i18n initialization
 */
async function bootstrap() {
  try {
    // Step 1: Check DOM readiness
    const rootElement = document.getElementById("app");
    if (!rootElement) {
      throw new Error("Root element 'app' not found in DOM");
    }

    // Step 2: Initialize i18n with persisted locale from backend
    await initI18n();

    // Step 3: Create React root
    const root = ReactDOM.createRoot(rootElement);

    // Step 4: Render the app
    root.render(<App />);
  } catch (error) {
    console.error('[Bootstrap] Failed to bootstrap application:', error);

    // Fallback: render app anyway with default locale
    const rootElement = document.getElementById("app");
    if (rootElement) {
      ReactDOM.createRoot(rootElement).render(<App />);
    } else {
      console.error('[Bootstrap] FATAL: Cannot render app, root element not found!');
      alert('应用启动失败，请检查控制台日志\nApplication startup failed, please check console logs');
    }
  }
}

// ========== 启动应用 ==========

// 确保 DOM 加载完成后再启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    bootstrap();
  });
} else {
  bootstrap();
}
