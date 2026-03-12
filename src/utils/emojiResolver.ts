/**
 * Emoji Resolver
 *
 * 懒加载 emoji 解析器，将 emoji 名称解析为 Unicode 字符。
 * 使用 LRU 缓存优化性能，支持任意 emoji 名称。
 *
 * @module utils/emojiResolver
 */

// LRU 缓存（最多缓存 100 个结果）
const cache = new Map<string, string>();
const MAX_CACHE_SIZE = 100;

// 懒加载状态
let emojiLib: typeof import('node-emoji') | null = null;
let loadPromise: Promise<typeof import('node-emoji')> | null = null;

/**
 * 检测字符串是否为 Unicode emoji
 */
function isUnicodeEmoji(str: string): boolean {
  // Unicode emoji 范围检测
  const emojiRegex = /^[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+/u;
  return emojiRegex.test(str);
}

/**
 * 懒加载 node-emoji 库
 */
async function loadEmojiLib(): Promise<typeof import('node-emoji')> {
  if (emojiLib) {
    return emojiLib;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      const lib = await import('node-emoji');
      emojiLib = lib;
      return lib;
    } catch (error) {
      console.error('[emojiResolver] Failed to load node-emoji:', error);
      throw error;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

/**
 * 解析 emoji
 *
 * @param input - emoji 名称（如 "fire", "check"）或 Unicode emoji
 * @returns 解析后的 Unicode emoji，失败则返回原始输入
 *
 * @example
 * ```tsx
 * const emoji1 = await resolveEmoji("fire");   // "🔥"
 * const emoji2 = await resolveEmoji("check");  // "✅"
 * const emoji3 = await resolveEmoji("🔥");     // "🔥" (已是 Unicode)
 * ```
 */
export async function resolveEmoji(input: string): Promise<string> {
  if (!input) {
    return '';
  }

  // 1. 快速路径：已是 Unicode emoji
  if (isUnicodeEmoji(input)) {
    return input;
  }

  // 2. 检查缓存
  if (cache.has(input)) {
    return cache.get(input)!;
  }

  // 3. 懒加载 node-emoji 库
  try {
    const lib = await loadEmojiLib();

    // 4. 查询 emoji
    const results = lib.search(input);
    const result = results?.[0]?.emoji || input;

    // 5. 更新缓存
    if (cache.size >= MAX_CACHE_SIZE) {
      // LRU: 删除最旧的条目
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) {
        cache.delete(firstKey);
      }
    }
    cache.set(input, result);

    return result;
  } catch (error) {
    console.warn(`[emojiResolver] Failed to resolve emoji "${input}":`, error);
    // 降级：返回原始输入
    return input;
  }
}

/**
 * 同步版本的 resolveEmoji（仅从缓存读取）
 *
 * 如果缓存未命中，返回原始输入而不是等待异步加载。
 * 适用于无法使用 async 的场景。
 *
 * @param input - emoji 名称或 Unicode emoji
 * @returns 解析后的 Unicode emoji，或原始输入（如果缓存未命中）
 */
export function resolveEmojiSync(input: string): string {
  if (!input) {
    return '';
  }

  // 快速路径：已是 Unicode emoji
  if (isUnicodeEmoji(input)) {
    return input;
  }

  // 检查缓存
  if (cache.has(input)) {
    return cache.get(input)!;
  }

  // 缓存未命中，返回原始输入
  return input;
}

/**
 * 预热缓存（可选）
 *
 * 预加载常用的 emoji 到缓存中，避免首次显示时的延迟。
 *
 * @param emojiNames - 要预加载的 emoji 名称列表
 */
export async function warmupCache(emojiNames: string[]): Promise<void> {
  await Promise.all(emojiNames.map(name => resolveEmoji(name)));
}

/**
 * 清空缓存（用于测试或内存管理）
 */
export function clearEmojiCache(): void {
  cache.clear();
}

/**
 * 获取缓存统计信息（用于调试）
 */
export function getCacheStats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}
