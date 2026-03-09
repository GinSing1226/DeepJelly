/**
 * 角色资源加载工具
 */

import type { CharacterConfig, Appearance, ActionAnimation, AnimationDomain, AnimationCategory, AnimationActionId } from '../types';
import { buildActionDir } from '../types';
import { invoke } from '@tauri-apps/api/core';

export async function loadCharacterConfig(
  characterId: string,
  appearanceId: string
): Promise<CharacterConfig> {
  console.log('[loadCharacterConfig] Called with:', { characterId, appearanceId });
  try {
    const config = await invoke<CharacterConfig>('get_character', {
      characterId: appearanceId,
    });
    console.log('[loadCharacterConfig] Backend returned config:', config);

    if (!config) {
      console.error('[loadCharacterConfig] Backend returned null config');
      throw new Error('Character not found: ' + appearanceId);
    }

    if (!config.assistant_id) {
      config.assistant_id = characterId;
    }

    if (!config.id || config.id !== appearanceId) {
      config.id = appearanceId;
    }

    return config;
  } catch (error) {
    throw new Error('Failed to load character config for ' + appearanceId + ': ' + error);
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
  appearance: Appearance,
  domain: AnimationDomain,
  category: AnimationCategory,
  actionId: AnimationActionId
): ActionAnimation | undefined {
  const actionKey = getActionKey(domain, category, actionId);
  return appearance.actions[actionKey];
}

export function getAnimationById(
  appearance: Appearance,
  animationId: string
): ActionAnimation | undefined {
  return appearance.actions[animationId];
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

  const basePath = '/resources/characters/' + characterId + '/' + appearanceId;

  if (framePath.startsWith('./')) {
    return basePath + '/' + framePath.slice(2);
  }

  if (framePath.startsWith('/')) {
    return framePath;
  }

  return basePath + '/' + framePath;
}

export class CharacterLoader {
  private loading: boolean = false;
  private cache: Map<string, HTMLImageElement> = new Map();
  private pendingLoads: Map<string, Promise<void>> = new Map();

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
  }

  async preloadCharacterAnimations(
    config: CharacterConfig,
    appearanceId: string
  ): Promise<void> {
    const appearance = config.appearances.find((a) => a.id === appearanceId);
    if (!appearance) {
      throw new Error('Appearance not found: ' + appearanceId);
    }

    const assistantId = config.assistant_id || config.id;
    const characterId = config.id;

    const allFrames: string[] = [];

    for (const [actionKey, action] of Object.entries(appearance.actions)) {
      const frames = action.resources || action.frames;
      if (frames) {
        const resolvedFrames = await Promise.all(
          frames.map((frame) => resolveAnimationPathAsync(assistantId, characterId, frame))
        );
        allFrames.push(...resolvedFrames);
      }
    }

    await this.preloadFrames(allFrames);
  }
}

export const globalCharacterLoader = new CharacterLoader();
