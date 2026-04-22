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
 * 主入口
 */
function main(): void {
  initButtonEvents();
  initTextareaEvents();
  initScrollSync();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}