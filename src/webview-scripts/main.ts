/**
 * Webview JavaScript 入口文件
 * 处理 Preview 按钮点击、Markdown 编辑同步和滚动同步
 */

import { vscode } from './vscode';
import { debounce } from './utils';

/**
 * 解析 Markdown 标题行
 */
function parseMarkdownHeadingLine(line: string): { level: number; title: string } | null {
  if (!line.startsWith('#')) return null;

  let level = 0;
  while (level < line.length && line[level] === '#' && level < 6) {
    level++;
  }

  if (level === 0 || line[level] !== ' ') return null;

  const title = line.slice(level + 1).replace(/#+\s*$/, '').trim();
  if (!title) return null;

  return { level, title };
}

/**
 * 获取光标所在的语义信息（最近的标题）
 */
function getCursorContext(editor: HTMLTextAreaElement) {
  const text = editor.value;
  const cursorPos = editor.selectionStart;

  // 计算光标所在行号
  const textBeforeCursor = text.substring(0, cursorPos);
  const cursorLine = textBeforeCursor.split('\n').length;
  const lines = text.split('\n');
  const linesTotal = lines.length;

  // 从光标行向上查找最近的标题
  let heading: { level: number; title: string } | null = null;
  for (let i = cursorLine - 1; i >= 0; i--) {
    const parsed = parseMarkdownHeadingLine(lines[i]);
    if (parsed) {
      heading = parsed;
      break;
    }
  }

  return { heading, cursorLine, linesTotal };
}

/**
 * 更新 textarea 内容，同时保持光标位置
 * 通过计算新旧内容的差异，尽可能保持光标的相对位置
 */
function updateTextareaContent(editor: HTMLTextAreaElement, newContent: string): void {
  const oldContent = editor.value;

  // 如果内容相同，不需要更新
  if (oldContent === newContent) {
    return;
  }

  // 保存当前光标位置
  const oldCursorPos = editor.selectionStart;
  const oldScrollTop = editor.scrollTop;

  // 计算光标前的内容
  const textBeforeCursor = oldContent.substring(0, oldCursorPos);

  // 查找光标所在行在旧内容中的起始位置
  const lastNewlineBeforeCursor = textBeforeCursor.lastIndexOf('\n');
  const lineStartPos = lastNewlineBeforeCursor + 1;

  // 计算光标所在行的内容
  const currentLineContent = textBeforeCursor.substring(lineStartPos);

  // 计算光标所在的行号（从 1 开始）
  const cursorLineNumber = textBeforeCursor.split('\n').length;

  // 在新内容中找到对应行
  const newLines = newContent.split('\n');

  // 如果新内容的行数足够，尝试保持光标位置
  if (cursorLineNumber <= newLines.length) {
    // 计算新内容中对应行的起始位置
    let newLineStartPos = 0;
    for (let i = 0; i < cursorLineNumber - 1; i++) {
      newLineStartPos += newLines[i].length + 1; // +1 for newline
    }

    // 尝试保持光标在该行的相对位置
    const newLineContent = newLines[cursorLineNumber - 1] || '';
    const cursorOffsetInLine = currentLineContent.length;

    // 如果该行长度足够，保持相同偏移；否则放在行尾
    const newCursorPos = newLineStartPos + Math.min(cursorOffsetInLine, newLineContent.length);

    // 更新内容
    editor.value = newContent;

    // 恢复光标位置
    editor.selectionStart = newCursorPos;
    editor.selectionEnd = newCursorPos;

    // 尝试恢复滚动位置（按比例）
    const oldScrollRatio = oldScrollTop / (editor.scrollHeight - editor.clientHeight || 1);
    editor.scrollTop = oldScrollRatio * (editor.scrollHeight - editor.clientHeight || 0);
  } else {
    // 光标行号超出新内容范围，放在末尾
    editor.value = newContent;
    const newPos = newContent.length;
    editor.selectionStart = newPos;
    editor.selectionEnd = newPos;
  }
}

/**
 * 初始化按钮事件
 */
function initButtonEvents(): void {
  const previewBtn = document.getElementById('btn-open-preview');
  if (previewBtn) {
    previewBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'openSidePreview' });
    });
  }
}

/**
 * 初始化 Markdown 编辑器输入事件
 */
function initTextareaEvents(): void {
  const editor = document.getElementById('markdown-editor') as HTMLTextAreaElement;
  if (editor) {
    const debouncedSync = debounce(() => {
      vscode.postMessage({ type: 'editContent', content: editor.value });
    }, 300);

    editor.addEventListener('input', debouncedSync);
  }
}

/**
 * 初始化滚动同步事件
 * 滚动时即时比例同步，光标变化时语义校准
 */
function initScrollSync(): void {
  const editor = document.getElementById('markdown-editor') as HTMLTextAreaElement;
  if (editor) {
    let rafId: number | null = null;

    // 滚动事件：即时发送滚动比例
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const scrollTop = editor.scrollTop;
        const scrollHeight = editor.scrollHeight - editor.clientHeight;
        const ratio = scrollHeight > 0 ? scrollTop / scrollHeight : 0;

        vscode.postMessage({
          type: 'scrollSync',
          mode: 'scroll',
          ratio: ratio
        });
      });
    };

    // 光标变化事件：发送语义信息进行校准
    const onCursorChange = () => {
      const context = getCursorContext(editor);
      vscode.postMessage({
        type: 'scrollSync',
        mode: 'cursor',
        heading: context.heading,
        cursorLine: context.cursorLine,
        linesTotal: context.linesTotal
      });
    };

    // 监听滚动事件
    editor.addEventListener('scroll', onScroll);

    // 监听光标变化
    editor.addEventListener('click', onCursorChange);
    editor.addEventListener('keyup', onCursorChange);
  }
}

/**
 * 处理来自 VSCode 的消息
 */
function initMessageHandler(): void {
  window.addEventListener('message', (event) => {
    const message = event.data;

    if (message.type === 'updateContent') {
      const editor = document.getElementById('markdown-editor') as HTMLTextAreaElement;
      if (editor && message.content) {
        updateTextareaContent(editor, message.content);
      }
    }
  });
}

/**
 * 主入口
 */
function main(): void {
  initButtonEvents();
  initTextareaEvents();
  initScrollSync();
  initMessageHandler();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}