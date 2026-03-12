/**
 * 角色资源加载工具
 */

import type {
  CharacterConfig,
  AnimationDomain,
  AnimationCategory,
  AnimationActionId,
  ActionAnimation,
  Appearance as ComponentAppearance,
} from '../types';
import type { Action } from '../../../types/character';
import type { Appearance as CoreAppearance } from '../../../types/character';
import { buildActionDir } from '../types';
import { invoke } from '@tauri-apps/api/core';

/**
 * Convert Action (core model) to ActionAnimation (component model)
 * This provides compatibility between the two type systems
 */
export function actionToActionAnimation(action: Action): ActionAnimation {
  return {
    frames: action.resources,
    frameRate: action.fps || 24,
    loop: action.loop,
    type: action.type === 'frames' || action.type === 'gif' ? action.type : 'frames',
    resources: action.resources,
    fps: action.fps,
  };
}

export async function loadCharacterConfig(
  characterId: string,
  _appearanceId: string,
  assistantId?: string
): Promise<CharacterConfig> {
  try {
    const config = await invoke<CharacterConfig>('get_character', {
      characterId,
    });

    // 检查 config 是否为 null
    if (!config) {
        console.error('[loadCharacterConfig] Backend returned null for characterId:', characterId);
        throw new Error('Character not found: ' + characterId);
    }


    if (!config) {
      console.error('[loadCharacterConfig] Backend returned null config for characterId:', characterId);
      throw new Error('Character not found: ' + characterId);
    }

    // CRITICAL: Use the provided assistantId if available, otherwise use config.assistant_id
    // This ensures the correct assistant_id is used for resource loading
    if (assistantId && !config.assistant_id) {
      config.assistant_id = assistantId;
    } else if (!config.assistant_id) {
      // Last resort: use characterId as assistant_id (fallback)
      config.assistant_id = characterId;
      console.warn('[loadCharacterConfig] Set assistant_id to characterId (fallback):', characterId);
    } else {
    }

    // CRITICAL: config.id should be characterId according to CAP protocol
    // The receiver.id in CAP messages is characterId, not appearanceId
    if (!config.id || config.id !== characterId) {
      config.id = characterId;
    }

    return config;
  } catch (error) {
    throw new Error('Failed to load character config for ' + characterId + ': ' + error);
  }
}

export async function getResourceUrl(
  assistantId: string,
  characterId: string,
  resourceName: string
): Promise<string> {
  try {
    // 使用 load_character_resource 获取 base64 data URL
    // 避免 asset.localhost 协议在 Tauri v2 中的连接问题
    const dataUrl = await invoke<string>('load_character_resource', {
      assistantId,
      characterId,
      resourceName,
    });

    return dataUrl;
  } catch (error) {
    console.error('Failed to get resource URL:', error);
    throw error;
  }
}

export function getActionKey(
  domain: AnimationDomain,
  category: AnimationCategory,
  actionId: AnimationActionId
): string {
  return buildActionDir(domain, category, actionId);
}

export function getAnimation(
  appearance: CoreAppearance,
  domain: AnimationDomain,
  category: AnimationCategory,
  actionId: AnimationActionId
): Action | undefined {
  const actionKey = getActionKey(domain, category, actionId);
  return appearance.actions[actionKey];
}

export function getAnimationById(
  appearance: CoreAppearance,
  animationId: string
): Action | undefined {
  return appearance.actions[animationId];
}

/**
 * Component-compatible version of getAnimationById
 * Returns ActionAnimation type for backward compatibility
 */
export function getAnimationByIdCompat(
  appearance: ComponentAppearance,
  animationId: string
): ActionAnimation | undefined {
  const result = appearance.actions[animationId];
  // Filter to only return ActionAnimation, not AnimationResource
  if (result && 'frames' in result) {
    return result as ActionAnimation;
  }
  return undefined;
}

export async function resolveAnimationPathAsync(
  assistantId: string,
  characterId: string,
  framePath: string
): Promise<string> {
  if (framePath.startsWith('http://') || framePath.startsWith('https://')) {
    return framePath;
  }

  return getResourceUrl(assistantId, characterId, framePath);
}

export function resolveAnimationPath(
  characterId: string,
  appearanceId: string,
  framePath: string
): string {
  if (framePath.startsWith('http://') || framePath.startsWith('https://')) {
    return framePath;
  }

  // 注意: 此同步函数已弃用，请使用 resolveAnimationPathAsync
  // 新的目录结构: characters/{assistantId}/{characterId}/{appearanceId}/{action_key}/{frame}
  // 但 framePath 已经包含了 appearanceId/actionKey/frame (来自后端返回)
  // 所以这里只需要处理特殊情况
  if (framePath.startsWith('./')) {
    const basePath = '/resources/characters/' + characterId + '/' + appearanceId;
    return basePath + '/' + framePath.slice(2);
  }

  if (framePath.startsWith('/')) {
    return framePath;
  }

  // 完整路径: /resources/characters/{assistantId}/{characterId}/{appearanceId}/{action_key}/{frame}
  // 注意: 此函数缺少 assistantId 参数，建议使用 resolveAnimationPathAsync
  const basePath = '/resources/characters/' + characterId;
  return basePath + '/' + framePath;
}

