/**
 * Animation Queue Manager
 *
 * Meta-Name: Animation Queue Manager
 * Meta-Description: Manages character animation playback with priority queue system, urgency-based interrupt handling, and fallback support.
 * Related: [3.2.6 动作表现](../../../docs/private_docs/Reqs/3.2.6.动作表现.md)
 */

import { SpriteManager } from './spriteManager';

/** 全局动画播放序列号计数器 */
let animationPlaySeqNo = 0;

/** 获取下一个动画播放序列号 */
function getNextAnimationSeqNo(): number {
  return ++animationPlaySeqNo;
}

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
  private readonly MAX_QUEUE_SIZE = 10; // 增加队列大小到10
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
    console.log('[AnimationQueue] ================================');
    console.log('[AnimationQueue] enqueue called');
    console.log('[AnimationQueue] - request:', JSON.stringify(request, null, 2));
    console.log('[AnimationQueue] - spriteManager exists:', !!this.spriteManager);
    console.log('[AnimationQueue] - isPlaying:', this.state.isPlaying);
    console.log('[AnimationQueue] - queue size:', this.state.queue.length);

    // Check spriteManager
    if (!this.spriteManager) {
      console.error('[AnimationQueue] [X] spriteManager is null! Cannot play animation.');
      return;
    }

    // List available animations
    const animations = this.spriteManager.getAnimations();
    console.log('[AnimationQueue] - available animations:', animations);

    // Validate animation exists, use fallback if not
    const animationId = this.validateAnimation(request.animationId);
    console.log('[AnimationQueue] - validated animationId:', animationId, '(original:', request.animationId + ')');

    // If animationId is null (neither animation nor fallback exists), skip this animation
    if (animationId === null) {
      console.warn('[AnimationQueue] [!] Skipping animation - no valid animation or fallback available');
      return;
    }

    const validatedRequest: AnimationRequest = {
      ...request,
      animationId,
      usedFallback: animationId !== request.animationId,
      // Default to normal priority if not specified
      urgency: request.urgency ?? 'normal',
    };

    const queueTag = `[QUEUE:${this.state.queue.length}/${this.MAX_QUEUE_SIZE}]`;
    const priority = validatedRequest.urgency ? validatedRequest.urgency.toUpperCase() : 'NORMAL';
    console.log('[AnimationQueue]', queueTag, priority, request.animationId);

    switch (validatedRequest.urgency) {
      case 'high':
        console.log('[AnimationQueue]', queueTag, 'HIGH priority → interrupting current');
        // High priority: interrupt current animation immediately
        this.interrupt(validatedRequest);
        break;

      case 'normal':
        // Check if current animation has no duration (should be interrupted immediately)
        const currentHasNoDuration = this.state.currentAnimation?.duration === undefined;
        if (currentHasNoDuration && this.state.isPlaying) {
          console.log('[AnimationQueue]', queueTag, 'NORMAL priority but current has no duration → interrupting');
          this.interrupt(validatedRequest);
        } else {
          // Normal priority: add to end of queue
          if (this.state.queue.length < this.MAX_QUEUE_SIZE) {
            this.state.queue.push(validatedRequest);
            console.log('[AnimationQueue]', queueTag, `[+] Queued: ${validatedRequest.animationId}`);
          } else {
            console.warn('[AnimationQueue]', queueTag, `[X] FULL - skipped: ${validatedRequest.animationId}`);
          }
        }
        break;

      case 'low':
        // Low priority: add to queue but skip if near capacity
        if (this.state.queue.length < this.MAX_QUEUE_SIZE - 2) {
          this.state.queue.push(validatedRequest);
          console.log('[AnimationQueue]', queueTag, `[+] Low priority queued: ${validatedRequest.animationId}`);
        } else {
          console.warn('[AnimationQueue]', queueTag, `[X] Near capacity - skipped low priority: ${validatedRequest.animationId}`);
        }
        break;
    }

    // If nothing is playing and not paused, start next animation
    if (!this.state.isPlaying && !this.state.isPaused) {
      console.log('[AnimationQueue]', queueTag, 'Nothing playing, calling playNext()');
      this.playNext();
    } else if (this.state.isPaused) {
      console.log('[AnimationQueue]', queueTag, 'Queue paused, animation queued');
    }
    console.log('[AnimationQueue]', queueTag, 'Already playing, waiting...');
  }

  /**
   * Interrupt current animation and play new one immediately
   */
  interrupt(request: AnimationRequest): void {
    console.log(`[AnimationQueue] Interrupting with high priority animation: ${request.animationId}`);

    // Clear current animation timer
    if (this.state.durationTimer) {
      clearTimeout(this.state.durationTimer);
      this.state.durationTimer = null;
    }

    // Don't put interrupted animation back in queue - it's replaced
    // Play the interrupting animation immediately
    this.playAnimation(request);
  }

  /**
   * Play the next animation in queue
   */
  playNext(): void {
    if (this.state.queue.length === 0) {
      // No more animations, play fallback idle
      console.log('[AnimationQueue] Queue empty, playing fallback idle animation');
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
    const { animationId, intensity, duration } = request;
    const seqNo = getNextAnimationSeqNo();
    const animTag = `[ANIM#${String(seqNo).padStart(3, '0')}:${animationId}]`;

    console.log('[AnimationQueue]', animTag, '>>>>> PLAYING');
    console.log('[AnimationQueue] - intensity:', intensity);
    console.log('[AnimationQueue] - duration:', duration || 'looping');
    console.log('[AnimationQueue] - spriteManager exists:', !!this.spriteManager);

    // Apply intensity modifiers to sprite
    // DISABLED: 不需要变形效果
    // this.applyIntensity(intensity ?? this.DEFAULT_INTENSITY);

    // Play the animation
    this.spriteManager.play(animationId);
    console.log('[AnimationQueue]', animTag, '✅ spriteManager.play() completed');

    // Update state
    this.state.currentAnimation = request;
    this.state.isPlaying = true;
    this.state.startTime = Date.now();

    // Set duration timer if specified
    if (duration && duration > 0) {
      console.log('[AnimationQueue]', animTag, '⏱️ Setting timer:', duration, 'ms');
      this.state.durationTimer = setTimeout(() => {
        console.log('[AnimationQueue]', animTag, '⏱️ Timer ended');

        // Special handling for speak animation: play idle and clear queue
        if (animationId === 'internal-work-speak') {
          console.log('[AnimationQueue]', animTag, '🎤 Speak completed, playing idle and clearing queue');
          // Clear all other animations from queue
          this.state.queue = [];
          // Play idle animation
          this.playAnimation({
            animationId: this.FALLBACK_ANIMATION,
            urgency: 'normal',
            intensity: this.DEFAULT_INTENSITY,
          });
        } else {
          console.log('[AnimationQueue]', animTag, '⏱️ Calling playNext()');
          this.playNext();
        }
      }, duration);
    } else {
      // Loop indefinitely, will be interrupted by next animation
      console.log('[AnimationQueue]', animTag, '🔁 Looping indefinitely');
    }
  }

  /**
   * Apply intensity modifier to sprite
   * @param intensity 0-1 value affecting scale (0.5-1.5x)
   */
  private applyIntensity(intensity: number): void {
    // Clamp intensity to valid range
    const clampedIntensity = Math.max(0, Math.min(1, intensity));

    // Map intensity to scale: 0 -> 0.5x, 0.5 -> 1.0x, 1.0 -> 1.5x
    const scale = 0.5 + clampedIntensity;

    // Apply to sprite
    this.spriteManager.setScale(scale);
  }

  /**
   * Validate animation exists, return fallback if not
   * If fallback also doesn't exist, skip this animation
   */
  private validateAnimation(animationId: string): string | null {
    console.log('[AnimationQueue] validateAnimation:', animationId);
    const hasAnimation = this.spriteManager.hasAnimation(animationId);
    console.log('[AnimationQueue] - hasAnimation:', hasAnimation);

    if (hasAnimation) {
      console.log('[AnimationQueue] - ✅ Animation exists, using:', animationId);
      return animationId;
    }

    // Try fallback animation
    const hasFallback = this.spriteManager.hasAnimation(this.FALLBACK_ANIMATION);
    if (hasFallback) {
      console.warn(`[AnimationQueue] - [X] Animation not found: ${animationId}, using fallback: ${this.FALLBACK_ANIMATION}`);
      return this.FALLBACK_ANIMATION;
    }

    // Neither requested animation nor fallback exists - skip this animation
    console.error(`[AnimationQueue] - [X] Animation "${animationId}" not found and fallback "${this.FALLBACK_ANIMATION}" also missing - SKIPPING`);
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
   * Saves current state for later resume
   */
  pause(): void {
    if (this.state.isPaused) {
      console.log('[AnimationQueue] Already paused, ignoring');
      return;
    }

    console.log('[AnimationQueue] ================================');
    console.log('[AnimationQueue] Pausing animation queue');
    console.log('[AnimationQueue] - currentAnimation:', this.state.currentAnimation?.animationId);
    console.log('[AnimationQueue] - queue size:', this.state.queue.length);

    // Save current animation if playing
    if (this.state.currentAnimation) {
      this.state.pausedAnimation = this.state.currentAnimation;

      // Calculate remaining time if duration was set
      if (this.state.durationTimer && this.state.startTime) {
        const elapsed = Date.now() - this.state.startTime;
        const duration = this.state.currentAnimation.duration ?? 0;
        this.state.pausedTimeRemaining = Math.max(0, duration - elapsed);
        console.log('[AnimationQueue] - pausedTimeRemaining:', this.state.pausedTimeRemaining, 'ms');
      }
    }

    // Clear timer
    if (this.state.durationTimer) {
      clearTimeout(this.state.durationTimer);
      this.state.durationTimer = null;
    }

    // Mark as paused
    this.state.isPaused = true;
    console.log('[AnimationQueue] ================================');
  }

  /**
   * Resume the animation queue after pause
   * Plays the animation at the front of the queue, or restores paused animation if queue is empty
   */
  resume(): void {
    if (!this.state.isPaused) {
      console.log('[AnimationQueue] Not paused, ignoring resume');
      return;
    }

    console.log('[AnimationQueue] ================================');
    console.log('[AnimationQueue] Resuming animation queue');
    console.log('[AnimationQueue] - pausedAnimation:', this.state.pausedAnimation?.animationId);
    console.log('[AnimationQueue] - queue size:', this.state.queue.length);

    // Mark as not paused
    this.state.isPaused = false;

    // Priority 1: Play next animation in queue if queue has content
    if (this.state.queue.length > 0) {
      console.log('[AnimationQueue] - Queue has', this.state.queue.length, 'animations, playing next');

      // Discard the paused animation (it was interrupted by new animations)
      this.state.pausedAnimation = null;
      this.state.pausedTimeRemaining = null;

      // Play the first animation in the queue
      this.playNext();
    }
    // Priority 2: Restore paused animation if queue is empty
    else if (this.state.pausedAnimation) {
      const resumeRequest: AnimationRequest = {
        ...this.state.pausedAnimation,
        duration: this.state.pausedTimeRemaining ?? this.state.pausedAnimation.duration,
      };

      console.log('[AnimationQueue] - Queue empty, resuming paused animation:', resumeRequest.animationId);
      console.log('[AnimationQueue] - Remaining duration:', resumeRequest.duration);

      // Clear saved state
      this.state.pausedAnimation = null;
      this.state.pausedTimeRemaining = null;

      // Play the resumed animation
      this.playAnimation(resumeRequest);
    } else {
      // No animation was playing and queue is empty, play idle
      console.log('[AnimationQueue] - No paused animation and queue empty, playing idle');
      this.playNext();
    }

    console.log('[AnimationQueue] ================================');
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
    // Clear timer
    if (this.state.durationTimer) {
      clearTimeout(this.state.durationTimer);
      this.state.durationTimer = null;
    }

    // Clear queue
    this.state.queue = [];

    // Reset state
    this.state.currentAnimation = null;
    this.state.isPlaying = false;
    this.state.startTime = null;

    // Play idle animation
    this.spriteManager.play(this.FALLBACK_ANIMATION);
    // DISABLED: 不需要重置 scale
    // this.spriteManager.setScale(1.0);
  }

  /**
   * Destroy the queue and cleanup resources
   */
  destroy(): void {
    this.clear();
  }
}
