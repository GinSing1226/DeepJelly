/**
 * ContextMenu 组件
 *
 * Meta-Name: Context Menu Component
 * Meta-Description: 右键菜单组件，支持子菜单、分隔线和禁用状态
 */

import { useEffect, useRef, useState } from 'react';
import './styles.css';

export interface ContextMenuItem {
  id: string;
  label: string;
  onClick: () => void;
  /** 是否为分隔线 */
  isDivider?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 快捷键提示 */
  shortcut?: string;
  /** 子菜单 */
  submenu?: ContextMenuItem[];
  /** 图标 */
  icon?: React.ReactNode;
  /** 是否选中（用于单选/多选状态） */
  checked?: boolean;
}

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  items: ContextMenuItem[];
}

export function ContextMenu({
  isOpen,
  position,
  onClose,
  items,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // 关闭时重置子菜单状态
  useEffect(() => {
    if (!isOpen) {
      setActiveSubmenu(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const adjustPosition = () => {
    const menuWidth = 180;
    const visibleItems = items.filter((item) => !item.isDivider);
    const menuHeight = visibleItems.length * 36;
    const maxX = window.innerWidth - menuWidth - 10;
    const maxY = window.innerHeight - menuHeight - 10;

    return {
      x: Math.min(position.x, maxX),
      y: Math.min(position.y, maxY),
    };
  };

  const adjustedPosition = adjustPosition();

  const handleItemClick = (item: ContextMenuItem, event: React.MouseEvent) => {
    if (item.disabled || item.isDivider || item.submenu) return;
    event.stopPropagation();
    item.onClick();
    onClose();
  };

  const handleSubmenuItemClick = (item: ContextMenuItem) => {
    if (item.disabled || item.isDivider) return;
    item.onClick();
    onClose();
  };

  const handleItemHover = (item: ContextMenuItem) => {
    if (item.submenu) {
      setActiveSubmenu(item.id);
    } else {
      setActiveSubmenu(null);
    }
  };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
      onMouseLeave={() => setActiveSubmenu(null)}
    >
      {items.map((item) => {
        if (item.isDivider) {
          return <div key={item.id} className="context-menu-divider" />;
        }

        const hasSubmenu = item.submenu && item.submenu.length > 0;
        const isSubmenuOpen = activeSubmenu === item.id;

        return (
          <div
            key={item.id}
            className={`context-menu-item ${item.disabled ? 'disabled' : ''} ${hasSubmenu ? 'has-submenu' : ''} ${isSubmenuOpen ? 'submenu-open' : ''}`}
            onClick={(e) => handleItemClick(item, e)}
            onMouseEnter={() => handleItemHover(item)}
          >
            {item.icon && <span className="context-menu-icon">{item.icon}</span>}
            <span className="context-menu-label">{item.label}</span>
            {item.shortcut && (
              <span className="context-menu-shortcut">{item.shortcut}</span>
            )}
            {hasSubmenu && <span className="context-menu-arrow">▶</span>}

            {/* 子菜单 */}
            {hasSubmenu && isSubmenuOpen && (
              <div className="context-submenu">
                {item.submenu!.map((subItem) => {
                  if (subItem.isDivider) {
                    return <div key={subItem.id} className="context-menu-divider" />;
                  }

                  return (
                    <div
                      key={subItem.id}
                      className={`context-menu-item ${subItem.disabled ? 'disabled' : ''} ${subItem.checked ? 'checked' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSubmenuItemClick(subItem);
                      }}
                    >
                      {subItem.icon && (
                        <span className="context-menu-icon">{subItem.icon}</span>
                      )}
                      {subItem.checked !== undefined && (
                        <span className="context-menu-check">✓</span>
                      )}
                      <span className="context-menu-label">{subItem.label}</span>
                      {subItem.shortcut && (
                        <span className="context-menu-shortcut">
                          {subItem.shortcut}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
