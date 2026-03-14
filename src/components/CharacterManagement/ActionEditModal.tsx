/**
 * Action Edit Modal Component
 *
 * 动作编辑弹窗组件
 * 参考角色弹窗样式，简洁清晰
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { useCharacterManagementStore } from '@/stores/characterManagementStore';
import { usePenetrationMode } from '@/hooks/usePenetrationMode';
import type { SpriteSheetConfig, SpriteSheetFormat } from '@/types/character';

interface ActionEditModalProps {
  /** 是否显示弹窗 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 确认回调 */
  onConfirm: () => void;
  /** 助手ID */
  assistantId: string;
  /** 角色ID */
  characterId: string;
  /** 形象ID */
  appearanceId: string;
  /** 动作数据 */
  action: {
    type: string;
    fps?: number;
    loop?: boolean;
    resources: string[];
    spritesheet?: SpriteSheetConfig;
  };
  /** 动作键 */
  actionKey: string;
}

type ResourceType = 'frames' | 'spritesheet' | 'gif';

/** 资源类型选项定义 */
const RESOURCE_TYPES: Array<{ value: ResourceType; label: string; description: string }> = [
  { value: 'frames', label: '多帧图片', description: '多个独立图片文件按顺序播放' },
  { value: 'spritesheet', label: '精灵图', description: '单张图片按网格切片成多帧' },
  { value: 'gif', label: 'GIF 动画', description: '单个 GIF 动画文件' },
];

/** 参数预设定义 */
const PRESETS = [
  { label: '流畅 (24fps)', fps: 24, desc: '适合大多数动画' },
  { label: '快速 (30fps)', fps: 30, desc: '快速反应动画' },
  { label: '慢速 (12fps)', fps: 12, desc: '缓慢待机动画' },
];

/**
 * 动作编辑弹窗主组件
 */
