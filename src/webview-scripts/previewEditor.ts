/**
 * Preview 模式 WYSIWYG 编辑器
 * 实现所见即所得编辑功能，将 HTML 编辑转换为 Markdown
 */

import TurndownService from 'turndown';

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
 * 初始化 Turndown 服务
 * 配置 Markdown 转换规则
 */
function createTurndownService(): TurndownService {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });

  // 自定义规则：处理代码块
  turndown.addRule('codeBlock', {
    filter: (node: HTMLElement) => {
      return node.nodeName === 'PRE' && node.classList.contains('code__pre');
    },
    replacement: (content: string, node: HTMLElement) => {
      const codeEl = node.querySelector('code');
      const langClass = codeEl?.className || '';
      const lang = langClass.replace('language-', '') || '';
      const codeContent = codeEl?.textContent || content;
      return `\n\`\`\`${lang}\n${codeContent}\n\`\`\`\n`;
    },
  });

  // 自定义规则：处理 figure 图片
  turndown.addRule('figureImage', {
    filter: (node: HTMLElement) => {
      return node.nodeName === 'FIGURE' && node.querySelector('img') !== null;
    },
    replacement: (content: string, node: HTMLElement) => {
      const img = node.querySelector('img');
      const alt = img?.getAttribute('alt') || '';
      const src = img?.getAttribute('src') || '';
      const title = img?.getAttribute('title') || '';
      const figcaption = node.querySelector('figcaption');

      // 如果有 figcaption，将其作为 alt text
      const finalAlt = figcaption?.textContent || alt;
      const titlePart = title ? ` "${title}"` : '';

      return `![${finalAlt}](${src}${titlePart})\n`;
    },
  });

  // 自定义规则：处理 blockquote
  turndown.addRule('blockquote', {
    filter: 'blockquote',
    replacement: (content: string) => {
      // 清理内容，移除多余的段落标记
      const cleanContent = content.trim();
      const lines = cleanContent.split('\n');
      return lines.map(line => `> ${line.trim()}`).join('\n') + '\n';
    },
  });

  return turndown;
}

const turndown = createTurndownService();

/**
 * 存储原始 front-matter
 * 在转换时需要保留
 */
let frontMatterContent = '';

/**
 * 设置原始 Markdown 内容（用于保留 front-matter）
 * @param markdown 原始 Markdown 内容
 */
export function setOriginalMarkdown(markdown: string): void {
  // 提取 front-matter
  const frontMatterMatch = markdown.match(/^---\n[\s\S]*?\n---\n/);
  if (frontMatterMatch) {
    frontMatterContent = frontMatterMatch[0];
  } else {
    frontMatterContent = '';
  }
}

/**
 * 将 HTML 转换为 Markdown
 * @param html HTML 内容
 * @returns Markdown 内容
 */
function convertHtmlToMarkdown(html: string): string {
  try {
    let markdown = turndown.turndown(html);

    // 如果有 front-matter，添加到开头
    if (frontMatterContent) {
      // 确保不重复添加
      if (!markdown.startsWith('---\n')) {
        markdown = frontMatterContent + markdown;
      }
    }

    return markdown;
  } catch (error) {
    console.error('[wechatPub] HTML to Markdown conversion error:', error);
    return '';
  }
}

/**
 * 发送编辑内容到 VSCode
 * 使用防抖避免频繁更新
 */
const debouncedSendEdit = debounce((markdown: string) => {
  vscode.postMessage({
    type: 'editContent',
    content: markdown,
  });
}, 300);

/**
 * 处理元素 blur 事件
 * 将 preview 容器的 HTML 转换为 Markdown 并发送
 */
function handleElementBlur(): void {
  const previewContainer = document.getElementById('preview-container');
  if (!previewContainer) {
    return;
  }

  // 获取 HTML 内容
  const html = previewContainer.innerHTML;

  // 转换为 Markdown
  const markdown = convertHtmlToMarkdown(html);

  if (markdown) {
    debouncedSendEdit(markdown);
  }
}

/**
 * 为可编辑元素添加编辑功能
 * 只对简单元素（标题、段落）启用编辑
 */
function enableElementEditing(element: HTMLElement): void {
  // 设置为可编辑
  element.setAttribute('contenteditable', 'true');
  element.setAttribute('data-editable', 'true');

  // 监听 blur 事件
  element.addEventListener('blur', handleElementBlur);

  // 监听 input 事件（实时反馈，但使用防抖）
  element.addEventListener('input', debounce(handleElementBlur, 500));
}

/**
 * 设置 Preview 模式的 WYSIWYG 编辑
 * 为简单元素启用 contenteditable
 */
export function setupPreviewEditing(originalMarkdown?: string): void {
  // 设置原始 Markdown（用于保留 front-matter）
  if (originalMarkdown) {
    setOriginalMarkdown(originalMarkdown);
  }

  // 为标题和段落启用编辑
  const editableSelectors = 'h1, h2, h3, h4, h5, h6, p, li';
  const editableElements = document.querySelectorAll(editableSelectors);

  editableElements.forEach(el => {
    // 跳过特殊元素
    const htmlEl = el as HTMLElement;

    // 跳过脚注元素
    if (htmlEl.classList.contains('footnotes') ||
        htmlEl.closest('.footnotes')) {
      return;
    }

    // 跳过 blockquote 内的字数统计
    if (htmlEl.classList.contains('md-blockquote-p')) {
      return;
    }

    // 跳过 figcaption
    if (htmlEl.tagName === 'FIGCAPTION') {
      return;
    }

    // 启用编辑
    enableElementEditing(htmlEl);
  });

  // 代码块和表格不可编辑
  const nonEditableSelectors = 'pre, code, table, figure, blockquote';
  const nonEditableElements = document.querySelectorAll(nonEditableSelectors);

  nonEditableElements.forEach(el => {
    const htmlEl = el as HTMLElement;
    htmlEl.setAttribute('contenteditable', 'false');

    // 确保子元素也不可编辑
    htmlEl.querySelectorAll('*').forEach(child => {
      (child as HTMLElement).setAttribute('contenteditable', 'false');
    });
  });

  // 特殊处理 blockquote：只允许编辑其中的段落内容
  const blockquotes = document.querySelectorAll('blockquote');
  blockquotes.forEach(bq => {
    const bqEl = bq as HTMLElement;
    bqEl.setAttribute('contenteditable', 'false');

    // 允许编辑 blockquote 内的 p 元素（除了字数统计）
    bqEl.querySelectorAll('p').forEach(p => {
      const pEl = p as HTMLElement;
      if (!pEl.classList.contains('md-blockquote-p')) {
        enableElementEditing(pEl);
      }
    });
  });
}

/**
 * 清理编辑状态
 * 移除 contenteditable 和事件监听器
 */
export function cleanupPreviewEditing(): void {
  const editableElements = document.querySelectorAll('[data-editable="true"]');

  editableElements.forEach(el => {
    const htmlEl = el as HTMLElement;
    htmlEl.removeAttribute('contenteditable');
    htmlEl.removeAttribute('data-editable');

    // 移除事件监听器（blur 和 input）
    htmlEl.removeEventListener('blur', handleElementBlur);
  });
}

/**
 * 更新编辑内容
 * 当从外部（VSCode）接收到内容更新时调用
 * @param markdown 新的 Markdown 内容
 */
export function updateEditingContent(markdown: string): void {
  // 更新 front-matter
  setOriginalMarkdown(markdown);
}

/**
 * 导出函数供外部调用
 */
export { convertHtmlToMarkdown };