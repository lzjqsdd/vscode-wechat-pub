/**
 * Preview 模式 Webview 内容生成器
 * 生成用于 Custom Editor 的 Preview 模式 HTML 内容
 */

import * as vscode from 'vscode';
import { EditorMode } from './editorStateManager';
import { renderMarkdown } from '../core/renderer';
import { ThemeManager, ThemeName } from '../preview/themeManager';
import { ConfigStore } from '../storage/configStore';
import { escapeHtmlForTextarea } from './markdownWebviewContent';

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
 * 生成 Preview 模式的 HTML
 * @param webview Webview 实例
 * @param extensionUri 扩展 URI
 * @param document 文档
 * @param mode 当前模式
 * @param configStore 配置存储
 * @param themeManager 主题管理器
 * @returns HTML 字符串
 */
export function getPreviewWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  document: vscode.TextDocument,
  mode: EditorMode,
  configStore: ConfigStore,
  themeManager: ThemeManager
): string {
  // 获取编译后的脚本 URI
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'main.js')
  );

  // 获取文档内容
  const content = document.getText();

  // 渲染 Markdown（DOMPurify 已在 renderer 中进行 XSS 防护）
  let html: string;
  try {
    const result = renderMarkdown(content, {
      countStatus: configStore.getCountStatus(),
      isMacCodeBlock: configStore.getMacCodeBlock(),
      citeStatus: configStore.getCiteStatus(),
      legend: configStore.getLegend(),
    });
    html = result.html;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    html = `<div style="color: red; padding: 20px;">
      <h3>渲染错误</h3>
      <p>${escapeHtmlForTextarea(errorMessage)}</p>
    </div>`;
  }

  // 获取主题和颜色配置
  const theme = configStore.getTheme() as ThemeName;
  const color = configStore.getPrimaryColor();
  const vscodeThemeKind = getVSCodeThemeKind();
  const css = themeManager.getThemeCSS(theme, color, vscodeThemeKind, {
    fontFamily: configStore.getFontFamily(),
    fontSize: configStore.getFontSize(),
    useIndent: configStore.getUseIndent(),
    useJustify: configStore.getUseJustify(),
  });

  // 预览宽度模式
  const previewWidth = configStore.getPreviewWidth();
  const widthStyle = previewWidth === 'desktop' ? 'width:100%;max-width:800px;' : 'width:375px;';

  // 主题背景色
  const isDark = vscodeThemeKind === 'dark' || vscodeThemeKind === 'high-contrast';
  const previewBg = isDark ? '#1e1e1e' : '#f5f5f5';
  const contentBg = isDark ? '#252526' : '#ffffff';
  const toolbarBg = isDark ? '#333333' : '#ffffff';
  const buttonActiveBg = isDark ? '#0e639c' : '#007acc';
  const buttonBg = isDark ? '#454545' : '#e0e0e0';
  const buttonTextColor = isDark ? '#ffffff' : '#333333';
  const borderColor = isDark ? '#3c3c3c' : '#e0e0e0';

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
    ${css}

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
      background: ${mode === 'preview' ? buttonActiveBg : buttonBg};
      color: ${mode === 'preview' ? '#ffffff' : buttonTextColor};
    }

    .toolbar-btn.markdown-btn {
      background: ${mode === 'markdown' ? buttonActiveBg : buttonBg};
      color: ${mode === 'markdown' ? '#ffffff' : buttonTextColor};
    }

    .toolbar-btn:hover {
      opacity: 0.9;
    }

    /* 内容区域样式 */
    .content-wrapper {
      background: ${previewBg};
      padding: 20px;
      min-height: calc(100vh - 50px);
    }

    .preview-container {
      ${widthStyle}
      margin: auto;
      padding: 20px;
      background: ${contentBg};
      border-radius: 8px;
      box-sizing: border-box;
    }

    /* Markdown 编辑模式样式 */
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
      color: ${isDark ? '#d4d4d4' : '#333333'};
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

  <!-- 内容区域 -->
  <div class="content-wrapper" id="content-wrapper">
    ${mode === 'preview' ? `
      <div class="preview-container" id="preview-container">
        ${html}
      </div>
    ` : `
      <textarea class="markdown-editor" id="markdown-editor">${escapeHtmlForTextarea(content)}</textarea>
    `}
  </div>

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