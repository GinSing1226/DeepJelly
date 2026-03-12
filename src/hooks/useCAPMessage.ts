/**
 * CAP Message Handler Hook
 *
 * Meta-Name: CAP Protocol Message Handler Hook
 * Meta-Description: React hook for receiving, parsing, and routing CAP protocol messages from Tauri backend.
 * Related: [3.2.消息类型](../../../docs/private_docs/Tech/3.2.消息类型.md)
 */

import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { parseCAPMessage } from '@/utils/capParser';
import { CAP_EVENT_NAME } from '@/types/cap';
import type {
  AnyTypedCAPMessage,
} from '@/types/cap';

/**
 * Handler functions for different CAP message types
 * Each handler receives the complete message including sender and receiver info
 */
export interface CAPMessageHandlers {
  /** Handler for behavior_mental messages - controls character animation and mental state */
  onBehaviorMental?: (message: AnyTypedCAPMessage & { type: 'behavior_mental' }) => void;
  /** Handler for session messages - chat messages */
  onSession?: (message: AnyTypedCAPMessage & { type: 'session' }) => void;
  /** Handler for notification messages - tray notifications */
  onNotification?: (message: AnyTypedCAPMessage & { type: 'notification' }) => void;
  /** Handler for event messages - system events */
  onEvent?: (message: AnyTypedCAPMessage & { type: 'event' }) => void;
}

/**
 * Options for the useCAPMessage hook
 */
export interface UseCAPMessageOptions extends CAPMessageHandlers {
  /** Whether to enable message listening (default: true) */
  enabled?: boolean;
  /** Callback for parsing errors */
  onError?: (error: Error, rawMessage: unknown) => void;
}

let componentId = 0;

/**
 * Hook for listening to and routing CAP protocol messages
 *
 * @param options - Handler functions for different message types
 * @returns Object containing current connection status
 *
 * @example
 * ```tsx
 * function App() {
 *   useCAPMessage({
 *     onBehaviorMental: (payload) => {
 *       // Handle character animation
 *       console.log('Behavior:', payload.behavior.action_id);
 *     },
 *     onSession: (payload) => {
 *       // Handle chat message
 *       console.log('Message:', payload.message.content);
 *     },
 *   });
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useCAPMessage(options: UseCAPMessageOptions = {}): {
  isConnected: boolean;
} {
  ++componentId;
  const {
    onBehaviorMental,
    onSession,
    onNotification,
    onEvent,
    enabled = true,
    onError,
  } = options;

  // Use refs to maintain stable handler references
  const handlersRef = useRef({
    onBehaviorMental,
    onSession,
    onNotification,
    onEvent,
    onError,
  });

  useEffect(() => {
    handlersRef.current = {
      onBehaviorMental,
      onSession,
      onNotification,
      onEvent,
      onError,
    };
  }, [onBehaviorMental, onSession, onNotification, onEvent, onError]);

  // Set up Tauri event listener
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let unlisten: (() => void) | undefined;

    // Listen for CAP messages from Tauri backend
    listen(CAP_EVENT_NAME, (event) => {
      const rawMessage = event.payload;

      // Parse the CAP message
      const message = parseCAPMessage(rawMessage);

      if (!message) {
        // Invalid message, call error handler if provided
        console.error('[CAP] Failed to parse message:', rawMessage);
        handlersRef.current.onError?.(
          new Error('Failed to parse CAP message'),
          rawMessage
        );
        return;
      }

      // Route to appropriate handler based on message type
      const { type } = message;

      switch (type) {
        case 'behavior_mental':
          handlersRef.current.onBehaviorMental?.(
            message as AnyTypedCAPMessage & { type: 'behavior_mental' }
          );
          break;

        case 'session':
          handlersRef.current.onSession?.(
            message as AnyTypedCAPMessage & { type: 'session' }
          );
          break;

        case 'notification':
          handlersRef.current.onNotification?.(
            message as AnyTypedCAPMessage & { type: 'notification' }
          );
          break;

        case 'event':
          handlersRef.current.onEvent?.(
            message as AnyTypedCAPMessage & { type: 'event' }
          );
          break;

        default:
          // Unknown type - this should not happen due to parser validation
          handlersRef.current.onError?.(
            new Error('Unknown CAP message type: ' + type),
            rawMessage
          );
          break;
      }
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((error) => {
        console.error('Failed to set up CAP message listener:', error);
        handlersRef.current.onError?.(error, null);
      });

    // Cleanup on unmount
    return () => {
      unlisten?.();
    };
  }, [enabled]);

  return {
    isConnected: enabled,
  };
}
