/**
 * Animation Preview Modal Component
 *
 * 动画预览弹窗组件
 * 在独立弹窗中播放动画预览
 */

import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import * as PIXI from 'pixi.js';
import type { SpriteSheetConfig } from '@/types/character';

interface AnimationPreviewModalProps {
  /** 动作配置 */
  action: {
    type: string;
    fps?: number;
    loop?: boolean;
    resources: string[];
    spritesheet?: SpriteSheetConfig;
  };
  /** 动作键 (e.g., "internal-base-idle") */
  actionKey: string;
  /** 资源路径前缀 */
  pathPrefix: string;
  /** 助手ID */
  assistantId: string;
  /** 形象ID */
  appearanceId: string;
  /** 关闭回调 */
  onClose: () => void;
}

interface FramesPreviewProps {
  resources: string[];
  fps?: number;
  loop: boolean;
  pathPrefix: string;
  assistantId: string;
  actionKey: string;
  appearanceId: string;
}

/**
 * Parse pathPrefix to get assistant_id and character_id
 * pathPrefix format: characters/{assistant_id}/{character_id}
 */
function parsePathPrefix(pathPrefix: string): { assistantId: string; characterId: string } {
  const parts = pathPrefix.split('/');
  return {
    assistantId: parts[1] || '',
    characterId: parts[2] || '',
  };
}

/**
 * 帧序列预览组件（带控制）
 */
function FramesPreview({ resources, fps = 8, loop, pathPrefix, assistantId, actionKey, appearanceId }: FramesPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const intervalRef = useRef<number | null>(null);

  // Load current frame image
  useEffect(() => {
    if (resources.length === 0) return;

    const currentResource = resources[currentIndex];
    const parsed = parsePathPrefix(pathPrefix);
    // 新的目录结构: characters/{assistant_id}/{character_id}/{appearance_id}/{action_key}/{resource}
    const resourcePath = `${appearanceId}/${actionKey}/${currentResource}`;

    // 优先使用 props 传入的 assistantId，如果为空则使用解析值
    const finalAssistantId = assistantId || parsed.assistantId;
    const finalCharacterId = parsed.characterId;

    setError(null);
    invoke<string>('load_character_resource', {
      assistantId: finalAssistantId,
      characterId: finalCharacterId,
      resourceName: resourcePath,
    })
      .then(setImageSrc)
      .catch((err) => {
        console.error('Failed to load resource:', err);
        setError(String(err));
      });
  }, [currentIndex, resources, pathPrefix, actionKey, appearanceId]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying || resources.length === 0) return;

    const interval = window.setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= resources.length) {
          return loop ? 0 : prev;
        }
        return next;
      });
    }, 1000 / fps);

    intervalRef.current = interval;

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [resources, fps, loop, isPlaying]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? resources.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1 >= resources.length ? 0 : prev + 1));
  };

  const togglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  if (resources.length === 0) {
    return (
      <div className="ap-modal-empty">
        <div className="empty-icon">🎬</div>
        <div className="empty-text">暂无资源</div>
      </div>
    );
  }

  return (
    <>
      <div className="ap-modal-viewport">
        {imageSrc ? (
          <img src={imageSrc} alt={`Frame ${currentIndex + 1}`} />
        ) : error ? (
          <div className="ap-modal-error">
            <div>加载失败</div>
            <div className="error-detail">{error}</div>
          </div>
        ) : (
          <div className="ap-modal-loading">加载中...</div>
        )}
      </div>

      <div className="ap-modal-info">
        <span>{currentIndex + 1} / {resources.length}</span>
        <span>FPS: {fps}</span>
        <span>{loop ? '🔁 循环' : '▸ 单次'}</span>
      </div>

      <div className="ap-modal-controls">
        <button className="ap-control-btn" onClick={handlePrev} title="上一帧">
          ◀
        </button>
        <button className="ap-control-btn" onClick={togglePlay} title={isPlaying ? '暂停' : '播放'}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button className="ap-control-btn" onClick={handleNext} title="下一帧">
          ▶
        </button>
      </div>
    </>
  );
}

/**
 * 精灵图预览组件
 */
