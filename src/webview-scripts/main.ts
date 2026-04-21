/**
 * Webview JavaScript 入口文件
 * 处理 Preview 按钮点击（打开右侧分屏预览）和 Markdown 编辑同步
 */

import { vscode } from './vscode';
import { debounce } from './utils';

/**
 * Webview 消息类型
 */
interface WebviewMessage {
  type: 'editContent' | 'openSidePreview';
  content?: string;
}

/**
 * 初始化按钮事件
 * Preview 按钮点击后通知 extension 打开右侧分屏预览
 */
function initButtonEvents(): void {
  const previewBtn = document.getElementById('btn-open-preview');
  if (previewBtn) {
    previewBtn.addEventListener('click', () => {
      // 发送消息打开右侧分屏预览
      vscode.postMessage({
        type: 'openSidePreview'
      });
    });
  }
}

/**
 * 初始化 Markdown 编辑器输入事件
 * 使用 300ms 防抖同步编辑内容到 VSCode 文档
 */
function initTextareaEvents(): void {
  const editor = document.getElementById('markdown-editor') as HTMLTextAreaElement;
  if (editor) {
    // 创建防抖的编辑同步函数（300ms 延迟）
    const debouncedSync = debounce(() => {
      vscode.postMessage({
        type: 'editContent',
        content: editor.value
      });
    }, 300);

    editor.addEventListener('input', debouncedSync);
  }
}

/**
 * 主入口
 */
function main(): void {
  initButtonEvents();
  initTextareaEvents();
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}