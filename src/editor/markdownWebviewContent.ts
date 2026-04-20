/**
 * Markdown 模式 Webview 内容生成器
 * 生成用于 Custom Editor 的 Markdown 模式 HTML 内容
 */

import * as vscode from 'vscode';
import { ConfigStore } from '../storage/configStore';

/**
 * 获取 VSCode 颜色主题类型
 */
function getVSCodeThemeKind(): string {
  const kind = vscode.window.activeColorTheme.kind;
  switch (kind) {
    case vscode.ColorThemeKind.Light:
      return 'light';
    case vscode.ColorThemeKind.Dark:
      return 'dark';
    case vscode.ColorThemeKind.HighContrast:
      return 'high-contrast';
    case vscode.ColorThemeKind.HighContrastLight:
      return 'high-contrast-light';
    default:
      return 'light';
  }
}

/**
 * 转义 HTML 用于 textarea 内容
 * 包含引号转义以防止 XSS 攻击
 */
export function escapeHtmlForTextarea(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 生成 Markdown 模式的 HTML
 * @param webview Webview 实例
 * @param extensionUri 扩展 URI
 * @param markdown Markdown 源码
 * @param configStore 配置存储
 * @returns HTML 字符串
 */
export function getMarkdownWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  markdown: string,
  configStore: ConfigStore
): string {
  // 获取编译后的脚本 URI
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'main.js')
  );

  // 获取 VSCode 主题类型
  const vscodeThemeKind = getVSCodeThemeKind();
  const isDark = vscodeThemeKind === 'dark' || vscodeThemeKind === 'high-contrast';

  // 主题颜色
  const toolbarBg = isDark ? '#333333' : '#ffffff';
  const buttonActiveBg = isDark ? '#0e639c' : '#007acc';
  const buttonBg = isDark ? '#454545' : '#e0e0e0';
  const buttonTextColor = isDark ? '#ffffff' : '#333333';
  const contentBg = isDark ? '#252526' : '#ffffff';
  const editorTextColor = isDark ? '#d4d4d4' : '#333333';
  const borderColor = isDark ? '#3c3c3c' : '#e0e0e0';

  // 转义 Markdown 内容
  const escapedContent = escapeHtmlForTextarea(markdown);

  // CSP 配置
  const cspSource = webview.cspSource;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${cspSource}; style-src ${cspSource} 'unsafe-inline';">
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 0;
      margin: 0;
      background: ${contentBg};
    }

    /* 工具栏样式 */
    .toolbar {
      position: sticky;
      top: 0;
      display: flex;
      justify-content: center;
      padding: 8px 16px;
      background: ${toolbarBg};
      border-bottom: 1px solid ${borderColor};
      z-index: 100;
    }

    .toolbar-btn {
      padding: 6px 16px;
      margin: 0 4px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      transition: background-color 0.2s;
    }

    .toolbar-btn.preview-btn {
      background: ${buttonBg};
      color: ${buttonTextColor};
    }

    .toolbar-btn.markdown-btn {
      background: ${buttonActiveBg};
      color: #ffffff;
    }

    .toolbar-btn:hover {
      opacity: 0.9;
    }

    /* Markdown 编辑器样式 */
    .markdown-editor {
      width: 100%;
      height: calc(100vh - 50px);
      padding: 16px;
      box-sizing: border-box;
      border: none;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 14px;
      line-height: 1.6;
      resize: none;
      background: ${contentBg};
      color: ${editorTextColor};
    }

    .markdown-editor:focus {
      outline: none;
    }
  </style>
</head>
<body>
  <!-- 工具栏 -->
  <div class="toolbar">
    <button id="btn-preview" class="toolbar-btn preview-btn">Preview</button>
    <button id="btn-markdown" class="toolbar-btn markdown-btn">Markdown</button>
  </div>

  <!-- Markdown 编辑器 -->
  <textarea class="markdown-editor" id="markdown-editor">${escapedContent}</textarea>

  <!-- 注入样式配置供脚本使用 -->
  <script>
    window.__webviewStyles = {
      buttonActiveBg: '${buttonActiveBg}',
      buttonBg: '${buttonBg}',
      buttonTextColor: '${buttonTextColor}'
    };
  </script>

  <!-- Webview 脚本 -->
  <script src="${scriptUri}"></script>
</body>
</html>`;
}