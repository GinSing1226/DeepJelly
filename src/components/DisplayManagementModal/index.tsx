/**
 * Display Management Modal
 *
 * 展示管理弹窗主组件
 * 管理桌面上的多角色展示槽位
 *
 * Meta-Name: Display Management Modal
 * Meta-Description: Modal for managing multiple character display slots on desktop
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { SlotConfigForm, type SlotConfig } from './SlotConfigForm';
import type { DisplaySlot } from '@/types/character';
import './styles.css';

export interface DisplayManagementModalProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
}

type ViewMode = 'list' | 'add' | 'edit';

export function DisplayManagementModal({
  isOpen,
  onClose,
}: DisplayManagementModalProps) {
  const { t } = useTranslation(['settings', 'common']);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [slots, setSlots] = useState<DisplaySlot[]>([]);
  const [editingSlot, setEditingSlot] = useState<DisplaySlot | null>(null);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // 加载展示槽位列表
  const loadSlots = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<DisplaySlot[]>('get_display_slots');
      setSlots(result);
    } catch (error) {
      console.error('[DisplayManagementModal] Failed to load slots:', error);
    }
  };

  // 组件挂载时加载槽位
  useEffect(() => {
    if (isOpen) {
      loadSlots();
    }
  }, [isOpen]);

  // 添加槽位
  const handleAddSlot = async (config: SlotConfig) => {
    setLoading(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const newSlot = await invoke<DisplaySlot>('add_display_slot', {
        assistantId: config.assistantId,
        characterId: config.characterId,
        appearanceId: config.appearanceId,
      });
      setSlots([...slots, newSlot]);
      setViewMode('list');
    } catch (error) {
      console.error('[DisplayManagementModal] Failed to add slot:', error);
      alert(String(error));
    } finally {
      setLoading(false);
    }
  };

  // 编辑槽位
  const handleEditSlot = async (config: SlotConfig) => {
    if (!editingSlot) return;
    setLoading(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('update_display_slot', {
        slotId: editingSlot.id,
        assistantId: config.assistantId,
        characterId: config.characterId,
        appearanceId: config.appearanceId,
      });
      await loadSlots();
      setViewMode('list');
      setEditingSlot(null);
    } catch (error) {
      console.error('[DisplayManagementModal] Failed to update slot:', error);
      alert(String(error));
    } finally {
      setLoading(false);
    }
  };

  // 删除槽位
  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm(t('display.confirmDeleteSlot'))) return;

    setLoading(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_display_slot', { slotId });
      await loadSlots();
    } catch (error) {
      console.error('[DisplayManagementModal] Failed to delete slot:', error);
      alert(String(error));
    } finally {
      setLoading(false);
    }
  };

  // 刷新槽位资源
  const handleRefreshSlot = async (slotId: string) => {
    try {
      const slot = slots.find(s => s.id === slotId);
      if (!slot) return;

      console.log('[DisplayManagementModal] Refreshing slot:', slot);

      // 全局广播 character:load 事件，所有窗口都会收到
      const { emit } = await import('@tauri-apps/api/event');

      console.log('[DisplayManagementModal] Broadcasting character:load event:', {
        slotId,
        assistantId: slot.assistantId,
        characterId: slot.characterId,
        appearanceId: slot.appearanceId,
      });

      // 全局广播事件，包含完整的路由信息
      await emit('character:load', {
        slotId,
        assistantId: slot.assistantId,
        characterId: slot.characterId,
        appearanceId: slot.appearanceId,
      });

      console.log('[DisplayManagementModal] Refresh event broadcasted');
    } catch (error) {
      console.error('[DisplayManagementModal] Failed to refresh slot:', error);
      alert(String(error));
    }
  };

  // Toggle slot visibility
  const handleToggleVisibility = async (slotId: string, visible: boolean) => {
    try {
      await invoke('set_slot_visibility', { slotId, visible });
      setSlots(slots.map(s =>
        s.id === slotId ? { ...s, visible } : s
      ));
    } catch (error) {
      console.error('[DisplayManagementModal] Failed to toggle visibility:', error);
    }
  };

  // 开始添加
  const startAdd = () => {
    setEditingSlot(null);
    setViewMode('add');
  };

  // 开始编辑
  const startEdit = (slot: DisplaySlot) => {
    setEditingSlot(slot);
    setViewMode('edit');
  };

  // 取消编辑
  const handleCancel = () => {
    setViewMode('list');
    setEditingSlot(null);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="display-management-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header - MAC Style */}
        <div className="modal-header-mac">
          <div className="modal-title">{t('display.management')}</div>
          <button className="modal-close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body - MAC Style */}
        <div className="modal-body-mac">
          {viewMode === 'add' || viewMode === 'edit' ? (
            /* 表单模式：不包装，直接渲染表单 */
            <SlotConfigForm
              ref={formRef}
              initialConfig={editingSlot ? {
                assistantId: editingSlot.assistantId,
                characterId: editingSlot.characterId,
                appearanceId: editingSlot.appearanceId,
              } : undefined}
              onSubmit={viewMode === 'add' ? handleAddSlot : handleEditSlot}
              onCancel={handleCancel}
              loading={loading}
              showActions={false}
            />
          ) : (
            <>
              {/* 槽位网格 */}
              <div className="slots-grid-mac">
                {slots.map((slot) => (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    onEdit={() => startEdit(slot)}
                    onDelete={() => handleDeleteSlot(slot.id)}
                    onToggleVisibility={(visible) => handleToggleVisibility(slot.id, visible)}
                    onRefresh={() => handleRefreshSlot(slot.id)}
                  />
                ))}
                {/* 空槽位 */}
                {Array.from({ length: Math.max(0, 6 - slots.length) }).map((_, i) => (
                  <div key={`empty-${i}`} className="slot-card-mac empty">
                    <button className="btn-add-empty-mac" onClick={startAdd}>
                      + {t('display.addSlot')}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer - MAC Style */}
        {viewMode === 'list' ? (
          <div className="modal-footer-mac">
            <button className="btn-mac btn-mac-primary" onClick={startAdd}>
              + {t('display.addSlot')}
            </button>
            <button className="btn-mac btn-mac-secondary" onClick={onClose}>
              {t('common:close')}
            </button>
          </div>
        ) : (
          /* 表单模式的 footer */
          <div className="modal-footer-mac">
            <button
              className="btn-mac btn-mac-secondary"
              onClick={handleCancel}
              disabled={loading}
            >
              {t('common:cancel')}
            </button>
            <button
              className="btn-mac btn-mac-primary"
              onClick={() => {
                // 触发表单提交
                formRef.current?.requestSubmit();
              }}
              disabled={loading}
            >
              {loading ? t('common:saving') : t('common:confirm')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 槽位卡片组件
 */
interface SlotCardProps {
  slot: DisplaySlot;
  onEdit: () => void;
  onDelete: () => void;
  onToggleVisibility: (visible: boolean) => void;
  onRefresh: () => void;
}

function SlotCard({ slot, onEdit, onDelete, onToggleVisibility, onRefresh }: SlotCardProps) {
  const { t } = useTranslation(['settings', 'common']);

  return (
    <div className={`slot-card-mac ${!slot.visible ? 'hidden' : ''}`}>
      {/* 封面图 */}
      <div className="slot-cover-mac">
        {slot.visible ? '👁' : '👁‍🗨'}
      </div>

      {/* 信息 */}
      <div className="slot-info-mac">
        <div className="slot-title-mac">
          {slot.assistantName} - {slot.characterName}
        </div>
        <div className="slot-appearance-mac">
          {slot.appearanceName}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="slot-actions-mac">
        <button className="btn-icon-mac btn-refresh" onClick={onRefresh} title="刷新">
          🔄
        </button>
        <button className="btn-icon-mac" onClick={onEdit} title={t('common:edit')}>
          ✏
        </button>
        <button className="btn-icon-mac btn-delete" onClick={onDelete} title={t('common:delete')}>
          🗑
        </button>
      </div>

      {/* 可见性开关 */}
      <div className="slot-visibility-mac">
        <button
          className={`toggle-switch-mac ${slot.visible ? 'on' : 'off'}`}
          onClick={() => onToggleVisibility(!slot.visible)}
        >
          {slot.visible ? '●' : '○'}
        </button>
      </div>
    </div>
  );
}
