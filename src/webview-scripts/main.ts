/**
 * Webview JavaScript 入口文件
 * 处理 Preview/Markdown 模式切换和消息通信
 */

// VSCode Webview API
declare function acquireVsCodeApi(): {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
};

const vscode = acquireVsCodeApi();

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
  type: 'updatePreview' | 'updateMarkdown' | 'switchMode';
  html?: string;
  markdown?: string;
  mode?: EditorMode;
}

/**
 * 创建防抖函数
 * @param fn 要防抖的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
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
 * 处理模式切换消息
 * @param message 扩展消息
 * @param styles 样式配置（从页面注入）
 */
function handleSwitchModeMessage(message: ExtensionMessage, styles: {
  buttonActiveBg: string;
  buttonBg: string;
  buttonTextColor: string;
}): void {
  const wrapper = document.getElementById('content-wrapper');
  const toolbar = document.querySelector('.toolbar');

  if (!wrapper || !toolbar) {
    return;
  }

  const previewBtn = toolbar.querySelector('.preview-btn') as HTMLElement;
  const markdownBtn = toolbar.querySelector('.markdown-btn') as HTMLElement;

  if (message.mode === 'preview') {
    // 切换到 Preview 模式
    // HTML 已在 extension 端通过 DOMPurify 进行 XSS 防护
    wrapper.innerHTML = `<div class="preview-container" id="preview-container">${message.html || ''}</div>`;
    if (previewBtn) {
      previewBtn.style.background = styles.buttonActiveBg;
      previewBtn.style.color = '#ffffff';
    }
    if (markdownBtn) {
      markdownBtn.style.background = styles.buttonBg;
      markdownBtn.style.color = styles.buttonTextColor;
    }
    // 重新绑定事件
    initButtonEvents();
  } else {
    // 切换到 Markdown 模式
    wrapper.innerHTML = `<textarea class="markdown-editor" id="markdown-editor">${message.markdown || ''}</textarea>`;
    if (previewBtn) {
      previewBtn.style.background = styles.buttonBg;
      previewBtn.style.color = styles.buttonTextColor;
    }
    if (markdownBtn) {
      markdownBtn.style.background = styles.buttonActiveBg;
      markdownBtn.style.color = '#ffffff';
    }
    // 重新绑定事件（包括 textarea 输入事件）
    initButtonEvents();
    initTextareaEvents();
  }
}

/**
 * 监听来自 extension 的消息
 */
function setupMessageListener(): void {
  window.addEventListener('message', (event: MessageEvent) => {
    const message: ExtensionMessage = event.data;

    // 从全局变量获取样式配置
    const styles = (window as any).__webviewStyles || {
      buttonActiveBg: '#007acc',
      buttonBg: '#e0e0e0',
      buttonTextColor: '#333333'
    };

    switch (message.type) {
      case 'updatePreview':
        if (message.html) {
          updatePreviewContent(message.html);
        }
        break;

      case 'updateMarkdown':
        if (message.markdown) {
          updateMarkdownContent(message.markdown);
        }
        break;

      case 'switchMode':
        handleSwitchModeMessage(message, styles);
        break;
    }
  });
}

/**
 * 主入口
 */
function main(): void {
  initButtonEvents();
  initTextareaEvents();
  setupMessageListener();
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}