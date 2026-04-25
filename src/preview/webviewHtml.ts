/**
 * Webview HTML 生成器
 * 生成用于 VSCode Webview 的 HTML 内容
 */

import * as vscode from 'vscode';

/**
 * 生成预览模式 HTML
 */
export function generatePreviewHtml(
  content: string,
  css: string,
  vscodeThemeKind: string = 'light',
  previewWidth: string = 'mobile',
  extensionUri?: vscode.Uri,
  webview?: vscode.Webview
): string {
  const isDark = vscodeThemeKind === 'dark' || vscodeThemeKind === 'high-contrast';
  const previewBg = isDark ? '#1e1e1e' : '#f5f5f5';
  const contentBg = isDark ? '#252526' : '#ffffff';

  const widthStyle = previewWidth === 'desktop' ? 'width:100%;max-width:800px;' : 'width:375px;';

  // CSP: 允许加载 webview 资源和内联样式
  const csp = webview
    ? `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'unsafe-inline';">`
    : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${csp}
  <style>${css}</style>
  <style>
    html, body {
      height: 100%;
      overflow: auto;
      scroll-behavior: auto;
    }
  </style>
</head>
<body style="background:${previewBg};padding:20px;overflow:auto;">
  <div id="output" style="${widthStyle}margin:auto;padding:20px;background:${contentBg};border-radius:8px;box-sizing:border-box;">
    ${content}
  </div>
  <script>
    const vscode = acquireVsCodeApi();

    // 辅助函数：规范化文本
    function normalizeText(text) {
      return text.replace(/\\s+/g, ' ').trim();
    }

    // 滚动同步处理
    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.type === 'syncScroll') {
        const output = document.getElementById('output');
        const body = document.body;

        // 滚动模式：即时按比例滚动
        if (message.mode === 'scroll' && message.ratio !== undefined) {
          const maxScrollTop = body.scrollHeight - body.clientHeight;
          const targetScrollTop = Math.max(0, maxScrollTop * message.ratio);
          body.scrollTop = targetScrollTop;
          return;
        }

        // 光标模式：语义定位校准
        if (message.mode === 'cursor' && message.heading) {
          const { level, title } = message.heading;
          const headings = output.querySelectorAll('h1, h2, h3, h4, h5, h6');
          const normalizedTitle = normalizeText(title);

          for (const h of headings) {
            const hLevel = parseInt(h.tagName.slice(1));
            if (hLevel !== level) continue;
            const hText = normalizeText(h.textContent);
            if (hText === normalizedTitle || hText.includes(normalizedTitle) || normalizedTitle.includes(hText)) {
              const targetTop = h.offsetTop - 20;
              body.scrollTop = Math.max(0, targetTop);
              return;
            }
          }
        }

        // 如果没有找到标题，使用行比例定位
        if (message.mode === 'cursor' && message.cursorLine && message.linesTotal) {
          const ratio = message.cursorLine / message.linesTotal;
          const maxScrollTop = body.scrollHeight - body.clientHeight;
          body.scrollTop = Math.max(0, maxScrollTop * ratio);
        }
      }
    });
  </script>
</body>
</html>`;
}

/**
 * 生成 Markdown 编辑模式 HTML
 */
export function generateMarkdownHtml(
  markdown: string,
  css: string,
  vscodeThemeKind: string = 'light',
  extensionUri: vscode.Uri,
  webview: vscode.Webview
): string {
  const isDark = vscodeThemeKind === 'dark' || vscodeThemeKind === 'high-contrast';
  const editorBg = isDark ? '#1e1e1e' : '#ffffff';
  const textColor = isDark ? '#d4d4d4' : '#333333';

  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'main.js')
  );

  const escapedMarkdown = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';">
  <style>
    body {
      background: ${editorBg};
      margin: 0;
      padding: 0;
    }
    .markdown-editor {
      width: 100%;
      height: 100vh;
      padding: 16px;
      box-sizing: border-box;
      border: none;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 14px;
      line-height: 1.6;
      resize: none;
      background: ${editorBg};
      color: ${textColor};
      outline: none;
    }
  </style>
</head>
<body>
  <textarea class="markdown-editor" id="markdown-editor">${escapedMarkdown}</textarea>
  <script>
    const vscode = acquireVsCodeApi();
    const editor = document.getElementById('markdown-editor');

    // 防抖发送编辑内容
    let timeout;
    editor.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        vscode.postMessage({
          type: 'editContent',
          content: editor.value
        });
      }, 300);
    });
  </script>
</body>
</html>`;
}