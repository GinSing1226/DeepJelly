/**
 * Animation Queue React Hook
 *
 * Meta-Name: Animation Queue Hook
 * Meta-Description: React hook integrating AnimationQueue with character store for seamless animation management.
 * Related: [3.2.6 动作表现](../../../docs/private_docs/Reqs/3.2.6.动作表现.md)
 */

import { useEffect, useRef, useCallback } from 'react';
import { useCharacterStore } from '@/stores/characterStore';
import { AnimationQueue, AnimationRequest } from '@/utils/animationQueue';
import { SpriteManager } from '@/utils/spriteManager';

/**
 * Hook return value
 */
export interface UseAnimationQueueReturn {
  /** Play animation with queue system */
  playAnimation: (request: AnimationRequest) => void;
  /** Clear queue and reset to idle */
  clearQueue: () => void;
  /** Pause the animation queue (saves current state) */
  pauseQueue: () => void;
  /** Resume the animation queue (restores saved state) */
  resumeQueue: () => void;
  /** Get current animation request */
  getCurrentAnimation: () => AnimationRequest | null;
  /** Check if animation is playing */
  isPlaying: () => boolean;
  /** Check if queue is paused */
  isQueuePaused: () => boolean;
  /** Get queue size */
  getQueueSize: () => number;
}

/**
 * Options for useAnimationQueue hook
 */
export interface UseAnimationQueueOptions {
  /** SpriteManager instance (required) */
  spriteManager: SpriteManager | null;
  /** Enable/disable queue (default: true) */
  enabled?: boolean;
  /** Callback when animation changes */
  onAnimationChange?: (animationId: string) => void;
}

/**
 * React hook for managing animation queue
 *
 * @param options - Hook configuration options
 * @returns Animation queue control functions
 *
 * @example
 * ```tsx
 * function CharacterComponent() {
 *   const spriteManager = useRef<SpriteManager | null>(null);
 *   const { playAnimation } = useAnimationQueue({
 *     spriteManager: spriteManager.current,
 *     onAnimationChange: (id) => 
 *
 *   // Play high priority animation
 *   playAnimation({
 *     animationId: 'emotion.happy',
 *     urgency: 'high',
 *     intensity: 0.8,
 *     duration: 2000,
 *   });
 *
 *   return <div ref={spriteRef} />;
 * }
 * ```
 */
export function useAnimationQueue(
  options: UseAnimationQueueOptions
): UseAnimationQueueReturn {
  const { spriteManager, enabled = true, onAnimationChange } = options;

  // Store refs for stable references
  const queueRef = useRef<AnimationQueue | null>(null);
  const onAnimationChangeRef = useRef(onAnimationChange);

  // Update callback ref when it changes
  useEffect(() => {
    onAnimationChangeRef.current = onAnimationChange;
  }, [onAnimationChange]);

  // Initialize queue when spriteManager is available
  useEffect(() => {
    if (!enabled || !spriteManager) {
      if (queueRef.current) {
        queueRef.current.destroy();
        queueRef.current = null;
      }
      return;
    }

    queueRef.current = new AnimationQueue(spriteManager);

    // Cleanup on unmount
    return () => {
      if (queueRef.current) {
        queueRef.current.destroy();
        queueRef.current = null;
      }
    };
  }, [spriteManager, enabled]);

  /**
   * Play animation with queue system
   */
  const playAnimation = useCallback((request: AnimationRequest) => {
    if (!queueRef.current) {
      console.warn('[useAnimationQueue] Queue not initialized, ignoring animation request');
      return;
    }

    // Add to queue
    queueRef.current.enqueue(request);

    // Update character store with current animation
    const currentAnimation = queueRef.current.getCurrentAnimation();
    if (currentAnimation) {
      useCharacterStore.getState().setAnimation(currentAnimation.animationId);

      // Call change callback
      onAnimationChangeRef.current?.(currentAnimation.animationId);
    }
  }, []);

  /**
   * Clear queue and reset to idle
   */
  const clearQueue = useCallback(() => {
    if (!queueRef.current) {
      return;
    }

    queueRef.current.clear();

    // Update character store
    useCharacterStore.getState().setAnimation('base.idle');

    // Call change callback
    onAnimationChangeRef.current?.('base.idle');
  }, []);

  /**
   * Pause the animation queue
   */
  const pauseQueue = useCallback(() => {
    if (!queueRef.current) {
      return;
    }

    queueRef.current.pause();
  }, []);

  /**
   * Resume the animation queue
   */
  const resumeQueue = useCallback(() => {
    if (!queueRef.current) {
      return;
    }

    queueRef.current.resume();
  }, []);

  /**
   * Get current animation request
   */
  const getCurrentAnimation = useCallback(() => {
    return queueRef.current?.getCurrentAnimation() ?? null;
  }, []);

  /**
   * Check if animation is playing
   */
  const isPlaying = useCallback(() => {
    return queueRef.current?.isPlaying() ?? false;
  }, []);

  /**
   * Check if queue is paused
   */
  const isQueuePaused = useCallback(() => {
    return queueRef.current?.isQueuePaused() ?? false;
  }, []);

  /**
   * Get queue size
   */
  const getQueueSize = useCallback(() => {
    return queueRef.current?.getQueueSize() ?? 0;
  }, []);

  return {
    playAnimation,
    clearQueue,
    pauseQueue,
    resumeQueue,
    getCurrentAnimation,
    isPlaying,
    isQueuePaused,
    getQueueSize,
  };
}

/**
 * Convenience hook that converts CAP behavior to animation request
 * Integrates with behavior_mental message handler
 */
export function useBehaviorAnimation(options: UseAnimationQueueOptions) {
  const { playAnimation, ...rest } = useAnimationQueue(options);

  /**
   * Convert behavior_mental payload to animation request
   */
  const playBehaviorAnimation = useCallback((behavior: {
    domain: string;
    category: string;
    action_id: string;
    urgency: number; // 1-10
    intensity: number; // 0.0-1.0
    duration_ms: number | null;
  }) => {
    // Map urgency 1-10 to priority levels
    let urgency: 'high' | 'normal' | 'low';
    if (behavior.urgency >= 8) {
      urgency = 'high';
    } else if (behavior.urgency >= 5) {
      urgency = 'normal';
    } else {
      urgency = 'low';
    }

    // Build animation resource key: {domain}-{category}-{action_id}
    // Example: internal-base-execute
    const animationId = `${behavior.domain}-${behavior.category}-${behavior.action_id}`;

    // Create animation request
    // Note: duration should come from agent-side, no client-side defaults
    const request: AnimationRequest = {
      animationId,
      urgency,
      intensity: behavior.intensity,
      duration: behavior.duration_ms ?? undefined,
    };

    playAnimation(request);
  }, [playAnimation, options.spriteManager]);

  return {
    playBehaviorAnimation,
    playAnimation,
    ...rest,
  };
}
