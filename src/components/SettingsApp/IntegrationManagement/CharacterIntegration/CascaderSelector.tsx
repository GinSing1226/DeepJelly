/**
 * Cascader Selector
 *
 * Meta-Name: Cascader Selector
 * Meta-Description: Cascading selector component for hierarchical data (Assistant -> Character -> Integration -> Agent)
 */

import { useState } from 'react';
import './CascaderSelector.css';

export interface CascaderOption {
  value: string;
  label: string;
  children?: CascaderOption[];
  disabled?: boolean;
}

export interface CascaderSelectorProps {
  /** 选项数据 */
  options: CascaderOption[];
  /** 选中的值路径 [assistantId, characterId, integrationId, agentId] */
  value: string[];
  /** 值变化回调 */
  onChange: (value: string[]) => void;
  /** 占位符 */
  placeholder?: string;
  /** 禁用状态 */
  disabled?: boolean;
}

export function CascaderSelector({
  options,
  value,
  onChange,
  placeholder = '请选择',
  disabled = false,
}: CascaderSelectorProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // 切换展开状态
  const toggleExpand = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // 处理选择
  const handleSelect = (optionValue: string, path: string[]) => {
    // 构建完整的选择路径
    const fullPath = [...path, optionValue];
    onChange(fullPath);
  };

  // 获取选中项的显示文本
  const getSelectedLabel = () => {
    if (value.length === 0) return placeholder;

    const findLabel = (opts: CascaderOption[], targetValue: string, index: number): string | null => {
      for (const opt of opts) {
        if (opt.value === targetValue && index === value.length - 1) {
          return opt.label;
        }
        if (opt.children && index < value.length - 1) {
          const result = findLabel(opt.children, value[index + 1], index + 1);
          if (result) return result;
        }
      }
      return null;
    };

    const labels: string[] = [];
    for (let i = 0; i < value.length; i++) {
      const label = findLabel(options, value[i], i);
      if (label) labels.push(label);
    }

    return labels.join(' > ');
  };

  // 渲染节点
  const renderNode = (
    node: CascaderOption,
    path: string[] = [],
    level: number = 0
  ): JSX.Element => {
    const currentPath = [...path, node.value];
    const pathKey = currentPath.join('/');
    const isExpanded = expandedPaths.has(pathKey);
    const isLeaf = !node.children || node.children.length === 0;
    const isSelected = value.length === currentPath.length &&
      value.every((v, i) => v === currentPath[i]);

    return (
      <div key={pathKey} className="cascader-node">
        <div
          className={`cascader-item ${isSelected ? 'selected' : ''} ${node.disabled ? 'disabled' : ''}`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => {
            if (node.disabled) return;
            if (isLeaf) {
              handleSelect(node.value, path);
            } else {
              toggleExpand(pathKey);
            }
          }}
        >
          {!isLeaf && (
            <span className={`cascader-arrow ${isExpanded ? 'expanded' : ''}`}>
              ▶
            </span>
          )}
          <span className="cascader-label">{node.label}</span>
          {isSelected && <span className="cascader-check">✓</span>}
        </div>
        {isExpanded && node.children && node.children.length > 0 && (
          <div className="cascader-children">
            {node.children.map(child => renderNode(child, currentPath, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`cascader-selector ${disabled ? 'disabled' : ''}`}>
      <div className="cascader-display">
        <span className={value.length > 0 ? 'has-value' : 'placeholder'}>
          {getSelectedLabel()}
        </span>
      </div>
      <div className="cascader-dropdown">
        {options.map(option => renderNode(option))}
      </div>
    </div>
  );
}
