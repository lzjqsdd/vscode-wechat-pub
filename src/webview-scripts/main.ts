/**
 * Webview JavaScript 入口文件
 * 处理 Preview/Markdown 模式切换和消息通信
 * 支持 Preview 模式的 WYSIWYG 编辑
 */

import { vscode } from './vscode';
import { setupPreviewEditing, cleanupPreviewEditing, updateEditingContent } from './previewEditor';
import { debounce } from './utils';

/**
 * 模式类型定义
 */
type EditorMode = 'preview' | 'markdown';

/**
 * Webview 消息类型
 */
interface WebviewMessage {
  type: 'switchMode' | 'editContent' | 'updateContent';
  mode?: EditorMode;
  content?: string;
}

interface ExtensionMessage {
  type: 'updatePreview' | 'updateMarkdown' | 'switchMode' | 'initPreviewEditing';
  html?: string;
  markdown?: string;
  mode?: EditorMode;
}

/**
 * 切换编辑模式
 * @param newMode 目标模式
 */
function switchMode(newMode: EditorMode): void {
  // 如果切换到 preview 模式，先发送当前编辑内容
  if (newMode === 'preview') {
    const editor = document.getElementById('markdown-editor') as HTMLTextAreaElement;
    if (editor) {
      vscode.postMessage({
        type: 'updateContent',
        content: editor.value
      });
    }
  }

  vscode.postMessage({
    type: 'switchMode',
    mode: newMode
  });
}

/**
 * 初始化按钮事件
 */
function initButtonEvents(): void {
  // Preview 按钮点击事件
  const previewBtn = document.getElementById('btn-preview');
  if (previewBtn) {
    previewBtn.addEventListener('click', () => {
      switchMode('preview');
    });
  }

  // Markdown 按钮点击事件
  const markdownBtn = document.getElementById('btn-markdown');
  if (markdownBtn) {
    markdownBtn.addEventListener('click', () => {
      switchMode('markdown');
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
 * 更新 Preview 内容
 * HTML 内容已在 extension 端通过 DOMPurify 进行 XSS 防护
 * @param html 渲染后的 HTML（已 sanitizied）
 */
function updatePreviewContent(html: string): void {
  const previewContainer = document.getElementById('preview-container');
  if (previewContainer) {
    // HTML 已在 extension 端通过 DOMPurify 进行 XSS 防护
    previewContainer.innerHTML = html;
  }
}

/**
 * 更新 Markdown 编辑器内容
 * @param markdown Markdown 源码
 */
function updateMarkdownContent(markdown: string): void {
  const markdownEditor = document.getElementById('markdown-editor') as HTMLTextAreaElement;
  if (markdownEditor) {
    markdownEditor.value = markdown;
  }
}

/**
 * 更新切换开关 UI 状态
 * @param mode 当前模式
 */
function updateSwitchUI(mode: EditorMode): void {
  // toolbar 已移到 VSCode editor/title，这里不再需要更新
}

/**
 * 处理模式切换消息
 * @param message 扩展消息
 */
function handleSwitchModeMessage(message: ExtensionMessage): void {
  const wrapper = document.getElementById('content-wrapper');

  if (!wrapper) {
    console.log('[webview] content-wrapper 不存在');
    return;
  }

  console.log('[webview] 处理 switchMode 消息, mode:', message.mode);

  if (message.mode === 'preview') {
    // 切换到 Preview 模式
    console.log('[webview] 切换到 Preview 模式, html length:', message.html?.length);
    wrapper.innerHTML = `<div class="preview-container" id="preview-container">${message.html || ''}</div>`;
    // 启用 Preview 模式的 WYSIWYG 编辑
    setupPreviewEditing(message.markdown);
  } else {
    // 切换到 Markdown 模式
    console.log('[webview] 切换到 Markdown 模式');
    // 先清理 Preview 编辑状态
    cleanupPreviewEditing();
    wrapper.innerHTML = `<textarea class="markdown-editor" id="markdown-editor">${message.markdown || ''}</textarea>`;
    // 初始化 textarea 输入事件
    initTextareaEvents();
  }
}

/**
 * 监听来自 extension 的消息
 */
function setupMessageListener(): void {
  window.addEventListener('message', (event: MessageEvent) => {
    const message: ExtensionMessage = event.data;
    console.log('[webview] 收到消息:', message.type);

    switch (message.type) {
      case 'updatePreview':
        if (message.html) {
          console.log('[webview] updatePreview, html length:', message.html.length);
          updatePreviewContent(message.html);
          // 重新启用编辑
          setupPreviewEditing(message.markdown);
        }
        break;

      case 'updateMarkdown':
        if (message.markdown) {
          updateMarkdownContent(message.markdown);
          // 更新编辑内容
          updateEditingContent(message.markdown);
        }
        break;

      case 'switchMode':
        handleSwitchModeMessage(message);
        break;

      case 'initPreviewEditing':
        // 初始化 Preview 模式编辑
        if (message.markdown) {
          setupPreviewEditing(message.markdown);
        }
        break;
    }
  });
}

/**
 * 检查当前模式并初始化编辑
 */
function initEditMode(): void {
  // 检查当前模式（通过 DOM 判断）
  const previewContainer = document.getElementById('preview-container');
  const markdownEditor = document.getElementById('markdown-editor');

  if (previewContainer) {
    // 当前为 Preview 模式，启用 WYSIWYG 编辑
    // 从全局变量获取原始 Markdown（如果有）
    const originalMarkdown = (window as any).__originalMarkdown;
    setupPreviewEditing(originalMarkdown);
  } else if (markdownEditor) {
    // 当前为 Markdown 模式，初始化 textarea 事件
    initTextareaEvents();
  }
}

/**
 * 主入口
 */
function main(): void {
  initButtonEvents();
  initTextareaEvents();
  setupMessageListener();
  // 初始化编辑模式
  initEditMode();
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}