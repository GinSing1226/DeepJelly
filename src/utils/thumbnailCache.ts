/**
 * Thumbnail Cache Utility
 *
 * 缩略图缓存工具 - 避免重复加载同一资源
 * 同一资源只加载一次，多个组件共享结果
 */

// 全局缩略图缓存
const thumbnailCache = new Map<string, string>();
// 正在进行的请求
const pendingRequests = new Map<string, Promise<string>>();

export interface ThumbnailCacheOptions {
  assistantId: string;
  characterId: string;
  resourceName: string;
  maxWidth?: number;
  maxHeight?: number;
}

/**
 * 获取缓存的缩略图或发起新请求
 */
export async function loadThumbnailWithCache(options: ThumbnailCacheOptions): Promise<string> {
  const {
    assistantId,
    characterId,
    resourceName,
    maxWidth = 300,
    maxHeight = 300,
  } = options;

  const cacheKey = `${assistantId}/${characterId}/${resourceName}/${maxWidth}x${maxHeight}`;

  // 检查缓存
  const cached = thumbnailCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // 检查是否有正在进行的请求
  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    return pending;
  }

  // 发起新请求
  const { invoke } = await import('@tauri-apps/api/core');

  const promise = invoke<string>('load_character_resource_thumbnail', {
    assistantId,
    characterId,
    resourceName,
    maxWidth,
    maxHeight,
  }).then(dataUrl => {
    // 缓存结果
    thumbnailCache.set(cacheKey, dataUrl);
    pendingRequests.delete(cacheKey);
    return dataUrl;
  }).catch(error => {
    pendingRequests.delete(cacheKey);
    throw error;
  });

  pendingRequests.set(cacheKey, promise);
  return promise;
}

/**
 * 清除缩略图缓存（资源更新时调用）
 * @param pattern 匹配模式，不传则清除所有缓存
 */
export function clearThumbnailCache(pattern?: string) {
  if (pattern) {
    for (const key of thumbnailCache.keys()) {
      if (key.includes(pattern)) {
        thumbnailCache.delete(key);
      }
    }
  } else {
    thumbnailCache.clear();
  }
}

/**
 * 获取缓存统计信息（调试用）
 */
export function getThumbnailCacheStats() {
  return {
    cacheSize: thumbnailCache.size,
    pendingRequests: pendingRequests.size,
    cachedKeys: Array.from(thumbnailCache.keys()),
  };
}
