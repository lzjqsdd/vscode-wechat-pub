/**
 * Webview HTML 生成器
 * 生成用于 VSCode Webview 的 HTML 内容
 */

/**
 * 生成 Webview HTML
 * @param content 渲染后的 HTML 内容
 * @param css CSS 样式
 * @returns 完整的 HTML 文档字符串
 */
export function generateWebviewHtml(content: string, css: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${css}</style>
</head>
<body style="background:#f5f5f5;">
  <div id="output" style="width:375px;margin:auto;padding:20px;background:white;">
    ${content}
  </div>
</body>
</html>`;
}