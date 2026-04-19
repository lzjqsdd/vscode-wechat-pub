/**
 * Webview HTML 生成器
 * 生成用于 VSCode Webview 的 HTML 内容
 */

/**
 * 生成 Webview HTML
 * @param content 渲染后的 HTML 内容
 * @param css CSS 样式
 * @param vscodeThemeKind VSCode 颜色主题类型
 * @param previewWidth 预览宽度模式 ('mobile' 或 'desktop')
 * @returns 完整的 HTML 文档字符串
 */
export function generateWebviewHtml(
  content: string,
  css: string,
  vscodeThemeKind: string = 'light',
  previewWidth: string = 'mobile'
): string {
  const isDark = vscodeThemeKind === 'dark' || vscodeThemeKind === 'high-contrast';
  const previewBg = isDark ? '#1e1e1e' : '#f5f5f5';
  const contentBg = isDark ? '#252526' : '#ffffff';

  // 根据预览模式设置容器宽度
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