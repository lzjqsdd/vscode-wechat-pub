/**
 * 图片 Tree View 节点定义
 */

import * as vscode from 'vscode';
import { ImageRecord } from '../storage/imageRegistry';

export type ImageNodeType = 'group-images' | 'image-item';

export class ImageItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly nodeType: ImageNodeType,
    public readonly record?: ImageRecord,
    public readonly absolutePath?: string
  ) {
    super(label, collapsibleState);
    this.contextValue = nodeType;

    if (nodeType === 'image-item' && record) {
      // 图片节点设置
      this.tooltip = `本地: ${record.localPath}\nURL: ${record.wechatUrl}\n上传: ${this.formatTime(record.uploadTime)}`;
      this.description = this.formatTime(record.uploadTime);
      this.iconPath = new vscode.ThemeIcon('image');

      // 点击行为：打开本地文件
      if (absolutePath) {
        this.command = {
          command: 'wechatPub.openImageFile',
          title: '打开图片',
          arguments: [absolutePath]
        };
      }
    } else if (nodeType === 'group-images') {
      // 分组节点
      this.iconPath = new vscode.ThemeIcon('folder');
    }
  }

  private formatTime(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN');
  }
}