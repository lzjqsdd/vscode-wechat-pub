/**
 * 文件装饰器
 * 为已上传图片显示 sync 图标
 */

import * as vscode from 'vscode';
import { ImageRegistry } from '../storage/imageRegistry';

export class ImageFileDecorationProvider implements vscode.FileDecorationProvider {
  private imageRegistry: ImageRegistry;

  private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
  onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  constructor(imageRegistry: ImageRegistry) {
    this.imageRegistry = imageRegistry;

    // 监听 ImageRegistry 变化，触发装饰更新
    this.imageRegistry.onDidChange(() => {
      const uris = this.imageRegistry.getAll()
        .map(img => this.imageRegistry.getAbsolutePath(img.localPath))
        .filter((p): p is string => p !== undefined)
        .map(p => vscode.Uri.file(p));

      if (uris.length > 0) {
        this._onDidChangeFileDecorations.fire(uris);
      }
    });
  }

  provideFileDecoration(uri: vscode.Uri): vscode.ProviderResult<vscode.FileDecoration> {
    // 检查文件是否已上传
    if (!this.imageRegistry.isUploaded(uri.fsPath)) {
      return undefined;
    }

    // 返回装饰信息
    return {
      badge: '✓',
      tooltip: '已上传到公众号',
      color: new vscode.ThemeColor('charts.green')
    };
  }
}