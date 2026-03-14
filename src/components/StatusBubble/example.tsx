import { StatusBubble, useStatusBubble } from './index';
import type { StatusType } from './useStatusBubble';

/**
 * Example 1: Basic Usage with Preset Status
 *
 * Demonstrates the simplest way to use StatusBubble with preset status types
 */
export function Example1_BasicUsage() {
  const { status, setPresetStatus } = useStatusBubble();

  return (
    <div>
      <StatusBubble status={status} />

      <div className="controls">
        <button onClick={() => setPresetStatus('thinking', 3000)}>
          Show Thinking Status
        </button>
        <button onClick={() => setPresetStatus('listening', 3000)}>
          Show Listening Status
        </button>
        <button onClick={() => setPresetStatus('idle')}>
          Show Idle Status (Indefinite)
        </button>
      </div>
    </div>
  );
}

/**
 * Example 2: Custom Status
 *
 * Shows how to display custom emoji + text combinations
 */
export function Example2_CustomStatus() {
  const { status, setCustomStatus, clearStatus } = useStatusBubble();

  return (
    <div>
      <StatusBubble status={status} />

      <div className="controls">
        <button onClick={() => setCustomStatus('🎉', '任务完成!', 3000)}>
          Success
        </button>
        <button onClick={() => setCustomStatus('⚠️', '警告内容', 5000)}>
          Warning
        </button>
        <button onClick={() => setCustomStatus('ℹ️', '信息提示', 2000)}>
          Info
        </button>
        <button onClick={() => setCustomStatus('', '仅文字状态', 3000)}>
          Text Only
        </button>
        <button onClick={clearStatus}>
          Clear Status
        </button>
      </div>
    </div>
  );
}

/**
 * Example 3: Status Based on Application State
 *
 * Demonstrates how to automatically show status based on application state
 */
export function Example3_StateBasedStatus() {
  const [appState, setAppState] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const { status, setPresetStatus, setCustomStatus } = useStatusBubble();

  // Update status based on application state
  useEffect(() => {
    switch (appState) {
      case 'idle':
        setPresetStatus('idle');
        break;
      case 'processing':
        setPresetStatus('thinking', 0); // 0 = indefinite
        break;
      case 'success':
        setCustomStatus('✅', '操作成功', 3000);
        break;
      case 'error':
        setCustomStatus('❌', '操作失败', 5000);
        break;
    }
  }, [appState, setPresetStatus, setCustomStatus]);

  const handleAction = async () => {
    setAppState('processing');

    try {
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 2000));
      setAppState('success');
    } catch (error) {
      setAppState('error');
    } finally {
      setTimeout(() => setAppState('idle'), 3000);
    }
  };

  return (
    <div>
      <StatusBubble status={status} />

      <div className="controls">
        <button onClick={handleAction} disabled={appState === 'processing'}>
          {appState === 'processing' ? '处理中...' : '执行操作'}
        </button>
      </div>
    </div>
  );
}

/**
 * Example 4: Network Status Monitoring
 *
 * Shows status based on network connectivity
 */
export function Example4_NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { status, setPresetStatus } = useStatusBubble();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setPresetStatus('idle');
    };

    const handleOffline = () => {
      setIsOnline(false);
      setPresetStatus('network_error', 0); // Show indefinitely until back online
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial status
    if (!isOnline) {
      setPresetStatus('network_error', 0);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOnline, setPresetStatus]);

  return (
    <div>
      <StatusBubble status={status} />

      <div className="network-info">
        Network Status: {isOnline ? 'Online' : 'Offline'}
      </div>
    </div>
  );
}

/**
 * Example 5: Integration with CAP Protocol
 *
 * Demonstrates how to handle CAP protocol status messages
 */
export function Example5_CAPIntegration() {
  const { status, setPresetStatus, setCustomStatus, clearStatus } = useStatusBubble();

  // Simulate CAP message handler
  useEffect(() => {
    // @ts-expect-error - Example code, not used in this demo
    const _handleCAPMessage = (message: any) => {
      if (message.type === 'status') {
        const { status_type, status_value, emoji, text, duration_ms } = message.payload;

        if (status_type === 'preset') {
          setPresetStatus(status_value as StatusType, duration_ms);
        } else if (status_type === 'custom') {
          setCustomStatus(emoji || '', text, duration_ms);
        } else if (status_type === 'clear') {
          clearStatus();
        }
      }
    };

    // In real implementation, this would listen to Tauri events
    // For example:
    // import { listen } from '@tauri-apps/api/event';
    // const unlisten = await listen('cap:message', handleCAPMessage);

    return () => {
      // Cleanup
    };
  }, [setPresetStatus, setCustomStatus, clearStatus]);

  return (
    <div>
      <StatusBubble status={status} />
    </div>
  );
}

/**
 * Example 6: All Preset Statuses Demo
 *
 * Shows all available preset status types for testing
 */
export function Example6_AllPresets() {
  const [currentPreset, setCurrentPreset] = useState<StatusType | null>(null);
  const { status, setPresetStatus } = useStatusBubble();

  const presets: StatusType[] = ['idle', 'listening', 'thinking', 'executing', 'speaking', 'network_error'];

  return (
    <div>
      <StatusBubble status={status} />

      <div className="preset-grid">
        {presets.map((preset) => (
          <button
            key={preset}
            onClick={() => {
              setCurrentPreset(preset);
              setPresetStatus(preset, 3000);
            }}
            className={currentPreset === preset ? 'active' : ''}
          >
            {preset}
          </button>
        ))}
      </div>

      <div className="current-status">
        Current: {currentPreset || 'None'}
      </div>
    </div>
  );
}

// Helper useState import (would normally be at top)
import { useState, useEffect } from 'react';
