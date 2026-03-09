/**
 * Action Tree Editor Component
 *
 * 动作树编辑组件
 * 三层树形结构：domain → category → action_id
 * 支持新增、编辑、删除动作
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ActionTreeNode,
  ActionResource,
  AddActionFormData,
  EditActionFormData,
} from '@/types/character';

interface ActionTreeEditorProps {
  /** 动作配置 */
  actions: Record<string, ActionResource>;
  /** 选中的动作键 */
  selectedKey: string | null;
  /** 选择动作回调 */
  onSelectAction: (key: string) => void;
  /** 新增动作回调 */
  onAddAction: (data: AddActionFormData) => void;
  /** 编辑动作回调 */
  onEditAction: (data: EditActionFormData) => void;
  /** 删除动作回调 */
  onDeleteAction: (key: string) => void;
}

/**
 * 将扁平的动作配置转换为树形结构
 */
function buildActionTree(actions: Record<string, ActionResource>): ActionTreeNode[] {
  const domainMap = new Map<string, ActionTreeNode>();

  Object.entries(actions).forEach(([key, action]) => {
    const parts = key.split('-');
    let domain = 'internal';
    let category = 'base';
    let actionId = 'idle';

    if (parts.length >= 3) {
      domain = parts[0];
      category = parts[1];
      actionId = parts.slice(2).join('-');
    } else if (parts.length === 2) {
      domain = 'internal';
      category = parts[0];
      actionId = parts[1];
    } else {
      domain = parts[0] || 'internal';
      category = 'base';
      actionId = 'idle';
    }

    // 获取或创建域节点
    if (!domainMap.has(domain)) {
      domainMap.set(domain, {
        type: 'domain',
        key: domain,
        domain,
        children: [],
      });
    }
    const domainNode = domainMap.get(domain)!;

    // 获取或创建分类节点
    const categoryKey = `${domain}-${category}`;
    let categoryNode = domainNode.children!.find(c => c.key === categoryKey);
    if (!categoryNode) {
      categoryNode = {
        type: 'category',
        key: categoryKey,
        domain,
        category,
        children: [],
      };
      domainNode.children!.push(categoryNode);
    }

    // 创建动作节点
    const actionNode: ActionTreeNode = {
      type: 'action',
      key,
      domain,
      category,
      actionId,
      action,
    };
    categoryNode.children!.push(actionNode);
  });

  // 对域、分类、动作都进行字母排序
  const sortedDomains = Array.from(domainMap.values()).sort((a, b) => a.key.localeCompare(b.key));
  sortedDomains.forEach(domain => {
    if (domain.children) {
      domain.children.sort((a, b) => a.key.localeCompare(b.key));
      domain.children.forEach(category => {
        if (category.children) {
          category.children.sort((a, b) => a.key.localeCompare(b.key));
        }
      });
    }
  });

  return sortedDomains;
}

/**
 * 动作树节点组件
 */
