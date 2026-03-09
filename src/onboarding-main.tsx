/**
 * Onboarding Window Entry Point
 *
 * Meta-Name: Onboarding Window Bootstrap
 * Meta-Description: Initializes i18n and renders the onboarding app
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { initI18n } from "./i18n/init";
import { OnboardingApp } from "./components/OnboardingApp";
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
  console.error('[Onboarding] Unhandled Promise Rejection:', errorMessage, reason);
  event.preventDefault();
});

// 捕获全局错误
window.addEventListener('error', (event) => {
  console.error('[Onboarding] Uncaught Error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error ? formatError(event.error) : event.error,
  });
});

// ========== 应用启动 ==========

/**
 * Bootstrap the onboarding application
 */
async function bootstrap() {
  try {
    // Step 1: Check DOM readiness
    const rootElement = document.getElementById("app");
    if (!rootElement) {
      throw new Error("Root element 'app' not found in DOM");
    }

    // Step 2: Initialize i18n
    await initI18n();

    // Step 3: Create React root
    const root = ReactDOM.createRoot(rootElement);

    // Step 4: Render the onboarding app
    root.render(<OnboardingApp />);
  } catch (error) {
    console.error('[Onboarding] Failed to bootstrap:', error);

    // Fallback: render anyway with default locale
    const rootElement = document.getElementById("app");
    if (rootElement) {
      ReactDOM.createRoot(rootElement).render(<OnboardingApp />);
    } else {
      console.error('[Onboarding] FATAL: Cannot render app, root element not found!');
      alert('应用启动失败，请检查控制台日志\nApplication startup failed, please check console logs');
    }
  }
}

// ========== 启动应用 ==========

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    bootstrap();
  });
} else {
  bootstrap();
}
