/**
 * 侧边栏 TreeDataProvider
 * 提供多层级快捷操作面板：
 * - 快捷操作（发布、复制、更新）
 * - 设置（排版主题、代码块、段落排版、字体字号）
 * - 已发布草稿列表
 */

import * as vscode from 'vscode';
import { ConfigStore } from '../storage/configStore';
import { DraftMappingStore, DraftMapping } from '../storage/draftMapping';
import { getActionItems, ActionItem } from './actionItems';
import {
  SettingItem,
  SETTING_GROUPS,
  getThemeOptions,
  getColorOptions,
  getCodeBlockThemeOptions,
  getLegendOptions,
  getFontFamilyOptions,
  getFontSizeOptions,
  getCodeBlockToggleOptions,
  getParagraphToggleOptions
} from './settingItems';

/**
 * 节点类型
 */
type NodeType = 'group-action' | 'group-setting' | 'group-draft'
  | 'action' | 'setting-group' | 'setting-subgroup' | 'setting-option' | 'draft-item';

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
      // setting-group 不设置图标，让 VSCode 自动显示展开/折叠符号
      case 'setting-subgroup':
        return undefined;
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
        return this.getSettingSubgroupChildren(element);

      case 'setting-subgroup':
        return this.getSettingOptionChildren(element.value || '');

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
   * 获取设置子节点（一级分组）
   */
  private getSettingChildren(): Promise<SidebarItem[]> {
    return Promise.resolve(SETTING_GROUPS.map(group =>
      new SidebarItem(
        group.label,
        vscode.TreeItemCollapsibleState.Collapsed,
        'setting-group',
        group.key
      )
    ));
  }

  /**
   * 获取设置二级分组子节点
   */
  private getSettingSubgroupChildren(element: SidebarItem): Promise<SidebarItem[]> {
    const groupKey = element.value || '';
    const group = SETTING_GROUPS.find(g => g.key === groupKey);

    if (!group) {
      return Promise.resolve([]);
    }

    // 根据分组类型返回对应的选项分组
    const children: SidebarItem[] = [];

    for (const childKey of group.children) {
      switch (childKey) {
        case 'theme':
          children.push(new SidebarItem('主题', vscode.TreeItemCollapsibleState.Collapsed, 'setting-subgroup', 'theme'));
          break;
        case 'color':
          children.push(new SidebarItem('主题色', vscode.TreeItemCollapsibleState.Collapsed, 'setting-subgroup', 'color'));
          break;
        case 'codeBlockTheme':
          children.push(new SidebarItem('代码块主题', vscode.TreeItemCollapsibleState.Collapsed, 'setting-subgroup', 'codeBlockTheme'));
          break;
        case 'legend':
          children.push(new SidebarItem('图注格式', vscode.TreeItemCollapsibleState.Collapsed, 'setting-subgroup', 'legend'));
          break;
        case 'codeBlockToggles':
          // 直接返回选项，不需要二级分组
          return this.getCodeBlockToggleChildren();
        case 'paragraphToggles':
          // 直接返回选项，不需要二级分组
          return this.getParagraphToggleChildren();
        case 'fontFamily':
          children.push(new SidebarItem('字体', vscode.TreeItemCollapsibleState.Collapsed, 'setting-subgroup', 'fontFamily'));
          break;
        case 'fontSize':
          children.push(new SidebarItem('字号', vscode.TreeItemCollapsibleState.Collapsed, 'setting-subgroup', 'fontSize'));
          break;
      }
    }

    return Promise.resolve(children);
  }

  /**
   * 获取设置选项子节点
   */
  private getSettingOptionChildren(subgroupKey: string): Promise<SidebarItem[]> {
    switch (subgroupKey) {
      case 'theme':
        return this.getThemeOptionChildren();
      case 'color':
        return this.getColorOptionChildren();
      case 'codeBlockTheme':
        return this.getCodeBlockThemeOptionChildren();
      case 'legend':
        return this.getLegendOptionChildren();
      case 'fontFamily':
        return this.getFontFamilyOptionChildren();
      case 'fontSize':
        return this.getFontSizeOptionChildren();
      default:
        return Promise.resolve([]);
    }
  }

  /**
   * 获取主题选项子节点
   */
  private getThemeOptionChildren(): Promise<SidebarItem[]> {
    const currentTheme = this.configStore.getTheme();
    const items = getThemeOptions(currentTheme);
    return Promise.resolve(items.map(item => {
      const sidebarItem = new SidebarItem(
        item.label,
        vscode.TreeItemCollapsibleState.None,
        'setting-option',
        item.value,
        { key: 'theme', checked: item.checked || false }
      );
      sidebarItem.command = item.command;
      return sidebarItem;
    }));
  }

  /**
   * 获取颜色选项子节点
   */
  private getColorOptionChildren(): Promise<SidebarItem[]> {
    const currentColor = this.configStore.getPrimaryColor();
    const items = getColorOptions(currentColor);
    return Promise.resolve(items.map(item => {
      const sidebarItem = new SidebarItem(
        item.label,
        vscode.TreeItemCollapsibleState.None,
        'setting-option',
        item.value,
        { key: 'color', checked: item.checked || false }
      );
      sidebarItem.command = item.command;
      return sidebarItem;
    }));
  }

  /**
   * 获取代码块主题选项子节点
   */
  private getCodeBlockThemeOptionChildren(): Promise<SidebarItem[]> {
    const currentTheme = this.configStore.getCodeBlockTheme();
    const items = getCodeBlockThemeOptions(currentTheme);
    return Promise.resolve(items.map(item => {
      const sidebarItem = new SidebarItem(
        item.label,
        vscode.TreeItemCollapsibleState.None,
        'setting-option',
        item.value,
        { key: 'codeBlockTheme', checked: item.checked || false }
      );
      sidebarItem.command = item.command;
      return sidebarItem;
    }));
  }

  /**
   * 获取图注格式选项子节点
   */
  private getLegendOptionChildren(): Promise<SidebarItem[]> {
    const currentLegend = this.configStore.getLegend();
    const items = getLegendOptions(currentLegend);
    return Promise.resolve(items.map(item => {
      const sidebarItem = new SidebarItem(
        item.label,
        vscode.TreeItemCollapsibleState.None,
        'setting-option',
        item.value,
        { key: 'legend', checked: item.checked || false }
      );
      sidebarItem.command = item.command;
      return sidebarItem;
    }));
  }

  /**
   * 获取字体选项子节点
   */
  private getFontFamilyOptionChildren(): Promise<SidebarItem[]> {
    const currentFont = this.configStore.getFontFamily();
    const items = getFontFamilyOptions(currentFont);
    return Promise.resolve(items.map(item => {
      const sidebarItem = new SidebarItem(
        item.label,
        vscode.TreeItemCollapsibleState.None,
        'setting-option',
        item.value,
        { key: 'fontFamily', checked: item.checked || false }
      );
      sidebarItem.command = item.command;
      return sidebarItem;
    }));
  }

  /**
   * 获取字号选项子节点
   */
  private getFontSizeOptionChildren(): Promise<SidebarItem[]> {
    const currentSize = this.configStore.getFontSize();
    const items = getFontSizeOptions(currentSize);
    return Promise.resolve(items.map(item => {
      const sidebarItem = new SidebarItem(
        item.label,
        vscode.TreeItemCollapsibleState.None,
        'setting-option',
        item.value,
        { key: 'fontSize', checked: item.checked || false }
      );
      sidebarItem.command = item.command;
      return sidebarItem;
    }));
  }

  /**
   * 获取代码块开关选项子节点（直接返回，无二级分组）
   */
  private getCodeBlockToggleChildren(): Promise<SidebarItem[]> {
    const config = {
      isMacCodeBlock: this.configStore.getMacCodeBlock(),
      isShowLineNumber: this.configStore.getShowLineNumber()
    };
    const items = getCodeBlockToggleOptions(config);
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

  /**
   * 获取段落排版开关选项子节点（直接返回，无二级分组）
   */
  private getParagraphToggleChildren(): Promise<SidebarItem[]> {
    const config = {
      isUseIndent: this.configStore.getUseIndent(),
      isUseJustify: this.configStore.getUseJustify(),
      countStatus: this.configStore.getCountStatus(),
      isCiteStatus: this.configStore.getCiteStatus()
    };
    const items = getParagraphToggleOptions(config);
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