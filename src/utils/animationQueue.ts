/**
 * Animation Queue Manager
 *
 * Meta-Name: Animation Queue Manager
 * Meta-Description: Manages character animation playback with priority queue system, urgency-based interrupt handling, and fallback support.
 * Related: [3.2.6 动作表现](../../../docs/private_docs/Reqs/3.2.6.动作表现.md)
 */

import { SpriteManager } from './spriteManager';

/**
 * Animation request with modifiers
 */
export interface AnimationRequest {
  /** Animation ID to play (e.g., 'base.idle', 'emotion.happy') */
  animationId: string;
  /** Priority level: high interrupts current, normal queues, low may be skipped */
  urgency?: 'high' | 'normal' | 'low';
  /** Duration in milliseconds (undefined = loop until interrupted) */
  duration?: number;
  /** Intensity 0-1: affects animation speed/scale */
  intensity?: number;
  /** Whether this animation already used fallback */
  usedFallback?: boolean;
}

/**
 * Animation state tracking
 */
interface AnimationState {
  currentAnimation: AnimationRequest | null;
  isPlaying: boolean;
  queue: AnimationRequest[];
  startTime: number | null;
  durationTimer: ReturnType<typeof setTimeout> | null;
  isPaused: boolean;
  pausedAnimation: AnimationRequest | null;
  pausedTimeRemaining: number | null;
}

/**
 * Manages animation playback with priority queue and interrupt support
 */
export class AnimationQueue {
  private spriteManager: SpriteManager;
  private state: AnimationState;
  private readonly MAX_QUEUE_SIZE = 10;
  private readonly FALLBACK_ANIMATION = 'internal-base-idle';
  private readonly DEFAULT_INTENSITY = 0.5;

  constructor(spriteManager: SpriteManager) {
    this.spriteManager = spriteManager;
    this.state = {
      currentAnimation: null,
      isPlaying: false,
      queue: [],
      startTime: null,
      durationTimer: null,
      isPaused: false,
      pausedAnimation: null,
      pausedTimeRemaining: null,
    };
  }

  /**
   * Add animation to queue or play immediately based on urgency
   */
  enqueue(request: AnimationRequest): void {
    if (!this.spriteManager) {
      console.error('[AnimationQueue] spriteManager is null');
      return;
    }

    const animationId = this.validateAnimation(request.animationId);

    if (animationId === null) {
      return;
    }

    const validatedRequest: AnimationRequest = {
      ...request,
      animationId,
      usedFallback: animationId !== request.animationId,
      urgency: request.urgency ?? 'normal',
    };

    switch (validatedRequest.urgency) {
      case 'high':
        this.interrupt(validatedRequest);
        break;

      case 'normal':
        const currentHasNoDuration = this.state.currentAnimation?.duration === undefined;
        if (currentHasNoDuration && this.state.isPlaying) {
          this.interrupt(validatedRequest);
        } else {
          if (this.state.queue.length < this.MAX_QUEUE_SIZE) {
            this.state.queue.push(validatedRequest);
          }
        }
        break;

      case 'low':
        if (this.state.queue.length < this.MAX_QUEUE_SIZE - 2) {
          this.state.queue.push(validatedRequest);
        }
        break;
    }

    if (!this.state.isPlaying && !this.state.isPaused) {
      this.playNext();
    }
  }

  /**
   * Interrupt current animation and play new one immediately
   */
  interrupt(request: AnimationRequest): void {
    if (this.state.durationTimer) {
      clearTimeout(this.state.durationTimer);
      this.state.durationTimer = null;
    }

    this.playAnimation(request);
  }

  /**
   * Play the next animation in queue
   */
  playNext(): void {
    if (this.state.queue.length === 0) {
      this.playAnimation({
        animationId: this.FALLBACK_ANIMATION,
        urgency: 'normal',
        intensity: this.DEFAULT_INTENSITY,
      });
      return;
    }

    const next = this.state.queue.shift()!;
    this.playAnimation(next);
  }

