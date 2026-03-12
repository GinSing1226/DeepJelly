import * as PIXI from 'pixi.js';
import type { Action, SpriteSheetConfig } from '../types/character';

export interface SpriteFrame {
  texture: PIXI.Texture;
  duration: number;
}

export interface AnimationConfig {
  name: string;
  frames: SpriteFrame[];
  loop: boolean;
  // 循环起始帧索引（可选，用于部分循环）
  // 例如：60帧动画，loopStartFrame=40 表示从第40帧循环到最后一帧
  loopStartFrame?: number;
}

/**
 * 精灵动画管理器
 * 支持帧动画、精灵图动画（多种格式）和 GIF 动画
 *
 * 支持的精灵图格式：
 * - pixi-json: PIXI.js 标准 JSON 格式
 * - texture-packer: TexturePacker 导出的 JSON 数组格式
 * - aseprite: Aseprite 导出的 JSON 格式
 * - custom-grid: 自定义网格布局（通过行列和帧尺寸计算）
 */
export class SpriteManager {
  private app: PIXI.Application;
  private animations: Map<string, AnimationConfig> = new Map();
  private currentAnimation: string | null = null;
  private sprite: PIXI.AnimatedSprite | null = null;
  private container: PIXI.Container;
  private playing: boolean = false;

  constructor(app: PIXI.Application, container: PIXI.Container) {
    this.app = app;
    this.container = container;
  }

  /**
   * 获取纹理的实际尺寸
   */
  private getTextureSize(texture: PIXI.Texture): { width: number; height: number } {
    return {
      width: texture.orig.width,
      height: texture.orig.height,
    };
  }

