/**
 * Animation Preview Modal Component
 *
 * 动画预览弹窗组件
 * 在独立弹窗中播放动画预览
 */

import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface AnimationPreviewModalProps {
  /** 动作配置 */
  action: {
    type: string;
    fps?: number;
    loop?: boolean;
    resources: string[];
  };
  /** 动作键 (e.g., "internal-base-idle") */
  actionKey: string;
  /** 资源路径前缀 */
  pathPrefix: string;
  /** 关闭回调 */
  onClose: () => void;
}

interface FramesPreviewProps {
  resources: string[];
  fps?: number;
  loop: boolean;
  pathPrefix: string;
  actionKey: string;
}

function parsePathPrefix(pathPrefix: string): { assistantId: string; characterId: string } {
  const parts = pathPrefix.split('/');
  return {
    assistantId: parts[1],
    characterId: parts[2],
  };
}

/**
 * 帧序列预览组件（带控制）
 */
function FramesPreview({ resources, fps = 8, loop, pathPrefix, actionKey }: FramesPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const intervalRef = useRef<number | null>(null);

  // Load current frame image
  useEffect(() => {
    if (resources.length === 0) return;

    const currentResource = resources[currentIndex];
    const { assistantId, characterId } = parsePathPrefix(pathPrefix);
    const resourcePath = `${actionKey}/${currentResource}`;

    setError(null);
    invoke<string>('load_character_resource', {
      assistantId,
      characterId,
      resourceName: resourcePath,
    })
      .then(setImageSrc)
      .catch((err) => {
        console.error('Failed to load resource:', err);
        setError(String(err));
      });
  }, [currentIndex, resources, pathPrefix, actionKey]);

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
 * GIF预览组件
 */
function GifPreview({
  resources,
  pathPrefix,
  actionKey,
}: {
  resources: string[];
  pathPrefix: string;
  actionKey: string;
}) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resources.length === 0) return;

    const { assistantId, characterId } = parsePathPrefix(pathPrefix);
    const resourcePath = `${actionKey}/${resources[0]}`;

    setError(null);
    invoke<string>('load_character_resource', {
      assistantId,
      characterId,
      resourceName: resourcePath,
    })
      .then(setImageSrc)
      .catch((err) => {
        console.error('Failed to load GIF resource:', err);
        setError(String(err));
      });
  }, [resources, pathPrefix, actionKey]);

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content ap-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header ap-modal-header">
          <h3>动画预览 - {actionKey}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body ap-modal-body">
          {action.type === 'frames' ? (
            <FramesPreview
              resources={action.resources}
              fps={action.fps}
              loop={action.loop || false}
              pathPrefix={pathPrefix}
              actionKey={actionKey}
            />
          ) : action.type === 'gif' ? (
            <GifPreview
              resources={action.resources}
              pathPrefix={pathPrefix}
              actionKey={actionKey}
            />
          ) : (
            <div className="ap-modal-empty">
              <div className="empty-icon">❓</div>
              <div className="empty-text">不支持的资源类型: {action.type}</div>
            </div>
          )}
        </div>

        <div className="modal-footer ap-modal-footer">
          <button className="btn-text" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
