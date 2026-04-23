/**
 * HTML 复制工具
 * 使用 juice 将 CSS 内联到 HTML，适用于微信公众号粘贴
 */

import juice from 'juice';

/**
 * 将 CSS 变量展开为实际值
 * juice 无法处理 CSS 变量，需要预先替换
 */
function expandCssVariables(css: string, html: string): { css: string; html: string } {
  // 提取 CSS 变量定义
  const variableRegex = /--([a-zA-Z0-9-]+):\s*([^;]+);/g;
  const variables: Record<string, string> = {};

  let match;
  while ((match = variableRegex.exec(css)) !== null) {
    variables[`--${match[1]}`] = match[2].trim();
  }

  // 替换 CSS 中的变量引用
  let expandedCss = css;
  for (const [name, value] of Object.entries(variables)) {
    // 替换 var(--name) 为实际值
    const varPattern = new RegExp('var\\(' + name + '\\)', 'g');
    expandedCss = expandedCss.replace(varPattern, value);
  }

  // 删除 :root 定义块
  expandedCss = expandedCss.replace(/:root\s*\{[^}]*\}/g, '');

  // 替换 HTML 中的内联变量引用
  let expandedHtml = html;
  for (const [name, value] of Object.entries(variables)) {
    const varPattern = new RegExp('var\\(' + name + '\\)', 'g');
    expandedHtml = expandedHtml.replace(varPattern, value);
  }

  return { css: expandedCss, html: expandedHtml };
}

/**
 * 将 HTML 和 CSS 合并为内联样式格式
 * @param html 渲染后的 HTML 内容
 * @param css 主题 CSS 样式
 * @returns 内联样式后的 HTML
 */
export function copyWechatHtml(html: string, css: string): string {
  // 展开 CSS 变量
  const { css: expandedCss, html: expandedHtml } = expandCssVariables(css, html);

  // 使用与预览一致的包装结构
  const wrapper = `<section class="container mx-auto" style="padding:20px;background:white;">${expandedHtml}</section>`;
  const fullHtml = `<style>${expandedCss}</style>${wrapper}`;

  return juice(fullHtml, {
    extraCss: expandedCss,
    preserveMediaQueries: false,
    preserveFontFaces: true,
    preservePseudos: true,  // 保留伪元素样式（Mac 代码块圆点等）
    removeStyleTags: true,
  });
}