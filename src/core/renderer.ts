/**
 * Markdown 渲染器
 * 支持 front-matter 解析、代码高亮、Mac 风格代码块、字数统计、XSS 防护
 */

import { marked } from 'marked';
import frontMatter from 'front-matter';
import hljs from 'highlight.js';
import DOMPurify from 'isomorphic-dompurify';

export interface RenderOptions {
  countStatus?: boolean;    // 显示字数统计
  isMacCodeBlock?: boolean; // Mac 风格代码块
  citeStatus?: boolean;     // 显示引用链接
  legend?: string;          // 图片说明文字转换规则
  themeMode?: string;       // 主题模式
}

export interface RenderResult {
  html: string;
  yamlData: Record<string, any>;
  wordCount: number;
  readTime: number;
}

// 注册常用语言
const COMMON_LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'css', 'json', 'bash', 'xml', 'yaml', 'markdown', 'sql', 'shell'];

COMMON_LANGUAGES.forEach(lang => {
  try {
    hljs.registerLanguage(lang, require(`highlight.js/lib/languages/${lang}`));
  } catch (e) {
    // 语言未找到，忽略
  }
});

// 正则表达式
const AMPERSAND_REGEX = /&/g;
const LESS_THAN_REGEX = /</g;
const GREATER_THAN_REGEX = />/g;
const DOUBLE_QUOTE_REGEX = /"/g;
const SINGLE_QUOTE_REGEX = /'/g;
const BACKTICK_REGEX = /`/g;
const UNDERSCORE_REGEX = /_/g;
const HEADING_TAG_REGEX = /^h\d$/;
const PARAGRAPH_WRAPPER_REGEX = /^<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/;
const MP_WEIXIN_LINK_REGEX = /^https?:\/\/mp\.weixin\.qq\.com/;

function escapeHtml(text: string): string {
  return text
    .replace(AMPERSAND_REGEX, '&amp;')
    .replace(LESS_THAN_REGEX, '&lt;')
    .replace(GREATER_THAN_REGEX, '&gt;')
    .replace(DOUBLE_QUOTE_REGEX, '&quot;')
    .replace(SINGLE_QUOTE_REGEX, '&#39;')
    .replace(BACKTICK_REGEX, '&#96;');
}

/**
 * 转义 HTML 属性值，防止 XSS 注入
 */
function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function extractFileName(href: string): string {
  try {
    const urlPath = href.split('?')[0].split('#')[0];
    const fileName = urlPath.split('/').pop() || '';
    const nameWithoutExt = fileName.replace(/\.[^.]*$/, '');
    return nameWithoutExt;
  } catch {
    return '';
  }
}

function transform(legend: string, text: string | null, title: string | null, href: string = ''): string {
  const options = legend.split('-');
  for (const option of options) {
    if (option === 'alt' && text) {
      return text;
    }
    if (option === 'title' && title) {
      return title;
    }
    if (option === 'filename' && href) {
      const fileName = extractFileName(href);
      if (fileName) {
        return escapeHtml(fileName);
      }
    }
  }
  return '';
}

// Mac 风格代码块 SVG
const macCodeSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" version="1.1" x="0px" y="0px" width="45px" height="13px" viewBox="0 0 450 130">
    <ellipse cx="50" cy="65" rx="50" ry="52" stroke="rgb(220,60,54)" stroke-width="2" fill="rgb(237,108,96)" />
    <ellipse cx="225" cy="65" rx="50" ry="52" stroke="rgb(218,151,33)" stroke-width="2" fill="rgb(247,193,81)" />
    <ellipse cx="400" cy="65" rx="50" ry="52" stroke="rgb(27,161,37)" stroke-width="2" fill="rgb(100,200,86)" />
  </svg>
`.trim();

/**
 * 计算字数和阅读时间
 */
function calculateReadingTime(content: string): { wordCount: number; readTime: number } {
  // 中文按字符计算，英文按单词计算
  const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (content.match(/[a-zA-Z]+/g) || []).length;
  const wordCount = chineseChars + englishWords;
  // 中文约 300 字/分钟，英文约 200 词/分钟，混合取 250
  const readTime = Math.ceil(wordCount / 250);
  return { wordCount, readTime };
}

/**
 * 生成带 CSS 类的内容
 */
