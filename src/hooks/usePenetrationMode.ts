/**
 * usePenetrationMode Hook
 *
 * Meta-Name: Penetration Mode Hook
 * Meta-Description: 管理窗口穿透模式的状态和逻辑，包括 Ctrl 键监听和鼠标位置检测
 *
 * 架构说明：
 * - 后端 (input_state.rs) 使用 rdev 监听全局事件，完全控制穿透模式
 * - 前端只负责：1) 发送 Ctrl 状态到后端 2) 监听后端的穿透模式变化事件
 * - 这样避免前后端竞争条件，确保穿透模式状态一致性
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

/** 穿透模式状态 */
export interface PenetrationModeState {
  /** 是否处于穿透模式 */
  isPenetrationMode: boolean;
  /** Ctrl 键是否按下 */
  ctrlPressed: boolean;
  /** 鼠标是否在窗口内 */
  mouseInWindow: boolean;
}

/** Hook 返回值 */
export interface UsePenetrationModeResult {
  /** 是否处于穿透模式 */
  isPenetrationMode: boolean;
  /** Ctrl 键是否按下 */
  ctrlPressed: boolean;
  /** 鼠标是否在窗口内 */
  mouseInWindow: boolean;
  /** 手动设置穿透模式 */
  setPenetrationMode: (enabled: boolean) => void;
  /** 恢复实体模式 */
  restoreSolidMode: () => Promise<void>;
  /** 处理鼠标进入窗口（由组件调用） */
  handleMouseEnter: () => void;
  /** 处理鼠标离开窗口（由组件调用） */
  handleMouseLeave: () => void;
}

/**
 * 穿透模式管理 Hook
 *
 * DeepJelly 需求：
 * 1. 默认状态：实体模式（可交互）
 * 2. 按住 Ctrl 键 -> 启用穿透模式
 * 3. 释放 Ctrl 键 -> 恢复实体模式
 *
 * 架构：
 * - 后端 rdev 监听全局 Ctrl 和鼠标事件，完全控制穿透模式切换
 * - 前端只负责发送 Ctrl 状态和监听后端事件
 */
export function usePenetrationMode(): UsePenetrationModeResult {
  const [isPenetrationMode, setIsPenetrationMode] = useState(false);
  const [ctrlPressed, setCtrlPressed] = useState(false);
  const [mouseInWindow, setMouseInWindow] = useState(false);

  // 后端穿透模式变化事件监听 - 后端是唯一的模式控制源
  useEffect(() => {
    const unlistenPromise = listen<boolean>("penetration_mode_changed", (event) => {
      setIsPenetrationMode(event.payload);
    });
    return () => {
      unlistenPromise.then(fn => fn());
    };
  }, []);

  /** 发送 Ctrl 状态到后端 */
  const sendCtrlStateToBackend = useCallback(async (pressed: boolean) => {
    try {
      await invoke("ctrl_state_changed", { pressed });
    } catch (error) {
      console.error("[PenetrationMode] Failed to send Ctrl state:", error);
    }
  }, []);

  /**
   * 手动设置穿透模式（供右键菜单等使用）
   * 注意：这只设置后端状态，实际穿透由后端 rdev 控制
   */
  const setPenetrationMode = useCallback((enabled: boolean) => {
    sendCtrlStateToBackend(enabled);
  }, [sendCtrlStateToBackend]);

  /**
   * 恢复实体模式
   */
  const restoreSolidMode = useCallback(async () => {
    setCtrlPressed(false);
    await sendCtrlStateToBackend(false);
  }, [sendCtrlStateToBackend]);

  /**
   * 处理 Ctrl 键按下
   */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Control' && !e.repeat) {
      setCtrlPressed(true);
      sendCtrlStateToBackend(true);
    }
  }, [sendCtrlStateToBackend]);

  /**
   * 处理 Ctrl 键释放
   */
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Control') {
      setCtrlPressed(false);
      sendCtrlStateToBackend(false);
    }
  }, [sendCtrlStateToBackend]);

  /**
   * 处理鼠标离开窗口（由组件调用）
   */
  const handleMouseLeave = useCallback(() => {
    setMouseInWindow(false);
  }, []);

  /**
   * 处理鼠标进入窗口（由组件调用）
   */
  const handleMouseEnter = useCallback(() => {
    setMouseInWindow(true);
  }, []);

  // 设置全局键盘事件监听（Ctrl键）
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return {
    isPenetrationMode,
    ctrlPressed,
    mouseInWindow,
    setPenetrationMode,
    restoreSolidMode,
    // 暴露给组件使用的回调
    handleMouseEnter,
    handleMouseLeave,
  };
}
