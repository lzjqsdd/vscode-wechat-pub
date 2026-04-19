/**
 * 侧边栏 TreeDataProvider
 * 显示已发布的草稿列表，支持点击打开本地文件
 */

import * as vscode from 'vscode';
import { DraftMappingStore, DraftMapping } from '../storage/draftMapping';

/**
 * 草稿列表项
 */
class DraftItem extends vscode.TreeItem {
  constructor(
    public readonly title: string,
    public readonly filePath: string,
    public readonly mediaId: string
  ) {
    super(title, vscode.TreeItemCollapsibleState.None);
    this.tooltip = filePath;
    this.contextValue = 'draftItem';
    this.command = {
      command: 'wechatPub.openDraft',
      title: '打开文件',
      arguments: [filePath]
    };
  }
}

/**
 * 侧边栏 Provider
 * 管理草稿列表的显示和刷新
 */
export class SidebarProvider implements vscode.TreeDataProvider<DraftItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<DraftItem | undefined>();
  onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private draftStore: DraftMappingStore) {}

  /**
   * 获取 TreeItem
   */
  getTreeItem(element: DraftItem): vscode.TreeItem {
    return element;
  }

  /**
   * 获取子节点
   */
  getChildren(): Thenable<DraftItem[]> {
    const drafts = this.draftStore.getAll();
    return Promise.resolve(
      drafts.map(d => new DraftItem(d.title, d.filePath, d.mediaId))
    );
  }

  /**
   * 刷新侧边栏
   */
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}