function SpritesheetPreview({
  spritesheet,
  fps = 12,
  loop,
  pathPrefix,
  assistantId,
  actionKey,
  appearanceId,
  resources,
}: {
  spritesheet: SpriteSheetConfig;
  fps?: number;
  loop: boolean;
  pathPrefix: string;
  assistantId: string;
  actionKey: string;
  appearanceId: string;
  resources: string[]; // 资源文件列表，custom-grid 格式需要
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const spriteRef = useRef<PIXI.AnimatedSprite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    let app: PIXI.Application | null = null;
    let cancelled = false;

    const initPixi = async () => {
      if (cancelled) return;

      try {
        // Initialize PIXI app with proper options for v8
        app = new PIXI.Application();
        appRef.current = app;

        // Initialize the app - use smaller size to fit within viewport
        await app.init({
          width: 280,
          height: 280,
          backgroundAlpha: 1,
          backgroundColor: 0x2a2a2a, // Dark gray background to see transparent sprites
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });

        if (cancelled) return;

        // Get the canvas from the app
        if (app.canvas) {
          // Set canvas size directly
          app.canvas.style.width = '280px';
          app.canvas.style.height = '280px';
          app.canvas.style.display = 'block';
          container.appendChild(app.canvas);
        } else {
          setError('无法初始化渲染画布');
          setIsLoading(false);
          return;
        }

        // Load spritesheet image
        const parsed = parsePathPrefix(pathPrefix);

        // 优先使用 props 传入的 assistantId，如果为空则使用解析值
        const finalAssistantId = assistantId || parsed.assistantId;
        const finalCharacterId = parsed.characterId;

        // 根据格式确定资源路径
        let imageUrl: string;
        if (spritesheet.format === 'custom-grid') {
          // custom-grid 格式：从 resources[0] 获取图片路径
          if (!resources || resources.length === 0) {
            setError('custom-grid 格式需要添加精灵图图片资源');
            setIsLoading(false);
            return;
          }
          const resourcePath = `${appearanceId}/${actionKey}/${resources[0]}`;
          imageUrl = await invoke<string>('load_character_resource', {
            assistantId: finalAssistantId,
            characterId: finalCharacterId,
            resourceName: resourcePath,
          });
        } else {
          // 其他格式：从 spritesheet.url 获取 JSON 配置文件路径
          if (!spritesheet.url) {
            setError(`${spritesheet.format} 格式需要指定 JSON 配置文件路径`);
            setIsLoading(false);
            return;
          }
          const resourcePath = `${appearanceId}/${actionKey}/${spritesheet.url}`;
          imageUrl = await invoke<string>('load_character_resource', {
            assistantId: finalAssistantId,
            characterId: finalCharacterId,
            resourceName: resourcePath,
          });
        }

        if (cancelled) return;

        // Check format and provide helpful error for unsupported formats
        if (spritesheet.format === 'texture-packer' || spritesheet.format === 'pixi-json' || spritesheet.format === 'aseprite') {
          setError(`格式 "${spritesheet.format}" 需要 JSON 配置文件，但只有 PNG 图片。请使用 "自定义网格" 格式。`);
          setIsLoading(false);
          return;
        }

        // Create textures from spritesheet based on format
        let textures: PIXI.Texture[] = [];

        if (spritesheet.format === 'custom-grid' && spritesheet.grid) {
          const { frame_width, frame_height, spacing = 0, margin = 0, rows, cols } = spritesheet.grid;
          const totalFramesCount = rows * cols;
          if (!cancelled) setTotalFrames(totalFramesCount);

          // Load base texture - in PIXI v8, Assets.load returns a Texture
          const baseTexture = await PIXI.Assets.load<PIXI.Texture>(imageUrl);
          if (cancelled) return;

          // Check texture size - most GPUs support max 4096x4096
          const MAX_TEXTURE_SIZE = 4096;
          if (baseTexture.width > MAX_TEXTURE_SIZE || baseTexture.height > MAX_TEXTURE_SIZE) {
            setError(`图片尺寸过大 (${baseTexture.width}x${baseTexture.height})，超过了 GPU 最大纹理尺寸 ${MAX_TEXTURE_SIZE}x${MAX_TEXTURE_SIZE}。请使用更小的图片。`);
            setIsLoading(false);
            return;
          }

          // Get the actual render texture source
          const source = baseTexture.source || baseTexture.baseTexture?.source;
          if (!source) {
            console.error('[SpritesheetPreview] No texture source found');
            setError('无法获取纹理源');
            setIsLoading(false);
            return;
          }

          // Verify grid config matches actual image dimensions
          const expectedWidth = cols * frame_width + (cols - 1) * spacing + 2 * margin;
          const expectedHeight = rows * frame_height + (rows - 1) * spacing + 2 * margin;
          if (Math.abs(baseTexture.width - expectedWidth) > 10 || Math.abs(baseTexture.height - expectedHeight) > 10) {
            console.warn('[SpritesheetPreview] Grid config may not match image dimensions');
          }
          // Slice the grid using PIXI v8 API
          for (let frameIndex = 0; frameIndex < totalFramesCount; frameIndex++) {
            const col = frameIndex % cols;
            const row = Math.floor(frameIndex / cols);

            const x = margin + col * (frame_width + spacing);
            const y = margin + row * (frame_height + spacing);

            // Log first few frames for debugging
            if (frameIndex < 4) {
            }

            // Create a texture from a region of the base texture
            const frameTexture = new PIXI.Texture({
              source: source,
              frame: new PIXI.Rectangle(x, y, frame_width, frame_height),
            });

            textures.push(frameTexture);
          }
          // Verify first frame texture
          if (textures.length > 0) {
            // First texture available at textures[0]
          }
        }

        if (cancelled) return;

        if (textures.length === 0) {
          setError('无法解析精灵图帧');
          setIsLoading(false);
          return;
        }

        // Get the actual frame size from the first texture
        const firstFrame = textures[0];
        const frameWidth = firstFrame.orig?.width || firstFrame.width || 256;
        const frameHeight = firstFrame.orig?.height || firstFrame.height || 256;
        // Create animated sprite with autoUpdate enabled
        const animatedSprite = new PIXI.AnimatedSprite(textures, true); // true = autoUpdate
        animatedSprite.loop = loop;
        animatedSprite.anchor.set(0.5);
        // Scale to fit viewport
        const maxSize = 280;
        const scale = Math.min(maxSize / frameWidth, maxSize / frameHeight);
        animatedSprite.scale.set(scale);
        // Position in center of canvas (280x280)
        animatedSprite.x = 140;
        animatedSprite.y = 140;

        app.stage.addChild(animatedSprite);
        spriteRef.current = animatedSprite;
        // Set animation speed
        animatedSprite.animationSpeed = (fps || 12) / 60;
        // Track frame changes
        animatedSprite.onFrameChange = () => {
          if (!cancelled) {
            setCurrentFrame(animatedSprite.currentFrame);
          }
        };

        // Start playing from frame 0
        // Reset to first frame and play
        animatedSprite.gotoAndPlay(0);

        // Start the ticker to drive animation updates
        // PIXI v8: ticker must be started for AnimatedSprite to update
        app.ticker.start();
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load spritesheet:', err);
        setError(String(err));
        setIsLoading(false);
      }
    };

    initPixi();

    return () => {
      cancelled = true;
      // Clean up sprite first
      if (spriteRef.current) {
        try {
          spriteRef.current.destroy();
        } catch (e) {
          console.warn('[SpritesheetPreview] Failed to destroy sprite:', e);
        }
        spriteRef.current = null;
      }

      // Then clean up app
      if (app) {
        try {
          // Remove canvas from DOM
          if (app.canvas && app.canvas.parentNode) {
            app.canvas.parentNode.removeChild(app.canvas);
          }
          app.destroy(true, { children: true, texture: true });
        } catch (e) {
          console.warn('[SpritesheetPreview] Failed to destroy PIXI app:', e);
        }
        appRef.current = null;
      }

      // PIXI.Assets.unload is not directly available in v8, but the destroy(true) should handle it
    };
  }, [spritesheet, fps, loop, pathPrefix, actionKey, appearanceId, resources]);

  // Separate effect for handling play/pause state
  useEffect(() => {
    if (spriteRef.current) {
      if (isPlaying) {
        spriteRef.current.play();
      } else {
        spriteRef.current.stop();
      }
    }
  }, [isPlaying]);

  const togglePlay = () => {
    if (spriteRef.current) {
      if (isPlaying) {
        spriteRef.current.stop();
      } else {
        spriteRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <>
      <div className="ap-modal-viewport">
        <div ref={containerRef} style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          minHeight: '280px',
          minWidth: '280px'
        }} />
        {isLoading && (
          <div className="ap-modal-loading">加载中...</div>
        )}
        {error && (
          <div className="ap-modal-error">
            <div>加载失败</div>
            <div className="error-detail">{error}</div>
          </div>
        )}
      </div>

      <div className="ap-modal-info">
        <span>{currentFrame + 1} / {totalFrames}</span>
        <span>FPS: {fps}</span>
        <span>{loop ? '🔁 循环' : '▸ 单次'}</span>
        <span>精灵图 ({spritesheet.format})</span>
      </div>

      <div className="ap-modal-controls">
        <button className="ap-control-btn" onClick={togglePlay} title={isPlaying ? '暂停' : '播放'}>
          {isPlaying ? '⏸' : '▶'}
        </button>
      </div>
    </>
  );
}