export class CharacterLoader {
  private loading: boolean = false;
  private cache: Map<string, HTMLImageElement> = new Map();
  private pendingLoads: Map<string, Promise<void>> = new Map();

  // LRU cache for character resources
  private characterCache: Map<string, {
    images: HTMLImageElement[];
    lastAccessTime: number;
    accessCount: number;
  }> = new Map();
  private maxCharacterCacheSize: number = 3;
  private currentCharacterKey: string | null = null;

  /**
   * Generate cache key for a character
   */
  private getCharacterKey(assistantId: string, characterId: string, appearanceId: string): string {
    return `${assistantId}/${characterId}/${appearanceId}`;
  }

  /**
   * Evict least recently used character from cache
   */
  private evictLRU(): void {
    if (this.characterCache.size <= this.maxCharacterCacheSize) {
      return;
    }

    // Find LRU entry (oldest lastAccessTime)
    let lruKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, data] of this.characterCache.entries()) {
      // Don't evict the current character
      if (key === this.currentCharacterKey) {
        continue;
      }
      if (data.lastAccessTime < oldestTime) {
        oldestTime = data.lastAccessTime;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.characterCache.delete(lruKey);
    }
  }

  /**
   * Get or load character resources with LRU caching
   */
  async getCharacterResources(
    config: CharacterConfig,
    appearanceId: string
  ): Promise<HTMLImageElement[]> {
    const assistantId = config.assistant_id || config.id;
    const characterId = config.id;
    const key = this.getCharacterKey(assistantId, characterId, appearanceId);



    this.currentCharacterKey = key;

    // Check cache
    const cached = this.characterCache.get(key);
    if (cached) {
      cached.lastAccessTime = Date.now();
      cached.accessCount++;
      return cached.images;
    }


    // Load resources
    const appearance = config.appearances.find((a) => a.id === appearanceId);
    if (!appearance) {
      throw new Error('Appearance not found: ' + appearanceId);
    }

    const allFrames: string[] = [];
    for (const [actionKey, action] of Object.entries(appearance.actions)) {
      if (action.resources) {
        // 新的目录结构需要包含 appearanceId 和 actionKey
        // frame 原本是 "0001.png"，需要变成 "appearanceId/actionKey/0001.png"
        const fullFramePaths = action.resources.map((frame) => `${appearanceId}/${actionKey}/${frame}`);
        const resolvedFrames = await Promise.all(
          fullFramePaths.map((frame) => resolveAnimationPathAsync(assistantId, characterId, frame))
        );
        allFrames.push(...resolvedFrames);
      }
    }

    // Load images
    const images = await Promise.all(
      allFrames.map((path) => this.loadImageWithElement(path))
    );

    // Add to cache
    this.characterCache.set(key, {
      images,
      lastAccessTime: Date.now(),
      accessCount: 1,
    });

    // Evict if needed
    this.evictLRU();


    return images;
  }

  /**
   * Load image and return the element
   */
  private loadImageWithElement(path: string): Promise<HTMLImageElement> {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();

      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image: ' + path));

      img.src = path;
    });
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    entries: Array<{ key: string; accessCount: number; lastAccessTime: number }>;
  } {
    return {
      size: this.characterCache.size,
      maxSize: this.maxCharacterCacheSize,
      entries: Array.from(this.characterCache.entries()).map(([key, data]) => ({
        key,
        accessCount: data.accessCount,
        lastAccessTime: data.lastAccessTime,
      })),
    };
  }

  async preloadFrames(paths: string[]): Promise<void> {
    this.loading = true;

    try {
      const loadPromises = paths.map((path) => this.loadImage(path));
      await Promise.all(loadPromises);
    } finally {
      this.loading = false;
    }
  }

  private loadImage(path: string): Promise<void> {
    if (this.cache.has(path)) {
      return Promise.resolve();
    }

    const pending = this.pendingLoads.get(path);
    if (pending) {
      return pending;
    }

    const loadPromise = new Promise<void>((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        this.cache.set(path, img);
        this.pendingLoads.delete(path);
        resolve();
      };

      img.onerror = () => {
        this.pendingLoads.delete(path);
        reject(new Error('Failed to load image: ' + path));
      };

      img.src = path;
    });

    this.pendingLoads.set(path, loadPromise);
    return loadPromise;
  }

  getCachedImage(path: string): HTMLImageElement | undefined {
    return this.cache.get(path);
  }

  isLoading(): boolean {
    return this.loading;
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  clearCache(): void {
    this.cache.clear();
    this.pendingLoads.clear();
    this.characterCache.clear();
  }

  /**
   * Clear cache for a specific character (all variations)
   * This is useful when character resources are updated
   */
  clearCharacterCache(characterId: string): void {
    const keysToDelete: string[] = [];
    for (const [key] of this.characterCache.entries()) {
      // Key format: {assistantId}/{characterId}/{appearanceId}
      // We want to clear all entries for this characterId regardless of assistantId or appearanceId
      const parts = key.split('/');
      if (parts.length >= 2 && parts[1] === characterId) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.characterCache.delete(key);
    }
  }

  async preloadCharacterAnimations(
    config: CharacterConfig,
    appearanceId: string
  ): Promise<void> {
    // Use LRU cache for character resources
    await this.getCharacterResources(config, appearanceId);
  }
}

export const globalCharacterLoader = new CharacterLoader();