  /**
   * 从帧图片加载动画
   *
   * 支持多种 URL 格式：
   * - Base64 data URL (data:image/png;base64,...)
   * - HTTP/HTTPS URL
   * - 相对路径 URL
   */
  async loadFrameAnimation(
    name: string,
    frameUrls: string[],
    frameRate: number = 12,
    loop: boolean = true,
    loopStartFrame?: number
  ): Promise<void> {
    const textures: PIXI.Texture[] = [];

    for (let i = 0; i < frameUrls.length; i++) {
      const url = frameUrls[i];

      if (!url) {
        continue;
      }

      if (!url.startsWith('data:')) {
        console.error(`[SpriteManager] Frame ${i}: URL is NOT a data URL:`, url.substring(0, 100));
        continue;
      }

      try {
        // Create Image element and load from data URL
        const img = new Image();
        img.src = url;

        // Wait for image to load
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = (err) => reject(err);
          // Set a timeout in case image doesn't load
          setTimeout(() => reject(new Error('Image load timeout')), 5000);
        });

        // Create texture from loaded image
        // In PIXI v8, use Texture.from() with the image element as source
        const texture = PIXI.Texture.from(img);

        textures.push(texture);
      } catch (error) {
        console.error(`[SpriteManager] Frame ${i}: Failed:`, String(error), (error as Error).message || '');
      }
    }

    if (textures.length === 0) {
      console.error(`[SpriteManager] Animation ${name} has NO valid textures, skipping registration`);
      return;
    }

    const frames: SpriteFrame[] = textures.map((texture) => ({
      texture,
      duration: 1000 / frameRate,
    }));

    this.animations.set(name, {
      name,
      frames,
      loop,
      loopStartFrame,
    });
  }

  /**
   * 从精灵表加载动画
   */
  async loadSpriteSheet(
    name: string,
    spriteSheetUrl: string,
    frameNames: string[],
    frameRate: number = 12,
    loop: boolean = true,
    loopStartFrame?: number
  ): Promise<void> {
    const sheet = await PIXI.Assets.load<PIXI.Spritesheet>(spriteSheetUrl);
    const textures: PIXI.Texture[] = [];

    for (const frameName of frameNames) {
      const texture = sheet.textures[frameName];
      if (texture) {
        textures.push(texture);
      }
    }

    const frames: SpriteFrame[] = textures.map((texture) => ({
      texture,
      duration: 1000 / frameRate,
    }));

    this.animations.set(name, {
      name,
      frames,
      loop,
      loopStartFrame,
    });
  }

  /**
   * 加载GIF动画（转换为帧）
   */
  async loadGifAnimation(
    name: string,
    gifFrames: { url: string; delay: number }[],
    loop: boolean = true,
    loopStartFrame?: number
  ): Promise<void> {
    const frames: SpriteFrame[] = [];

    for (let i = 0; i < gifFrames.length; i++) {
      const frame = gifFrames[i];

      if (!frame.url) {
        continue;
      }

      try {
        const texture = await PIXI.Assets.load<PIXI.Texture>(frame.url);
        frames.push({
          texture,
          duration: frame.delay,
        });
      } catch (error) {
        console.error(`[SpriteManager] Failed to load GIF frame ${i}:`, error);
      }
    }

    if (frames.length === 0) {
      console.warn(`[SpriteManager] GIF animation ${name} has no valid frames, skipping registration`);
      return;
    }

    this.animations.set(name, {
      name,
      frames,
      loop,
      loopStartFrame,
    });
  }

  /**
   * 从自定义网格布局的精灵图加载动画
   *
   * 通过网格配置将大图切片成多个帧
   *
   * @param name - 动画名称
   * @param imageUrl - 精灵图图片 URL
   * @param grid - 网格布局配置
   * @param frameRate - 帧率
   * @param loop - 是否循环
   * @param loopStartFrame - 循环起始帧索引
   */
  async loadCustomGridSpriteSheet(
    name: string,
    imageUrl: string,
    grid: {
      frameWidth: number;
      frameHeight: number;
      spacing?: number;
      margin?: number;
      rows: number;
      cols: number;
    },
    frameRate: number = 12,
    loop: boolean = true,
    loopStartFrame?: number
  ): Promise<void> {
    const {
      frameWidth,
      frameHeight,
      spacing = 0,
      margin = 0,
      rows,
      cols,
    } = grid;

    const textures: PIXI.Texture[] = [];
    const totalFrames = rows * cols;

    // 加载精灵图
    let baseTexture: PIXI.Texture;
    try {
      baseTexture = await PIXI.Assets.load<PIXI.Texture>(imageUrl);
    } catch (error) {
      console.error(`[SpriteManager] Failed to load spritesheet image:`, error);
      return;
    }

    // 切片网格
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      const col = frameIndex % cols;
      const row = Math.floor(frameIndex / cols);

      // 计算帧在精灵图中的位置
      const x = margin + col * (frameWidth + spacing);
      const y = margin + row * (frameHeight + spacing);

      // 创建纹理矩形
      const frameTexture = new PIXI.Texture({
        source: baseTexture.source,
        frame: new PIXI.Rectangle(x, y, frameWidth, frameHeight),
      });

      textures.push(frameTexture);
    }

    if (textures.length === 0) {
      console.error(`[SpriteManager] Custom grid spritesheet ${name} has NO valid frames, skipping registration`);
      return;
    }

    const frames: SpriteFrame[] = textures.map((texture) => ({
      texture,
      duration: 1000 / frameRate,
    }));

    this.animations.set(name, {
      name,
      frames,
      loop,
      loopStartFrame,
    });
  }

  /**
   * 从精灵图配置加载动画（支持多种格式）
   *
   * @param name - 动画名称
   * @param config - 精灵图配置
   * @param frameRate - 帧率
   * @param loop - 是否循环
   * @param loopStartFrame - 循环起始帧索引
   * @param resourcePath - 资源路径（custom-grid 格式需要，从 action.resources[0] 获取）
   */
  async loadEnhancedSpriteSheet(
    name: string,
    config: SpriteSheetConfig,
    frameRate: number = 12,
    loop: boolean = true,
    loopStartFrame?: number,
    resourcePath?: string
  ): Promise<void> {
    switch (config.format) {
      case 'pixi-json':
      case 'aseprite':
        // PIXI.js 和 Aseprite 格式：直接使用 PIXI.Assets.load
        if (!config.url) {
          console.error(`[SpriteManager] ${config.format} format requires url`);
          return;
        }
        await this.loadSpriteSheet(name, config.url, [], frameRate, loop, loopStartFrame);
        break;

      case 'texture-packer':
        // TexturePacker 格式：需要提供 frameNames
        if (!config.url) {
          console.error(`[SpriteManager] texture-packer format requires url`);
          return;
        }
        if (!config.frameNames || config.frameNames.length === 0) {
          console.error(`[SpriteManager] texture-packer format requires frameNames`);
          return;
        }
        await this.loadSpriteSheet(name, config.url, config.frameNames, frameRate, loop, loopStartFrame);
        break;

      case 'custom-grid':
        // 自定义网格格式
        if (!config.grid) {
          console.error(`[SpriteManager] custom-grid format requires grid config`);
          return;
        }
        // custom-grid 格式需要从 action.resources 获取图片路径
        if (!resourcePath) {
          console.error(`[SpriteManager] custom-grid format requires resourcePath`);
          return;
        }
        // 转换蛇形命名为驼峰命名（后端 -> 前端内部）
        const camelGrid = {
          frameWidth: config.grid.frame_width,
          frameHeight: config.grid.frame_height,
          spacing: config.grid.spacing,
          margin: config.grid.margin,
          rows: config.grid.rows,
          cols: config.grid.cols,
        };
        await this.loadCustomGridSpriteSheet(
          name,
          resourcePath,
          camelGrid,
          frameRate,
          loop,
          loopStartFrame
        );
        break;

      default:
        console.error(`[SpriteManager] Unknown spritesheet format:`, (config as SpriteSheetConfig).format);
    }
  }

  /**
   * 统一动画加载接口
   *
   * 根据 Action 类型自动选择正确的加载方式
   *
   * @param name - 动画名称
   * @param action - 动作配置
   */
  async loadFromAction(name: string, action: Action): Promise<void> {
    switch (action.type) {
      case 'frames':
        // 多帧动画
        await this.loadFrameAnimation(
          name,
          action.resources,
          action.fps ?? 12,
          action.loop
        );
        break;

      case 'spritesheet':
        // 精灵图动画
        if (!action.spritesheet) {
          console.error(`[SpriteManager] spritesheet type requires spritesheet config`);
          return;
        }
        await this.loadEnhancedSpriteSheet(
          name,
          action.spritesheet,
          action.fps ?? 12,
          action.loop,
          undefined,
          action.resources[0]  // 传递资源路径（custom-grid 格式需要）
        );
        break;

      case 'gif':
        // GIF 动画（转换帧格式）
        const gifFrames = action.resources.map((url) => ({
          url,
          delay: action.fps ? 1000 / action.fps : 1000 / 12,
        }));
        await this.loadGifAnimation(name, gifFrames, action.loop);
        break;

      case 'live2d':
      case '3d':
      case 'digital_human':
        console.warn(`[SpriteManager] Action type ${action.type} not yet supported`);
        break;

      default:
        console.error(`[SpriteManager] Unknown action type:`, action.type);
    }
  }

  /**
   * 获取第一个可用动画作为回退选项
   */
  private getFirstAnimation(): string | null {
    const keys = Array.from(this.animations.keys());
    // 优先使用 internal-base-idle，其次是 base.idle，最后是任意一个
    const fallbackPriority = ['internal-base-idle', 'base.idle'];
    for (const priority of fallbackPriority) {
      if (this.animations.has(priority)) {
        return priority;
      }
    }
    return keys.length > 0 ? keys[0] : null;
  }

  /**
   * 播放指定动画
   * 如果动画不存在，自动回退到第一个可用动画
   */
  play(name: string): void {
    let config = this.animations.get(name);

    if (!config) {
      const fallback = this.getFirstAnimation();
      if (fallback) {
        config = this.animations.get(fallback);
        if (!config) {
          console.error(`[SpriteManager] Fallback animation "${fallback}" not found`);
          return;
        }
        name = fallback;
      } else {
        console.error(`[SpriteManager] Animation "${name}" not found and no fallback available`);
        return;
      }
    }

    if (!config.frames || config.frames.length === 0) {
      console.error(`[SpriteManager] Animation ${name} has no frames, skipping playback`);
      return;
    }

    if (this.sprite) {
      this.container.removeChild(this.sprite);
      this.sprite.destroy();
    }

    const textures = config.frames.map((f) => f.texture);
    this.sprite = new PIXI.AnimatedSprite(textures);
    this.sprite.loop = config.loop;
    this.sprite.anchor.set(0.5);
    this.sprite.visible = true;
    this.sprite.alpha = 1;
    this.sprite.renderable = true;

    if (config.loop && config.loopStartFrame !== undefined && config.loopStartFrame > 0) {
      const loopStartFrame = config.loopStartFrame;
      const totalFrames = textures.length;

      this.sprite.onFrameChange = () => {
        if (this.sprite && this.sprite.currentFrame === totalFrames - 1) {
          this.sprite.gotoAndPlay(loopStartFrame);
        }
      };
    }

    const textureSize = this.getTextureSize(textures[0]);
    this.sprite.hitArea = new PIXI.Rectangle(
      -textureSize.width / 2,
      -textureSize.height / 2,
      textureSize.width,
      textureSize.height
    );

    const targetFrameRate = config.frames.length > 0 ? 1000 / config.frames[0].duration : 12;
    this.sprite.animationSpeed = targetFrameRate / 60;

    // 检查 app 是否有效
    if (!this.app || !this.app.screen) {
      console.warn('[SpriteManager] App or screen is null, skipping scale calculation');
      this.container.addChild(this.sprite);
      this.sprite.play();
      this.currentAnimation = name;
      this.playing = true;
      return;
    }

    const appWidth = this.app.screen.width;
    const appHeight = this.app.screen.height;
    const padding = 100;
    const availableWidth = appWidth - padding;
    const availableHeight = appHeight - padding;

    const scaleX = availableWidth / textureSize.width;
    const scaleY = availableHeight / textureSize.height;
    const scale = Math.min(scaleX, scaleY) * 0.8;
    this.sprite.scale.set(scale);

    this.sprite.x = 0;
    this.sprite.y = 0;
    this.container.addChild(this.sprite);
    this.sprite.play();

    this.currentAnimation = name;
    this.playing = true;
  }

  /**
   * 停止当前动画
   */
  stop(): void {
    if (this.sprite) {
      this.sprite.stop();
    }
    this.playing = false;
  }

  /**
   * 暂停/继续
   */
  toggle(): void {
    if (this.sprite) {
      if (this.playing) {
        this.sprite.stop();
      } else {
        this.sprite.play();
      }
      this.playing = !this.playing;
    }
  }

  /**
   * 获取当前动画名称
   */
  getCurrentAnimation(): string | null {
    return this.currentAnimation;
  }

  /**
   * 检查动画是否存在
   */
  hasAnimation(name: string): boolean {
    return this.animations.has(name);
  }

  /**
   * 获取所有已加载动画的名称列表
   */
  getAnimations(): string[] {
    return Array.from(this.animations.keys());
  }


  /**
   * 设置精灵位置
   */
  setPosition(x: number, y: number): void {
    if (this.sprite) {
      this.sprite.x = x;
      this.sprite.y = y;
    }
  }

  /**
   * 设置精灵缩放
   */
  setScale(scale: number): void {
    if (this.sprite) {
      this.sprite.scale.set(scale);
    }
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    if (this.sprite) {
      this.sprite.destroy();
      this.sprite = null;
    }
    this.animations.clear();
    this.currentAnimation = null;
  }
}