/**
 * GIF预览组件
 */
function GifPreview({
  resources,
  pathPrefix,
  assistantId,
  actionKey,
  appearanceId,
}: {
  resources: string[];
  pathPrefix: string;
  assistantId: string;
  actionKey: string;
  appearanceId: string;
}) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resources.length === 0) return;

    const parsed = parsePathPrefix(pathPrefix);
    // 新的目录结构: characters/{assistant_id}/{character_id}/{appearance_id}/{action_key}/{resource}
    const resourcePath = `${appearanceId}/${actionKey}/${resources[0]}`;

    // 优先使用 props 传入的 assistantId，如果为空则使用解析值
    const finalAssistantId = assistantId || parsed.assistantId;
    const finalCharacterId = parsed.characterId;

    setError(null);
    invoke<string>('load_character_resource', {
      assistantId: finalAssistantId,
      characterId: finalCharacterId,
      resourceName: resourcePath,
    })
      .then(setImageSrc)
      .catch((err) => {
        console.error('Failed to load GIF resource:', err);
        setError(String(err));
      });
  }, [resources, pathPrefix, assistantId, actionKey, appearanceId]);

  if (resources.length === 0) {
    return (
      <div className="ap-modal-empty">
        <div className="empty-icon">🎬</div>
        <div className="empty-text">暂无资源</div>
      </div>
    );
  }

  return (
    <>
      <div className="ap-modal-viewport">
        {imageSrc ? (
          <img src={imageSrc} alt="GIF Preview" />
        ) : error ? (
          <div className="ap-modal-error">
            <div>加载失败</div>
            <div className="error-detail">{error}</div>
          </div>
        ) : (
          <div className="ap-modal-loading">加载中...</div>
        )}
      </div>

      <div className="ap-modal-info">
        <span>GIF 动画</span>
      </div>

      <div className="ap-modal-controls">
        <span>GIF 自动播放</span>
      </div>
    </>
  );
}

