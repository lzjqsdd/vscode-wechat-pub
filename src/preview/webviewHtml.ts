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
  previewWidth: string = 'mobile'
): string {
  const isDark = vscodeThemeKind === 'dark' || vscodeThemeKind === 'high-contrast';
  const previewBg = isDark ? '#1e1e1e' : '#f5f5f5';
  const contentBg = isDark ? '#252526' : '#ffffff';

  const widthStyle = previewWidth === 'desktop' ? 'width:100%;max-width:800px;' : 'width:375px;';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${css}</style>
</head>
<body style="background:${previewBg};padding:20px;">
  <div id="output" style="${widthStyle}margin:auto;padding:20px;background:${contentBg};border-radius:8px;box-sizing:border-box;">
    ${content}
  </div>
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