  /**
   * Play a specific animation with modifiers
   */
  private playAnimation(request: AnimationRequest): void {
    const { animationId, duration } = request;

    this.spriteManager.play(animationId);

    this.state.currentAnimation = request;
    this.state.isPlaying = true;
    this.state.startTime = Date.now();

    if (duration && duration > 0) {
      this.state.durationTimer = setTimeout(() => {
        if (animationId === 'internal-work-speak') {
          this.state.queue = [];
          this.playAnimation({
            animationId: this.FALLBACK_ANIMATION,
            urgency: 'normal',
            intensity: this.DEFAULT_INTENSITY,
          });
        } else {
          this.playNext();
        }
      }, duration);
    }
  }

  /**
   * Validate animation exists, return fallback if not
   */
  private validateAnimation(animationId: string): string | null {
    const hasAnimation = this.spriteManager.hasAnimation(animationId);

    if (hasAnimation) {
      return animationId;
    }

    const hasFallback = this.spriteManager.hasAnimation(this.FALLBACK_ANIMATION);
    if (hasFallback) {
      return this.FALLBACK_ANIMATION;
    }

    return null;
  }

  /**
   * Get the fallback animation ID
   */
  getFallbackAnimation(): string {
    return this.FALLBACK_ANIMATION;
  }

  /**
   * Check if an animation exists in sprite manager
   */
  hasAnimation(id: string): boolean {
    return this.spriteManager.hasAnimation(id);
  }

  /**
   * Get current animation request
   */
  getCurrentAnimation(): AnimationRequest | null {
    return this.state.currentAnimation;
  }

  /**
   * Check if an animation is currently playing
   */
  isPlaying(): boolean {
    return this.state.isPlaying;
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.state.queue.length;
  }

  /**
   * Pause the animation queue (e.g., during drag operations)
   */
  pause(): void {
    if (this.state.isPaused) {
      return;
    }

    if (this.state.currentAnimation) {
      this.state.pausedAnimation = this.state.currentAnimation;

      if (this.state.durationTimer && this.state.startTime) {
        const elapsed = Date.now() - this.state.startTime;
        const duration = this.state.currentAnimation.duration ?? 0;
        this.state.pausedTimeRemaining = Math.max(0, duration - elapsed);
      }
    }

    if (this.state.durationTimer) {
      clearTimeout(this.state.durationTimer);
      this.state.durationTimer = null;
    }

    this.state.isPaused = true;
  }

  /**
   * Resume the animation queue after pause
   */
  resume(): void {
    if (!this.state.isPaused) {
      return;
    }

    this.state.isPaused = false;

    if (this.state.queue.length > 0) {
      this.state.pausedAnimation = null;
      this.state.pausedTimeRemaining = null;
      this.playNext();
    } else if (this.state.pausedAnimation) {
      const resumeRequest: AnimationRequest = {
        ...this.state.pausedAnimation,
        duration: this.state.pausedTimeRemaining ?? this.state.pausedAnimation.duration,
      };

      this.state.pausedAnimation = null;
      this.state.pausedTimeRemaining = null;

      this.playAnimation(resumeRequest);
    } else {
      this.playNext();
    }
  }

  /**
   * Check if queue is paused
   */
  isQueuePaused(): boolean {
    return this.state.isPaused;
  }

  /**
   * Clear the queue and reset to idle
   */
  clear(): void {
    if (this.state.durationTimer) {
      clearTimeout(this.state.durationTimer);
      this.state.durationTimer = null;
    }

    this.state.queue = [];
    this.state.currentAnimation = null;
    this.state.isPlaying = false;
    this.state.startTime = null;

    this.spriteManager.play(this.FALLBACK_ANIMATION);
  }

  /**
   * Destroy the queue and cleanup resources
   */
  destroy(): void {
    this.clear();
  }
}
