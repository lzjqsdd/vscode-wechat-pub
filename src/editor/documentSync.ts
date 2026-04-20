/**
 * 文档同步模块
 * 实现 Webview 编辑内容与 VSCode 文档的双向同步
 */

import * as vscode from 'vscode';

/**
 * 应用文档编辑
 * 使用 WorkspaceEdit 更新整个文档内容
 * @param document 目标文档
 * @param newContent 新内容
 * @returns 是否成功应用编辑（Thenable）
 */
export function applyDocumentEdit(
  document: vscode.TextDocument,
  newContent: string
): Thenable<boolean> {
  const edit = new vscode.WorkspaceEdit();

  // 计算完整文档范围
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length)
  );

  edit.replace(document.uri, fullRange, newContent);

  return vscode.workspace.applyEdit(edit);
}

/**
 * 创建防抖函数
 * @param fn 要防抖的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  return ((...args: Parameters<T>) => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = undefined;
    }, delay);
  }) as T;
}