/**
 * 动画预览弹窗主组件
 */
export default function AnimationPreviewModal({
  action,
  actionKey,
  pathPrefix,
  assistantId,
  appearanceId,
  onClose,
}: AnimationPreviewModalProps) {
  // 处理 ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay">
      <div className="assistant-modal-content ap-modal-content">
        {/* Header - MAC风格 */}
        <div className="modal-header-mac">
          <div className="modal-title">动画预览 - {actionKey}</div>
          <button className="modal-close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="modal-body-mac ap-modal-body">
          {action.type === 'frames' ? (
            <FramesPreview
              resources={action.resources}
              fps={action.fps}
              loop={action.loop || false}
              pathPrefix={pathPrefix}
              assistantId={assistantId}
              actionKey={actionKey}
              appearanceId={appearanceId}
            />
          ) : action.type === 'gif' ? (
            <GifPreview
              resources={action.resources}
              pathPrefix={pathPrefix}
              assistantId={assistantId}
              actionKey={actionKey}
              appearanceId={appearanceId}
            />
          ) : action.type === 'spritesheet' && action.spritesheet ? (
            <SpritesheetPreview
              spritesheet={action.spritesheet}
              fps={action.fps}
              loop={action.loop || false}
              pathPrefix={pathPrefix}
              assistantId={assistantId}
              actionKey={actionKey}
              appearanceId={appearanceId}
              resources={action.resources}
            />
          ) : (
            <div className="ap-modal-empty">
              <div className="empty-icon">❓</div>
              <div className="empty-text">不支持的资源类型: {action.type}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer-mac">
          <button className="btn-mac btn-mac-secondary" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