export default function ActionEditModal({
  isOpen,
  onClose,
  onConfirm,
  assistantId,
  characterId,
  appearanceId,
  action,
  actionKey,
}: ActionEditModalProps) {
  const { t: _t } = useTranslation('settings');
  const loadCharacters = useCharacterManagementStore(state => state.loadCharacters);
  const { restoreSolidMode } = usePenetrationMode();

  // 表单状态
  const [resourceType, setResourceType] = useState<ResourceType>('frames');
  const [fps, setFps] = useState<string>('24');
  const [loop, setLoop] = useState<boolean>(true);

  // 精灵图参数
  const [spritesheetFormat, setSpritesheetFormat] = useState<SpriteSheetFormat>('custom-grid');
  const [frameWidth, setFrameWidth] = useState<string>('128');
  const [frameHeight, setFrameHeight] = useState<string>('128');
  const [rows, setRows] = useState<string>('4');
  const [cols, setCols] = useState<string>('4');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string>('');

  // 初始化表单数据
  useEffect(() => {
    if (isOpen && action) {
      // 弹窗打开时，禁用穿透模式以确保输入框可以正常工作
      restoreSolidMode();

      const type = action.type as ResourceType;
      setResourceType(['frames', 'spritesheet', 'gif'].includes(type) ? type : 'frames');
      setFps(action.fps?.toString() || '24');
      setLoop(action.loop ?? true);

      if (action.type === 'spritesheet' && action.spritesheet) {
        setSpritesheetFormat(action.spritesheet.format);
        if (action.spritesheet.format === 'custom-grid' && action.spritesheet.grid) {
          setFrameWidth(action.spritesheet.grid.frame_width.toString());
          setFrameHeight(action.spritesheet.grid.frame_height.toString());
          setRows(action.spritesheet.grid.rows.toString());
          setCols(action.spritesheet.grid.cols.toString());
        }
      }
    }
  }, [isOpen, action, restoreSolidMode]);

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setFormError('');

    if (action.resources.length === 0) {
      setFormError('请先添加资源文件');
      return;
    }

    const requiresFps = resourceType === 'frames' || resourceType === 'spritesheet';
    const fpsNum = parseInt(fps, 10);

    if (requiresFps && (isNaN(fpsNum) || fpsNum < 1 || fpsNum > 60)) {
      setFormError('FPS 必须在 1-60 之间');
      return;
    }

    // 验证精灵图参数
    if (resourceType === 'spritesheet' && spritesheetFormat === 'custom-grid') {
      const fw = parseInt(frameWidth, 10);
      const fh = parseInt(frameHeight, 10);
      const r = parseInt(rows, 10);
      const c = parseInt(cols, 10);

      if (isNaN(fw) || fw <= 0) { setFormError('帧宽度必须大于0'); return; }
      if (isNaN(fh) || fh <= 0) { setFormError('帧高度必须大于0'); return; }
      if (isNaN(r) || r <= 0) { setFormError('行数必须大于0'); return; }
      if (isNaN(c) || c <= 0) { setFormError('列数必须大于0'); return; }
    }

    setIsSubmitting(true);

    try {
      // 构建 spritesheet 配置
      let spritesheetConfig: SpriteSheetConfig | undefined = undefined;
      if (resourceType === 'spritesheet') {
        spritesheetConfig = {
          format: spritesheetFormat,
        };

        // custom-grid 格式不需要 url，其他格式需要
        if (spritesheetFormat !== 'custom-grid') {
          spritesheetConfig.url = action.resources[0] || '';
        }

        if (spritesheetFormat === 'custom-grid') {
          spritesheetConfig.grid = {
            frame_width: parseInt(frameWidth, 10),
            frame_height: parseInt(frameHeight, 10),
            rows: parseInt(rows, 10),
            cols: parseInt(cols, 10),
          };
        }
      }

      await invoke('data_update_action_with_spritesheet', {
        characterId,
        appearanceId,
        oldKey: actionKey,
        newKey: actionKey,
        type: resourceType,
        fps: requiresFps ? fpsNum : null,
        loopValue: loop,
        spritesheet: spritesheetConfig,
        description: null,
      });

      await loadCharacters(assistantId);
      onConfirm();
    } catch (error) {
      console.error('Failed to update action:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setFormError(`更新动作失败: ${errorMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  // 键盘事件
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, fps, loop, resourceType, spritesheetFormat, frameWidth, frameHeight, rows, cols, isSubmitting]);

  if (!isOpen) return null;

  const requiresFps = resourceType === 'frames' || resourceType === 'spritesheet';

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="assistant-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header-mac">
          <div className="modal-title">编辑动作参数</div>
          <button className="modal-close-btn" onClick={handleCancel}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="modal-body-mac">
          {/* 表单错误提示 */}
          {formError && <div className="form-error-mac" style={{ marginBottom: 'var(--dj-space-4)' }}>{formError}</div>}

          {/* 动作键（只读） */}
          <div className="form-group-mac">
            <label className="form-label-mac">动作键</label>
            <div className="input-readonly-mac">
              <span className="readonly-value">{actionKey}</span>
            </div>
          </div>

          {/* 资源类型 */}
          <div className="form-group-mac">
            <label className="form-label-mac">资源类型</label>
            <div className="resource-type-list">
              {RESOURCE_TYPES.map((type) => (
                <label
                  key={type.value}
                  className={`resource-type-option ${resourceType === type.value ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="resourceType"
                    checked={resourceType === type.value}
                    onChange={() => setResourceType(type.value)}
                  />
                  <span className="resource-type-label">
                    <span className="resource-type-title">{type.label}</span>
                    <span className="resource-type-desc">{type.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 精灵图格式 */}
          {resourceType === 'spritesheet' && (
            <>
              <div className="form-group-mac">
                <label className="form-label-mac">精灵图格式</label>
                <select
                  value={spritesheetFormat}
                  onChange={(e) => setSpritesheetFormat(e.target.value as SpriteSheetFormat)}
                  className="form-select-mac"
                >
                  <option value="custom-grid">自定义网格</option>
                  <option value="pixi-json">PIXI.js JSON</option>
                  <option value="aseprite">Aseprite JSON</option>
                  <option value="texture-packer">TexturePacker</option>
                </select>
              </div>

              {/* 自定义网格参数 */}
              {spritesheetFormat === 'custom-grid' && (
                <>
                  <div className="form-row-mac">
                    <div className="form-group-mac half">
                      <label className="form-label-mac">帧宽度 (px)</label>
                      <input
                        type="number"
                        min="1"
                        value={frameWidth}
                        onChange={(e) => setFrameWidth(e.target.value)}
                        className="form-input-mac"
                      />
                    </div>
                    <div className="form-group-mac half">
                      <label className="form-label-mac">帧高度 (px)</label>
                      <input
                        type="number"
                        min="1"
                        value={frameHeight}
                        onChange={(e) => setFrameHeight(e.target.value)}
                        className="form-input-mac"
                      />
                    </div>
                  </div>

                  <div className="form-row-mac">
                    <div className="form-group-mac half">
                      <label className="form-label-mac">行数</label>
                      <input
                        type="number"
                        min="1"
                        value={rows}
                        onChange={(e) => setRows(e.target.value)}
                        className="form-input-mac"
                      />
                    </div>
                    <div className="form-group-mac half">
                      <label className="form-label-mac">列数</label>
                      <input
                        type="number"
                        min="1"
                        value={cols}
                        onChange={(e) => setCols(e.target.value)}
                        className="form-input-mac"
                      />
                    </div>
                  </div>

                  <div className="form-info-box-mac">
                    <div className="info-grid-mac">
                      <span>总帧数: {parseInt(rows) * parseInt(cols)}</span>
                      <span>图片尺寸: {parseInt(frameWidth) * parseInt(cols)} × {parseInt(frameHeight) * parseInt(rows)} px</span>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* FPS 参数预设 */}
          {requiresFps && (
            <div className="form-group-mac">
              <label className="form-label-mac">帧率预设</label>
              <div className="preset-buttons">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className={`preset-btn ${parseInt(fps) === preset.fps ? 'active' : ''}`}
                    onClick={() => setFps(preset.fps.toString())}
                  >
                    {preset.label}
                    <span className="preset-desc">{preset.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* FPS 手动输入 */}
          {requiresFps && (
            <div className="form-group-mac">
              <label className="form-label-mac">自定义帧率 (FPS)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={fps}
                onChange={(e) => setFps(e.target.value)}
                className="form-input-mac"
              />
              <div className="form-hint-mac">范围 1-60，或选择上方预设</div>
            </div>
          )}

          {/* 循环播放 */}
          <div className="form-group-mac">
            <label className="checkbox-label-mac">
              <input
                type="checkbox"
                checked={loop}
                onChange={(e) => setLoop(e.target.checked)}
                className="checkbox-mac"
              />
              <span>循环播放</span>
            </label>
          </div>

          {/* 资源信息 */}
          <div className="form-info-box-mac">
            <div className="info-title">当前资源</div>
            <div className="info-grid-mac">
              <span>文件数: {action.resources.length}</span>
              <span>首文件: {action.resources[0] || '无'}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer-mac">
          <button className="btn-mac btn-mac-secondary" onClick={handleCancel} disabled={isSubmitting}>
            取消
          </button>
          <button className="btn-mac btn-mac-primary" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