function ActionTreeNodeComponent({
  node,
  level = 0,
  selectedKey,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  t,
}: {
  node: ActionTreeNode;
  level?: number;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onAdd: (level: string, parentKey: string) => void;
  onEdit: (key: string) => void;
  onDelete: (key: string) => void;
  t: (key: string) => string;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedKey === node.key;

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (node.type === 'action') {
      setShowContextMenu(true);
    }
  };

  return (
    <div className="action-tree-node">
      <div
        className={`action-node-header ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => {
          if (hasChildren) {
            setIsExpanded(!isExpanded);
          }
          if (node.type === 'action') {
            onSelect(node.key);
          }
        }}
        onContextMenu={handleRightClick}
      >
        {hasChildren && (
          <span className="tree-toggle">{isExpanded ? '▼' : '▾'}</span>
        )}
        <span className={`action-${node.type}`}>
          {node.type === 'domain' && node.domain}
          {node.type === 'category' && node.category}
          {node.type === 'action' && node.actionId}
        </span>

        {/* MVP阶段：注释掉右键菜单 */}
        {/* {showContextMenu && node.type === 'action' && (
          <div
            className="context-menu"
            onMouseLeave={() => setShowContextMenu(false)}
          >
            <div
              className="context-menu-item"
              onClick={() => {
                onEdit(node.key);
                setShowContextMenu(false);
              }}
            >
              {t('character.editAction')}
            </div>
            <div
              className="context-menu-item danger"
              onClick={() => {
                onDelete(node.key);
                setShowContextMenu(false);
              }}
            >
              {t('character.deleteAction')}
            </div>
          </div>
        )} */}
      </div>

      {isExpanded && hasChildren && (
        <div className="tree-children">
          {/* MVP阶段：注释掉新增按钮在分类节点下 */}
          {/* {node.type === 'category' && (
            <div
              className="action-add-btn"
              style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
              onClick={() => onAdd('action', node.key)}
            >
              + {t('character.addAction')}
            </div>
          )} */}

          {node.children!.map((child) => (
            <ActionTreeNodeComponent
              key={child.key}
              node={child}
              level={level + 1}
              selectedKey={selectedKey}
              onSelect={onSelect}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
              t={t}
            />
          ))}
        </div>
      )}

      {/* MVP阶段：注释掉域节点的新增分类按钮 */}
      {/* {node.type === 'domain' && isExpanded && (
        <div
          className="action-add-btn"
          style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
          onClick={() => onAdd('category', node.key)}
        >
          + {t('character.addCategory')}
        </div>
      )} */}
    </div>
  );
}

/**
 * 新增动作弹窗
 */
function AddActionModal({
  isOpen,
  onClose,
  onConfirm,
  level,
  parentKey,
  t,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: AddActionFormData) => void;
  level: string;
  parentKey: string;
  t: (key: string) => string;
}) {
  const [formData, setFormData] = useState<AddActionFormData>({
    level: 'action',
    domain: 'internal',
    category: 'base',
    actionId: 'idle',
    resourceType: 'frames',
    loop: true,
    description: '',
  });

  if (!isOpen) return null;

  const parseParentKey = () => {
    const parts = parentKey.split('-');
    if (parts.length === 1) {
      // parentKey 是 domain
      return { domain: parentKey, category: '' };
    } else if (parts.length === 2) {
      // parentKey 是 domain-category
      return { domain: parts[0], category: parts[1] };
    }
    return { domain: 'internal', category: 'base' };
  };

  const parentInfo = parseParentKey();

  const handleConfirm = () => {
    onConfirm({
      ...formData,
      domain: formData.domain || parentInfo.domain,
      category: formData.category || parentInfo.category,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('character.addAction')}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">{t('character.level')}：</label>
            <select
              className="form-select"
              value={level}
              onChange={(e) => setFormData({ ...formData, level: e.target.value as AddActionFormData['level'] })}
              disabled
            >
              <option value="action">{t('character.actions')}</option>
              <option value="category">{t('character.category')}</option>
              <option value="domain">{t('character.domain')}</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('character.domain')}：</label>
            <input
              className="form-input"
              type="text"
              value={formData.domain}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              placeholder={parentInfo.domain}
            />
          </div>
          {level !== 'domain' && (
            <div className="form-group">
              <label className="form-label">{t('character.category')}：</label>
              <input
                className="form-input"
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder={parentInfo.category || 'base'}
              />
            </div>
          )}
          {level === 'action' && (
            <>
              <div className="form-group">
                <label className="form-label">{t('character.actionId')}：</label>
                <input
                  className="form-input"
                  type="text"
                  value={formData.actionId}
                  onChange={(e) => setFormData({ ...formData, actionId: e.target.value })}
                  placeholder="idle"
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t('character.resourceType')}：</label>
                <select
                  className="form-select"
                  value={formData.resourceType}
                  onChange={(e) => setFormData({ ...formData, resourceType: e.target.value as AddActionFormData['resourceType'] })}
                >
                  <option value="frames">{t('character.frames')}</option>
                  <option value="gif">{t('character.gif')}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('character.loop')}：</label>
                <select
                  className="form-select"
                  value={formData.loop ? 'yes' : 'no'}
                  onChange={(e) => setFormData({ ...formData, loop: e.target.value === 'yes' })}
                >
                  <option value="yes">{t('character.yes')}</option>
                  <option value="no">{t('character.no')}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('character.description')}：</label>
                <input
                  className="form-input"
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>{t('character.cancel')}</button>
          <button className="btn-primary" onClick={handleConfirm}>{t('character.confirm')}</button>
        </div>
      </div>
    </div>
  );
}

/**
 * 编辑动作弹窗
 */
function EditActionModal({
  isOpen,
  onClose,
  onConfirm,
  currentKey,
  t,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: EditActionFormData) => void;
  currentKey: string;
  t: (key: string) => string;
}) {
  const [formData, setFormData] = useState<EditActionFormData>({
    currentKey,
    newKey: currentKey,
    loop: true,
    description: '',
  });

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('character.editAction')}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">{t('character.currentKey')}：</label>
            <input className="form-input" type="text" value={currentKey} disabled />
          </div>
          <div className="form-group">
            <label className="form-label">{t('character.newKey')}：</label>
            <input
              className="form-input"
              type="text"
              value={formData.newKey}
              onChange={(e) => setFormData({ ...formData, newKey: e.target.value })}
            />
            <div className="form-hint">{t('character.keyChangeHint')}</div>
          </div>
          <div className="form-group">
            <label className="form-label">{t('character.loop')}：</label>
            <select
              className="form-select"
              value={formData.loop ? 'yes' : 'no'}
              onChange={(e) => setFormData({ ...formData, loop: e.target.value === 'yes' })}
            >
              <option value="yes">{t('character.yes')}</option>
              <option value="no">{t('character.no')}</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('character.description')}：</label>
            <input
              className="form-input"
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>{t('character.cancel')}</button>
          <button className="btn-primary" onClick={handleConfirm}>{t('character.save')}</button>
        </div>
      </div>
    </div>
  );
}

/**
 * 动作树编辑器主组件
 */
export default function ActionTreeEditor({
  actions,
  selectedKey,
  onSelectAction,
  onAddAction,
  onEditAction,
  onDeleteAction,
}: ActionTreeEditorProps) {
  const { t } = useTranslation('settings');
  const [addModalState, setAddModalState] = useState<{
    isOpen: boolean;
    level: string;
    parentKey: string;
  }>({ isOpen: false, level: 'action', parentKey: '' });

  const [editModalState, setEditModalState] = useState<{
    isOpen: boolean;
    currentKey: string;
  }>({ isOpen: false, currentKey: '' });

  const actionTree = useMemo(() => buildActionTree(actions), [actions]);

  const handleAdd = (level: string, parentKey: string) => {
    setAddModalState({ isOpen: true, level, parentKey });
  };

  const handleEdit = (key: string) => {
    setEditModalState({ isOpen: true, currentKey: key });
  };

  const handleDelete = (key: string) => {
    if (confirm(t('character.deleteActionConfirm', { key }))) {
      onDeleteAction(key);
    }
  };

  return (
    <div className="action-tree-editor">
      <div className="ate-header">
        <h3>{t('character.actionTree')}</h3>
        {/* MVP阶段：注释掉顶部新增动作按钮 */}
        {/* <button
          className="btn-add-action"
          onClick={() => setAddModalState({ isOpen: true, level: 'domain', parentKey: '' })}
        >
          + {t('character.addAction')}
        </button> */}
      </div>

      <div className="ate-content">
        {actionTree.length === 0 ? (
          <div className="empty-tree">
            <div className="empty-icon">🌳</div>
            <div className="empty-text">{t('character.noActions')}</div>
            {/* MVP阶段：注释掉新增第一个动作按钮 */}
            {/* <button
              className="btn-add-first"
              onClick={() => setAddModalState({ isOpen: true, level: 'domain', parentKey: '' })}
            >
              + {t('character.addFirstAction')}
            </button> */}
          </div>
        ) : (
          actionTree.map((node) => (
            <ActionTreeNodeComponent
              key={node.key}
              node={node}
              selectedKey={selectedKey}
              onSelect={onSelectAction}
              onAdd={handleAdd}
              onEdit={handleEdit}
              onDelete={handleDelete}
              t={t}
            />
          ))
        )}
      </div>

      {/* 新增动作弹窗 */}
      <AddActionModal
        isOpen={addModalState.isOpen}
        onClose={() => setAddModalState({ isOpen: false, level: 'action', parentKey: '' })}
        onConfirm={(data) => {
          onAddAction(data);
          setAddModalState({ isOpen: false, level: 'action', parentKey: '' });
        }}
        level={addModalState.level}
        parentKey={addModalState.parentKey}
        t={t}
      />

      {/* 编辑动作弹窗 */}
      <EditActionModal
        isOpen={editModalState.isOpen}
        onClose={() => setEditModalState({ isOpen: false, currentKey: '' })}
        onConfirm={(data) => {
          onEditAction(data);
          setEditModalState({ isOpen: false, currentKey: '' });
        }}
        currentKey={editModalState.currentKey}
        t={t}
      />
    </div>
  );
}