function styledContent(styleLabel: string, content: string, tagName?: string, style?: string): string {
  const tag = tagName ?? styleLabel;
  const className = `${styleLabel.replace(UNDERSCORE_REGEX, '-')}`;
  const headingAttr = HEADING_TAG_REGEX.test(tag) ? ' data-heading="true"' : '';
  const styleAttr = style ? ` style="${style}"` : '';
  return `<${tag} class="${className}"${headingAttr}${styleAttr}>${content}</${tag}>`;
}

/**
 * 渲染 Markdown 到 HTML
 */
export function renderMarkdown(content: string, options: RenderOptions = {}): RenderResult {
  // Debug: 打印输入内容
  console.log('[wechatPub] renderMarkdown input:', {
    contentLength: content?.length || 0,
    contentPreview: content?.substring(0, 200) || '(empty)',
    options
  });

  // 解析 front-matter
  let yamlData: Record<string, any> = {};
  let markdownContent = content;

  try {
    const parsed = frontMatter(content);
    yamlData = (parsed.attributes as Record<string, any>) || {};
    markdownContent = parsed.body || '';
    console.log('[wechatPub] front-matter parsed:', {
      yamlData,
      bodyLength: markdownContent?.length || 0,
      bodyPreview: markdownContent?.substring(0, 200) || '(empty)'
    });
  } catch (error) {
    console.error('[wechatPub] Error parsing front-matter:', error);
    markdownContent = content;
  }

  // 计算字数和阅读时间
  const { wordCount, readTime } = calculateReadingTime(markdownContent);
  console.log('[wechatPub] Reading time calculated:', { wordCount, readTime });

  // 脚注数据
  const footnotes: [number, string, string][] = [];
  let footnoteIndex = 0;

  function addFootnote(title: string, link: string): number {
    const existingFootnote = footnotes.find(([, , existingLink]) => existingLink === link);
    if (existingFootnote) {
      return existingFootnote[0];
    }
    footnotes.push([++footnoteIndex, title, link]);
    return footnoteIndex;
  }

  // 配置 marked
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  // 不使用自定义 renderer，避免 marked v12 API 上下文问题
  // 直接使用默认渲染，然后对 HTML 进行后处理添加样式类

  // 渲染 Markdown
  let html = '';
  if (markdownContent && markdownContent.trim()) {
    try {
      html = marked.parse(markdownContent) as string;
      console.log('[wechatPub] marked.parse result (raw):', {
        htmlLength: html?.length || 0,
        htmlPreview: html?.substring(0, 300) || '(empty)'
      });
    } catch (e) {
      console.error('[wechatPub] marked.parse error:', e);
      html = '';
    }
  } else {
    console.log('[wechatPub] markdownContent is empty, skipping parse');
  }

  // 后处理：为代码块添加 Mac 风格标识和语法高亮
  if (html) {
    // 处理带语言标记的代码块
    html = html.replace(/<pre><code class="language-([^"]*)">([\s\S]*?)<\/code><\/pre>/g, (match, lang, code) => {
      const langText = (lang || '').split(' ')[0] || 'plaintext';
      const language = hljs.getLanguage(langText) ? langText : 'plaintext';

      // 解码 HTML 实体
      const decodedCode = code
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

      let highlighted: string;
      try {
        highlighted = hljs.highlight(decodedCode, { language }).value;
      } catch {
        highlighted = escapeHtml(decodedCode);
      }

      const macSign = options.isMacCodeBlock
        ? `<span class="mac-sign" style="padding: 10px 14px 0;">${macCodeSvg}</span>`
        : '';

      return `<pre class="hljs code__pre">${macSign}<code class="language-${escapeAttribute(lang)}">${highlighted}</code></pre>`;
    });

    // 处理没有语言标记的代码块
    html = html.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, (match, code) => {
      const decodedCode = code
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

      const macSign = options.isMacCodeBlock
        ? `<span class="mac-sign" style="padding: 10px 14px 0;">${macCodeSvg}</span>`
        : '';

      return `<pre class="hljs code__pre">${macSign}<code class="language-plaintext">${escapeHtml(decodedCode)}</code></pre>`;
    });
  }

  // 后处理：为列表项添加前缀（• 或数字）
  if (html) {
    // 处理有序列表
    html = html.replace(/<ol(?:\s[^>]*)?>([\s\S]*?)<\/ol>/g, (match: string, listContent: string) => {
      let counter = 1;
      const processedItems = listContent.replace(/<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/g, (itemMatch: string, itemContent: string) => {
        return `<li>${counter++}. ${itemContent}</li>`;
      });
      return `<ol>${processedItems}</ol>`;
    });

    // 处理无序列表
    html = html.replace(/<ul(?:\s[^>]*)?>([\s\S]*?)<\/ul>/g, (match: string, listContent: string) => {
      const processedItems = listContent.replace(/<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/g, (itemMatch: string, itemContent: string) => {
        return `<li>• ${itemContent}</li>`;
      });
      return `<ul>${processedItems}</ul>`;
    });
  }

  // 后处理：为图片添加 figure 包装
  if (html) {
    // 匹配 <img> 标签并包装为 figure
    html = html.replace(/<img([^>]*)>/g, (match, attrs) => {
      // 提取 alt 和 src
      const altMatch = attrs.match(/alt="([^"]*)"/);
      const srcMatch = attrs.match(/src="([^"]*)"/);
      const titleMatch = attrs.match(/title="([^"]*)"/);

      const alt = altMatch ? altMatch[1] : '';
      const src = srcMatch ? srcMatch[1] : '';
      const title = titleMatch ? titleMatch[1] : '';

      const safeAlt = escapeAttribute(alt);
      const safeSrc = escapeAttribute(src);
      const safeTitle = title ? escapeAttribute(title) : '';
      const titleAttr = safeTitle ? ` title="${safeTitle}"` : '';

      // 如果有 legend 配置，添加 figcaption
      const newText = options.legend ? transform(options.legend, alt, title, src) : '';
      const subText = newText ? `<figcaption class="figcaption">${newText}</figcaption>` : '';

      return `<figure><img src="${safeSrc}"${titleAttr} alt="${safeAlt}"/>${subText}</figure>`;
    });
  }

  // 后处理：为链接添加微信公众号特殊处理
  if (html && options.citeStatus) {
    // 添加脚注处理（简化版：只处理非公众号链接）
    html = html.replace(/<a href="([^"]*)"([^>]*)>([^<]*)<\/a>/g, (match, href, attrs, text) => {
      if (MP_WEIXIN_LINK_REGEX.test(href)) {
        return match;
      }
      if (href === text.trim()) {
        return text;
      }
      const ref = addFootnote(text, href);
      return `<a href="${escapeAttribute(href)}"${attrs}>${text}<sup>[${ref}]</sup></a>`;
    });
  }

  // 添加字数统计
  if (options.countStatus && wordCount > 0) {
    const readingTimeHtml = `
      <blockquote class="md-blockquote">
        <p class="md-blockquote-p">字数 ${wordCount}，阅读大约需 ${readTime} 分钟</p>
      </blockquote>
    `;
    html = readingTimeHtml + html;
  }

  // 添加脚注
  if (footnotes.length > 0) {
    const footnoteHtml = footnotes
      .map(([index, title, link]) =>
        link === title
          ? `<code style="font-size: 90%; opacity: 0.6;">[${index}]</code>: <i style="word-break: break-all">${title}</i><br/>`
          : `<code style="font-size: 90%; opacity: 0.6;">[${index}]</code> ${title}: <i style="word-break: break-all">${link}</i><br/>`
      )
      .join('\n');
    html += styledContent('h4', '引用链接') + styledContent('footnotes', footnoteHtml, 'p');
  }

  console.log('[wechatPub] Before DOMPurify:', {
    htmlLength: html?.length || 0,
    htmlPreview: html?.substring(0, 500) || '(empty)'
  });

  // XSS 防护
  html = DOMPurify.sanitize(html, {
    ADD_TAGS: ['figure', 'figcaption', 'section'],
    ADD_ATTR: ['data-heading', 'class', 'style'],
  });

  console.log('[wechatPub] After DOMPurify:', {
    htmlLength: html?.length || 0,
    htmlPreview: html?.substring(0, 500) || '(empty)'
  });

  return {
    html,
    yamlData,
    wordCount,
    readTime,
  };
}

/**
 * 创建容器包裹
 */
export function createContainer(content: string): string {
  return styledContent('container mx-auto', content, 'section');
}

/**
 * 构建附加样式
 */
export function buildAddition(): string {
  return `
    <style>
      .preview-wrapper pre::before {
        position: absolute;
        top: 0;
        right: 0;
        color: #ccc;
        text-align: center;
        font-size: 0.8em;
        padding: 5px 10px 0;
        line-height: 15px;
        height: 15px;
        font-weight: 600;
      }
    </style>
  `;
}

// 导出 hljs 供外部使用
export { hljs };