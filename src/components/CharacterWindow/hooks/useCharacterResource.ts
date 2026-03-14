/**
 * useCharacterResource Hook
 *
 * Meta-Name: Character Resource Hook
 * Meta-Description: 管理角色资源加载的状态和逻辑
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  CharacterConfig,
  Appearance,
  ActionAnimation,
  ResourceLoadState,
} from '../types';
import {
  loadCharacterConfig,
  getAnimationByIdCompat,
  resolveAnimationPath,
  globalCharacterLoader,
} from '../utils/characterLoader';

/** Hook 返回值 */
export interface UseCharacterResourceResult {
  /** 当前角色配置 */
  config: CharacterConfig | null;
  /** 当前外观 */
  appearance: Appearance | null;
  /** 加载状态 */
  loadState: ResourceLoadState;
  /** 加载角色 */
  loadCharacter: (characterId: string, appearanceId: string, assistantId?: string) => Promise<void>;
  /** 切换外观 */
  switchAppearance: (appearanceId: string) => Promise<void>;
  /** 获取动画 */
  getAnimation: (animationId: string) => ActionAnimation | undefined;
  /** 获取动画帧的完整路径 */
  getAnimationFrames: (animationId: string) => string[];
}

/** Hook 配置 */
export interface UseCharacterResourceOptions {
  /** 默认角色ID */
  defaultCharacterId?: string;
  /** 默认外观ID */
  defaultAppearanceId?: string;
  /** 是否预加载动画 */
  preloadAnimations?: boolean;
}

/**
 * 角色资源管理 Hook
 */
export function useCharacterResource(
  options: UseCharacterResourceOptions = {}
): UseCharacterResourceResult {
  const {
    defaultCharacterId,
    defaultAppearanceId,
    preloadAnimations = true,
  } = options;

  const [config, setConfig] = useState<CharacterConfig | null>(null);
  const [appearance, setAppearance] = useState<Appearance | null>(null);
  const [loadState, setLoadState] = useState<ResourceLoadState>({
    isLoading: false,
    isLoaded: false,
    error: null,
    loadedAnimations: [],
  });

  // Debug logging when state changes
  useEffect(() => {
    // State change tracking
  }, [config, appearance, loadState]);

  // 使用 ref 追踪当前加载请求，避免竞态条件
  const loadIdRef = useRef(0);

  /**
   * 加载角色
   */
  const loadCharacter = useCallback(
    async (characterId: string, appearanceId: string, assistantId?: string) => {
      console.log('[useCharacterResource] loadCharacter CALLED with:', { characterId, appearanceId, assistantId });

      // 生成唯一加载ID
      const loadId = ++loadIdRef.current;

      setLoadState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      try {
        // 加载配置，传递 assistantId（如果提供）
        console.log('[useCharacterResource] About to call loadCharacterConfig...');
        const loadedConfig = await loadCharacterConfig(characterId, appearanceId, assistantId);
        console.log('[useCharacterResource] loadCharacterConfig returned:', {
          id: loadedConfig.id,
          assistant_id: loadedConfig.assistant_id,
          name: loadedConfig.name,
        });

        // 检查是否是最新的加载请求
        if (loadId !== loadIdRef.current) {
          console.log('[useCharacterResource] Load cancelled - newer request initiated');
          return;
        }

        // 查找外观
        const loadedAppearance =
          loadedConfig.appearances.find((a) => a.id === appearanceId) ||
          loadedConfig.appearances.find((a) => a.isDefault) ||
          loadedConfig.appearances[0];

        console.log('[useCharacterResource] Found appearance:', loadedAppearance?.id);

        if (!loadedAppearance) {
          throw new Error(`No appearance found for character: ${characterId}`);
        }

        // 预加载动画帧
        if (preloadAnimations) {
          console.log('[useCharacterResource] Preloading animations...');
          await globalCharacterLoader.preloadCharacterAnimations(
            loadedConfig,
            loadedAppearance.id
          );

          // 再次检查加载ID
          if (loadId !== loadIdRef.current) {
            console.log('[useCharacterResource] Load cancelled - newer request initiated');
            return;
          }
        }

        // 更新状态
        console.log('[useCharacterResource] Updating state with loaded character');
        setConfig(loadedConfig);
        setAppearance(loadedAppearance);
        setLoadState({
          isLoading: false,
          isLoaded: true,
          error: null,
          loadedAnimations: Object.keys(loadedAppearance.actions),
        });
      } catch (error) {
        // 检查是否是最新的加载请求
        if (loadId !== loadIdRef.current) {
          return;
        }

        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        console.error('[useCharacterResource] Failed to load character:', errorMessage, error);

        setLoadState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
      }
    },
    [preloadAnimations]
  );

  /**
   * 切换外观
   */
  const switchAppearance = useCallback(
    async (appearanceId: string) => {
      if (!config) {
        return;
      }

      const newAppearance = config.appearances.find((a) => a.id === appearanceId);

      if (!newAppearance) {
        setLoadState((prev) => ({
          ...prev,
          error: `Appearance not found: ${appearanceId}`,
        }));
        return;
      }

      // 预加载新外观的动画
      if (preloadAnimations) {
        setLoadState((prev) => ({ ...prev, isLoading: true }));

        try {
          await globalCharacterLoader.preloadCharacterAnimations(
            config,
            appearanceId
          );

          setAppearance(newAppearance);
          setLoadState({
            isLoading: false,
            isLoaded: true,
            error: null,
            loadedAnimations: Object.keys(newAppearance.actions),
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';

          setLoadState((prev) => ({
            ...prev,
            isLoading: false,
            error: errorMessage,
          }));
        }
      } else {
        setAppearance(newAppearance);
        setLoadState((prev) => ({
          ...prev,
          loadedAnimations: Object.keys(newAppearance.actions),
        }));
      }
    },
    [config, preloadAnimations]
  );

  /**
   * 获取动画配置
   */
  const getAnimation = useCallback(
    (animationId: string): ActionAnimation | undefined => {
      if (!appearance) {
        return undefined;
      }
      return getAnimationByIdCompat(appearance, animationId);
    },
    [appearance]
  );

  /**
   * 获取动画帧的完整路径
   */
  const getAnimationFrames = useCallback(
    (animationId: string): string[] => {
      const animation = getAnimation(animationId);

      if (!animation || !config || !appearance) {
        return [];
      }

      return animation.frames.map((frame) =>
        resolveAnimationPath(config.id, appearance.id, frame)
      );
    },
    [config, appearance, getAnimation]
  );

  // 初始加载
  useEffect(() => {
    if (defaultCharacterId && defaultAppearanceId) {
      loadCharacter(defaultCharacterId, defaultAppearanceId);
    }
  }, [defaultCharacterId, defaultAppearanceId, loadCharacter]);

  return {
    config,
    appearance,
    loadState,
    loadCharacter,
    switchAppearance,
    getAnimation,
    getAnimationFrames,
  };
}
