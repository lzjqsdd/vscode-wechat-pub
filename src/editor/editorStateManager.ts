/**
 * 编辑器模式状态管理
 * 使用 workspaceState 存储每个文档的编辑模式（preview 或 markdown）
 */

import * as vscode from 'vscode';

export type EditorMode = 'preview' | 'markdown';

/**
 * 编辑器状态管理类
 * 管理每个文档的编辑模式状态
 */
export class EditorStateManager {
  private readonly stateKey = 'editorModes';

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * 获取文档的编辑模式
   * @param documentUri 文档 URI
   * @returns 编辑模式，默认为 'markdown'
   */
  getMode(documentUri: vscode.Uri): EditorMode {
    const modes = this.context.workspaceState.get<Record<string, EditorMode>>(this.stateKey, {});
    return modes[documentUri.toString()] || 'markdown';
  }

  /**
   * 设置文档的编辑模式
   * @param documentUri 文档 URI
   * @param mode 编辑模式
   */
  setMode(documentUri: vscode.Uri, mode: EditorMode): void {
    const modes = this.context.workspaceState.get<Record<string, EditorMode>>(this.stateKey, {});
    modes[documentUri.toString()] = mode;
    this.context.workspaceState.update(this.stateKey, modes);
  }

  /**
   * 清除文档的编辑模式状态
   * @param documentUri 文档 URI
   */
  clearMode(documentUri: vscode.Uri): void {
    const modes = this.context.workspaceState.get<Record<string, EditorMode>>(this.stateKey, {});
    delete modes[documentUri.toString()];
    this.context.workspaceState.update(this.stateKey, modes);
  }
}