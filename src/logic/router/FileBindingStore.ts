/**
 * FileBindingStore - 基于文件的绑定存储实现
 *
 * Meta-Name: File Binding Store
 * Meta-Description: 从文件加载角色绑定数据的存储实现
 *
 * 注意：此文件单独存放以避免测试时的 Tauri 导入问题
 */

import type { BindingStore, CharacterBinding } from './MessageRouter';

/**
 * 基于文件的绑定存储实现
 */
export class FileBindingStore implements BindingStore {
  private bindings: CharacterBinding[] = [];
  private lastLoadTime = 0;
  private readonly CACHE_TTL = 5000; // 5秒缓存

  constructor(private filePath: string) {
    this.loadBindings();
  }

  /**
   * 加载绑定数据
   */
  private async loadBindings(): Promise<void> {
    try {
      // 使用 fetch 读取文件（在 Tauri 中可以访问 assets 目录）
      const response = await fetch(this.filePath);
      if (!response.ok) {
        throw new Error(`Failed to load file: ${response.status}`);
      }
      const content = await response.text();
      const data = JSON.parse(content);
      this.bindings = data.bindings || [];
      this.lastLoadTime = Date.now();
    } catch (error) {
      console.error('[FileBindingStore] Failed to load bindings:', error);
      this.bindings = [];
    }
  }

  /**
   * 检查是否需要刷新缓存
   */
  private checkRefresh(): void {
    if (Date.now() - this.lastLoadTime > this.CACHE_TTL) {
      this.loadBindings();
    }
  }

  getBindings(): CharacterBinding[] {
    this.checkRefresh();
    return this.bindings;
  }

  getBindingByCharacterId(characterId: string): CharacterBinding | undefined {
    this.checkRefresh();
    return this.bindings.find((b) => b.characterId === characterId);
  }

  getBindingsByApplicationId(appId: string): CharacterBinding[] {
    this.checkRefresh();
    return this.bindings.filter(
      (b) => b.integration.applicationId === appId
    );
  }
}
