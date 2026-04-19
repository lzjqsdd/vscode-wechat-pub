/**
 * HTML 复制工具
 * 使用 juice 将 CSS 内联到 HTML，适用于微信公众号粘贴
 */

import juice from 'juice';

/**
 * 将 HTML 和 CSS 合并为内联样式格式
 * @param html 渲染后的 HTML 内容
 * @param css 主题 CSS 样式
 * @returns 内联样式后的 HTML
 */
export function copyWechatHtml(html: string, css: string): string {
  const wrapper = `<div id="output" style="padding:20px;background:white;">${html}</div>`;
  const fullHtml = `<style>${css}</style>${wrapper}`;

  return juice(fullHtml, {
    extraCss: css,
    preserveMediaQueries: false,
    preserveFontFaces: true,
    preservePseudos: false,
    removeStyleTags: true,
  });
}

/**
 * 生成完整的预览 HTML
 * @param html 渲染后的 HTML 内容
 * @param css 主题 CSS 样式
 * @returns 完整的预览 HTML 文档
 */
export function generatePreviewHtml(html: string, css: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    ${css}
  </style>
</head>
<body>
  <div id="output">
    <section class="container mx-auto">
      ${html}
    </section>
  </div>
</body>
</html>
  `.trim();
}