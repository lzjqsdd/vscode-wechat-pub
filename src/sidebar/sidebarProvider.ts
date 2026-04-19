/**
 * 侧边栏 TreeDataProvider
 * 提供多层级快捷操作面板：
 * - 快捷操作（发布、复制、更新）
 * - 设置（主题、颜色、开关）
 * - 已发布草稿列表
 */

import * as vscode from 'vscode';
import { ConfigStore } from '../storage/configStore';
import { DraftMappingStore, DraftMapping } from '../storage/draftMapping';
import { getActionItems, ActionItem } from './actionItems';
import { SettingItem, getThemeOptions, getColorOptions, getToggleOptions } from './settingItems';

/**
 * 节点类型
 */
type NodeType = 'group-action' | 'group-setting' | 'group-draft'
  | 'action' | 'setting-group' | 'setting-option' | 'draft-item';

/**
 * 侧边栏节点
 */
export class SidebarItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly nodeType: NodeType,
    public readonly value?: string,
    public readonly data?: DraftMapping | { key: string; checked: boolean }
  ) {
    super(label, collapsibleState);
    this.contextValue = nodeType;

    // 设置图标
    this.iconPath = this.getIcon();
  }

  private getIcon(): vscode.ThemeIcon | undefined {
    switch (this.nodeType) {
      case 'group-action':
        return new vscode.ThemeIcon('zap');
      case 'group-setting':
        return new vscode.ThemeIcon('gear');
      case 'group-draft':
        return new vscode.ThemeIcon('folder');
      case 'setting-group':
        return new vscode.ThemeIcon('chevron-right');
      case 'draft-item':
        return new vscode.ThemeIcon('file-text');
      default:
        return undefined;
    }
  }
}

/**
 * 侧边栏数据提供器
 */
export class SidebarProvider implements vscode.TreeDataProvider<SidebarItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SidebarItem | undefined>();
  onDidChangeTreeData = this._onDidChangeTreeData.event;

  private configStore: ConfigStore;
  private draftStore: DraftMappingStore;

  constructor(configStore: ConfigStore, draftStore: DraftMappingStore) {
    this.configStore = configStore;
    this.draftStore = draftStore;
  }

  /**
   * 刷新侧边栏
   */
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * 获取树节点
   */
  getTreeItem(element: SidebarItem): vscode.TreeItem {
    return element;
  }

  /**
   * 获取子节点
   */
  getChildren(element?: SidebarItem): Thenable<SidebarItem[]> {
    if (!element) {
      // 根节点：三个分组
      return Promise.resolve([
        new SidebarItem('快捷操作', vscode.TreeItemCollapsibleState.Collapsed, 'group-action'),
        new SidebarItem('设置', vscode.TreeItemCollapsibleState.Collapsed, 'group-setting'),
        new SidebarItem('已发布草稿', vscode.TreeItemCollapsibleState.Collapsed, 'group-draft')
      ]);
    }

    // 根据节点类型返回子节点
    switch (element.nodeType) {
      case 'group-action':
        return this.getActionChildren();

      case 'group-setting':
        return this.getSettingChildren();

      case 'group-draft':
        return this.getDraftChildren();

      case 'setting-group':
        return this.getSettingOptionChildren(element.label);

      default:
        return Promise.resolve([]);
    }
  }

  /**
   * 获取快捷操作子节点
   */
  private getActionChildren(): Promise<SidebarItem[]> {
    const items = getActionItems();
    return Promise.resolve(items.map(item => {
      const sidebarItem = new SidebarItem(
        item.label,
        vscode.TreeItemCollapsibleState.None,
        'action',
        item.commandId
      );
      sidebarItem.command = item.command;
      sidebarItem.tooltip = item.desc;
      sidebarItem.iconPath = item.iconPath;
      return sidebarItem;
    }));
  }

  /**
   * 获取设置子节点
   */
  private getSettingChildren(): Promise<SidebarItem[]> {
    return Promise.resolve([
      new SidebarItem('🎨 主题', vscode.TreeItemCollapsibleState.Collapsed, 'setting-group', 'theme'),
      new SidebarItem('🖍️ 主题色', vscode.TreeItemCollapsibleState.Collapsed, 'setting-group', 'color'),
      new SidebarItem('🔢 其他选项', vscode.TreeItemCollapsibleState.Collapsed, 'setting-group', 'toggle')
    ]);
  }

  /**
   * 获取设置选项子节点
   */
  private getSettingOptionChildren(groupLabel: string): Promise<SidebarItem[]> {
    if (groupLabel.includes('主题') && !groupLabel.includes('色')) {
      const currentTheme = this.configStore.getTheme();
      const items = getThemeOptions(currentTheme);
      return Promise.resolve(items.map(item => {
        const sidebarItem = new SidebarItem(
          item.label,
          vscode.TreeItemCollapsibleState.None,
          'setting-option',
          item.value
        );
        sidebarItem.command = item.command;
        return sidebarItem;
      }));
    }

    if (groupLabel.includes('主题色')) {
      const currentColor = this.configStore.getPrimaryColor();
      const items = getColorOptions(currentColor);
      return Promise.resolve(items.map(item => {
        const sidebarItem = new SidebarItem(
          item.label,
          vscode.TreeItemCollapsibleState.None,
          'setting-option',
          item.value
        );
        sidebarItem.command = item.command;
        return sidebarItem;
      }));
    }

    if (groupLabel.includes('其他')) {
      const config = {
        isMacCodeBlock: this.configStore.getMacCodeBlock(),
        countStatus: this.configStore.getCountStatus()
      };
      const items = getToggleOptions(config);
      return Promise.resolve(items.map(item => {
        const sidebarItem = new SidebarItem(
          item.label,
          vscode.TreeItemCollapsibleState.None,
          'setting-option',
          item.value,
          { key: item.value || '', checked: item.checked || false }
        );
        sidebarItem.command = item.command;
        return sidebarItem;
      }));
    }

    return Promise.resolve([]);
  }

  /**
   * 获取草稿列表子节点
   */
  private getDraftChildren(): Promise<SidebarItem[]> {
    const drafts = this.draftStore.getAll();

    if (drafts.length === 0) {
      return Promise.resolve([
        new SidebarItem('暂无已发布草稿', vscode.TreeItemCollapsibleState.None, 'draft-item')
      ]);
    }

    return Promise.resolve(drafts.map(draft => {
      const item = new SidebarItem(
        draft.title,
        vscode.TreeItemCollapsibleState.None,
        'draft-item',
        draft.mediaId,
        draft
      );
      item.tooltip = `文件: ${draft.filePath}\n发布时间: ${new Date(draft.updatedAt).toLocaleString()}`;
      item.command = {
        command: 'wechatPub.openDraft',
        title: '打开草稿',
        arguments: [draft.filePath]
      };
      return item;
    }));
  }
}