/**
 * Display Settings Component
 *
 * 展示管理设置页面组件
 * 管理桌面上的多角色展示槽位
 *
 * Meta-Name: Display Settings
 * Meta-Description: Display management settings page for managing character display slots on desktop
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import type { DisplaySlot } from '@/types/character';
import { SlotConfigForm, type SlotConfig } from './SlotConfigForm';
import { ConfirmDialog } from '@/components/SettingsApp/IntegrationManagement/ConfirmDialog';
import './display.css';

export function DisplaySettings() {
  const { t } = useTranslation(['settings', 'common']);
  const [slots, setSlots] = useState<DisplaySlot[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState<DisplaySlot | null>(null);
  const [loading, setLoading] = useState(false);

  // 删除确认弹窗状态
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    slotId: string | null;
    slotName: string;
  }>({ show: false, slotId: null, slotName: '' });

  // 加载展示槽位列表（不包含主窗口，主窗口独立管理）
  const loadSlots = useCallback(async () => {
    try {
      const result = await invoke<DisplaySlot[]>('get_display_slots', {
        includePrimary: false,
      });
      console.log('[DisplaySettings] loadSlots: Loaded', result.length, 'slots');
      result.forEach(slot => {
        console.log('[DisplaySettings] Slot:', slot.id, slot.assistantName, slot.characterName, 'window_id:', slot.windowId);
      });
      setSlots(result);
    } catch (error) {
      console.error('[DisplaySettings] Failed to load slots:', error);
    }
  }, []);

  // 组件挂载时加载槽位
  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  // 添加槽位
  const handleAddSlot = async (config: SlotConfig) => {
    setLoading(true);
    try {
      const newSlot = await invoke<DisplaySlot>('add_display_slot', {
        assistantId: config.assistantId,
        characterId: config.characterId,
        appearanceId: config.appearanceId,
      });
      setSlots([...slots, newSlot]);
      setShowAddModal(false);
    } catch (error) {
      console.error('[DisplaySettings] Failed to add slot:', error);
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
      await invoke('update_display_slot', {
        slotId: editingSlot.id,
        assistantId: config.assistantId,
        characterId: config.characterId,
        appearanceId: config.appearanceId,
      });
      await loadSlots();
      setShowEditModal(false);
      setEditingSlot(null);
    } catch (error) {
      console.error('[DisplaySettings] Failed to update slot:', error);
      alert(String(error));
    } finally {
      setLoading(false);
    }
  };

  // 打开删除确认弹窗
  const openDeleteConfirm = (slot: DisplaySlot) => {
    setDeleteConfirm({
      show: true,
      slotId: slot.id,
      slotName: `${slot.assistantName} - ${slot.characterName}`,
    });
  };

  // 关闭删除确认弹窗
  const closeDeleteConfirm = () => {
    setDeleteConfirm({ show: false, slotId: null, slotName: '' });
  };

  // 删除槽位
  const handleDeleteSlot = async () => {
    if (!deleteConfirm.slotId) return;

    setLoading(true);
    try {
      await invoke('delete_display_slot', { slotId: deleteConfirm.slotId });
      await loadSlots();
      closeDeleteConfirm();
    } catch (error) {
      console.error('[DisplaySettings] Failed to delete slot:', error);
      alert(String(error));
    } finally {
      setLoading(false);
    }
  };

  // 切换槽位可见性
  const handleToggleVisibility = async (slotId: string, visible: boolean) => {
    try {
      await invoke('set_slot_visibility', { slotId, visible });
      setSlots(slots.map(s =>
        s.id === slotId ? { ...s, visible } : s
      ));
    } catch (error) {
      console.error('[DisplaySettings] Failed to toggle visibility:', error);
    }
  };

  // 刷新槽位资源
  const handleRefreshSlot = async (slotId: string) => {
    console.log('[DisplaySettings] handleRefreshSlot CALLED with slotId:', slotId);
    try {
      const slot = slots.find(s => s.id === slotId);
      if (!slot) {
        console.error('[DisplaySettings] Slot not found:', slotId);
        return;
      }
      console.log('[DisplaySettings] Found slot:', slot);
      // 全局广播 character:load 事件，所有窗口都会收到
      const { emit } = await import('@tauri-apps/api/event');
      // 全局广播事件，包含完整的路由信息
      const payload = {
        slotId,
        assistantId: slot.assistantId,
        characterId: slot.characterId,
        appearanceId: slot.appearanceId,
        isRefresh: true,  // 标记这是刷新操作，需要重新加载配置
      };
      console.log('[DisplaySettings] Emitting character:load event with payload:', payload);
      await emit('character:load', payload);
      console.log('[DisplaySettings] Event emitted successfully');
    } catch (error) {
      console.error('[DisplaySettings] Failed to refresh slot:', error);
      alert(String(error));
    }
  };

  // 打开添加弹窗
  const openAddModal = () => {
    setEditingSlot(null);
    setShowAddModal(true);
  };

  // 打开编辑弹窗
  const openEditModal = (slot: DisplaySlot) => {
    setEditingSlot(slot);
    setShowEditModal(true);
  };

  // 关闭弹窗
  const closeModals = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setEditingSlot(null);
  };

  return (
    <>
      <div className="display-settings">
        {/* 标题区域 - 与应用集成/角色集成风格一致 */}
        <div className="display-settings-header">
          <h3>
            <span className="icon">🖥</span>
            {t('display.management')}
            <span className="section-count">{slots.length}</span>
          </h3>
          <button className="btn-add-integration" onClick={openAddModal}>
            <span>+</span>
            {t('display.addSlot')}
          </button>
        </div>

        {/* 槽位网格 */}
        <div className="slots-grid">
          {slots.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              onEdit={() => openEditModal(slot)}
              onDelete={() => openDeleteConfirm(slot)}
              onToggleVisibility={(visible) => handleToggleVisibility(slot.id, visible)}
              onRefresh={() => handleRefreshSlot(slot.id)}
            />
          ))}
          {/* 空槽位 */}
          {Array.from({ length: Math.max(0, 6 - slots.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="slot-card empty">
              <button className="btn-add-empty" onClick={openAddModal}>
                + {t('display.addSlot')}
              </button>
            </div>
          ))}
        </div>

      </div>

      {/* 添加槽位弹窗 */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{t('display.addSlot')}</h3>
              <button className="btn-close" onClick={closeModals}>×</button>
            </div>
            <div className="modal-body">
              <SlotConfigForm
                onSubmit={handleAddSlot}
                onCancel={closeModals}
                loading={loading}
              />
            </div>
          </div>
        </div>
      )}

      {/* 编辑槽位弹窗 */}
      {showEditModal && editingSlot && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{t('display.editSlot')}</h3>
              <button className="btn-close" onClick={closeModals}>×</button>
            </div>
            <div className="modal-body">
              <SlotConfigForm
                initialConfig={{
                  assistantId: editingSlot.assistantId,
                  characterId: editingSlot.characterId,
                  appearanceId: editingSlot.appearanceId,
                }}
                onSubmit={handleEditSlot}
                onCancel={closeModals}
                loading={loading}
              />
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      <ConfirmDialog
        isOpen={deleteConfirm.show}
        title={t('display.confirmDeleteSlot')}
        message={deleteConfirm.slotName}
        confirmText={t('common:delete')}
        cancelText={t('common:cancel')}
        isDanger={true}
        onConfirm={handleDeleteSlot}
        onCancel={closeDeleteConfirm}
      />
    </>
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
  const isPrimary = slot.id === '__primary';
  const [coverImage, setCoverImage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // 用于强制重新加载封面

  // 加载角色封面图
  useEffect(() => {
    const loadCoverImage = async () => {
      if (isPrimary || !slot.characterId) {
        return;
      }
      setLoading(true);
      try {
        // 获取角色配置
        const { invoke } = await import('@tauri-apps/api/core');
        const characterConfig = await invoke<{
          characterId: string;
          name: string;
          appearances: Array<{
            id: string;
            name: string;
            actions: Record<string, {
              type?: string;
              resources?: string[];
              frames?: string[];
              fps?: number;
              loop?: boolean;
            }>;
          }>;
        }>('get_character', { characterId: slot.characterId });
        if (!characterConfig) {
          return;
        }

        // 找到对应的 appearance
        const appearance = characterConfig.appearances.find(a => a.id === slot.appearanceId);
        if (!appearance) {
          return;
        }

        // 获取第一个动作（通常 internal-base-idle 是第一个）
        const actionKeys = Object.keys(appearance.actions);
        const firstActionKey = actionKeys.find(k => k.includes('idle')) || actionKeys[0];

        if (!firstActionKey) {
          return;
        }

        const action = appearance.actions[firstActionKey];

        // 检查动作类型
        const actionType = action.type || 'frames';

        // 获取资源列表（GIF、spritesheet、frames 都用 resources）
        const resourceList = action.resources || action.frames;
        if (!resourceList || resourceList.length === 0) {
          return;
        }

        // 第一个资源作为封面图
        const resourceName = `${slot.appearanceId}/${firstActionKey}/${resourceList[0]}`;

        const resourceMap = await invoke<Record<string, string>>('load_character_resources', {
          assistantId: slot.assistantId,
          characterId: slot.characterId,
          resourceNames: [resourceName],
        });
        const dataUrl = resourceMap[resourceName];
        if (dataUrl) {
          setCoverImage(dataUrl);
        }
      } catch (error) {
        console.error('[SlotCard] Failed to load cover image:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCoverImage();
  }, [slot, isPrimary, refreshKey]);

  // 处理刷新按钮点击
  const handleRefresh = async () => {
    console.log('[SlotCard] handleRefresh CALLED for slot:', slot.id, slot.assistantName, slot.characterName);
    setRefreshing(true);
    try {
      // 调用父组件的刷新逻辑（发送事件给窗口）
      await onRefresh();
      // 强制重新加载封面图
      setRefreshKey(prev => prev + 1);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className={`slot-card ${!slot.visible ? 'hidden' : ''} ${isPrimary ? 'primary' : ''}`}>
      {/* 封面图 */}
      <div className="slot-cover">
        {isPrimary ? (
          '🏠'
        ) : loading ? (
          <div className="cover-loading">...</div>
        ) : coverImage ? (
          <img src={coverImage} alt={`${slot.characterName} - ${slot.appearanceName}`} />
        ) : (
          <span className="cover-placeholder">{slot.visible ? '👁' : '👁‍🗨'}</span>
        )}
      </div>

      {/* 信息 */}
      <div className="slot-info">
        <div className="slot-title">
          {isPrimary && <span className="primary-badge">{t('display.primaryWindow')}</span>}
          {slot.assistantName} - {slot.characterName}
        </div>
        <div className="slot-appearance">
          {slot.appearanceName}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="slot-actions">
        {!isPrimary && (
          <>
            <button
              className={`btn-action btn-icon btn-refresh ${refreshing ? 'is-refreshing' : ''}`}
              onClick={handleRefresh}
              disabled={refreshing}
              title="重新加载角色资源"
            >
              <svg
                className={`refresh-icon ${refreshing ? 'spinning' : ''}`}
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
            </button>
            <button className="btn-action btn-icon btn-edit" onClick={onEdit} title="编辑槽位">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button className="btn-action btn-icon btn-delete" onClick={onDelete} title="删除槽位">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* 可见性开关 - 主窗口也显示但不允许隐藏 */}
      <div className="slot-visibility">
        {isPrimary ? (
          <span className="primary-label">{t('display.alwaysVisible')}</span>
        ) : (
          <button
            className={`toggle-switch ${slot.visible ? 'on' : 'off'}`}
            onClick={() => onToggleVisibility(!slot.visible)}
            title={slot.visible ? '点击隐藏' : '点击显示'}
          >
            {slot.visible ? '显示中' : '已隐藏'}
          </button>
        )}
      </div>
    </div>
  );
}
