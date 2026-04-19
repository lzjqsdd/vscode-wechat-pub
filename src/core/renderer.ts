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
  // 解析 front-matter
  let yamlData: Record<string, any> = {};
  let markdownContent = content;

  try {
    const parsed = frontMatter(content);
    yamlData = (parsed.attributes as Record<string, any>) || {};
    markdownContent = parsed.body;
  } catch (error) {
    console.error('Error parsing front-matter:', error);
  }

  // 计算字数和阅读时间
  const { wordCount, readTime } = calculateReadingTime(markdownContent);

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
  });

  // 自定义渲染器 - 使用对象字面量配合类型断言解决 TypeScript 类型问题
  // marked v12 使用 token-based API，但 TypeScript 类型定义仍使用旧式签名
  const renderer = Object.assign(new marked.Renderer(), {
    heading(token: any): string {
      const text = marked.parseInline(token.tokens) as string;
      const tag = `h${token.depth}`;
      return styledContent(tag, text);
    },

    paragraph(token: any): string {
      const text = marked.parseInline(token.tokens) as string;
      const isFigureImage = text.includes('<figure') && text.includes('<img');
      const isEmpty = text.trim() === '';
      if (isFigureImage || isEmpty) {
        return text;
      }
      return styledContent('p', text);
    },

    blockquote(token: any): string {
      const text = marked.parse(token.tokens) as string;
      return styledContent('blockquote', text);
    },

    code(token: any): string {
      const lang = token.lang || '';
      const langText = lang.split(' ')[0];
      const language = hljs.getLanguage(langText) ? langText : 'plaintext';

      let highlighted: string;
      try {
        highlighted = hljs.highlight(token.text, { language }).value;
      } catch {
        highlighted = escapeHtml(token.text);
      }

      const macSign = options.isMacCodeBlock
        ? `<span class="mac-sign" style="padding: 10px 14px 0;">${macCodeSvg}</span>`
        : '';

      const code = `<code class="language-${escapeAttribute(lang)}">${highlighted}</code>`;
      return `<pre class="hljs code__pre">${macSign}${code}</pre>`;
    },

    codespan(token: any): string {
      const escapedText = escapeHtml(token.text);
      return styledContent('codespan', escapedText, 'code');
    },

    list(token: any): string {
      const html = token.items.map((item: any) => renderer.listitem(item)).join('');
      return styledContent(token.ordered ? 'ol' : 'ul', html);
    },

    listitem(token: any): string {
      let content: string;
      try {
        content = marked.parseInline(token.tokens) as string;
      } catch {
        content = (marked.parse(token.tokens) as string)
          .replace(PARAGRAPH_WRAPPER_REGEX, '$1');
      }
      return styledContent('listitem', content, 'li');
    },

    image(token: any): string {
      const href = token.href || '';
      const text = token.text || '';
      const title = token.title;
      const safeHref = escapeAttribute(href);
      const safeText = escapeAttribute(text);
      const safeTitle = title ? escapeAttribute(title) : '';
      const newText = options.legend ? transform(options.legend, text, title, href) : '';
      const subText = newText ? styledContent('figcaption', newText) : '';
      const titleAttr = safeTitle ? ` title="${safeTitle}"` : '';
      return `<figure><img src="${safeHref}"${titleAttr} alt="${safeText}"/>${subText}</figure>`;
    },

    link(token: any): string {
      const href = token.href || '';
      const text = token.text || '';
      const title = token.title;
      const safeHref = escapeAttribute(href);
      const parsedText = marked.parseInline(token.tokens) as string;
      const safeTitle = escapeAttribute(title || text);
      if (MP_WEIXIN_LINK_REGEX.test(href)) {
        return `<a href="${safeHref}" title="${safeTitle}">${parsedText}</a>`;
      }
      if (href === text) {
        return parsedText;
      }
      if (options.citeStatus) {
        const ref = addFootnote(title || text, href);
        return `<a href="${safeHref}" title="${safeTitle}">${parsedText}<sup>[${ref}]</sup></a>`;
      }
      return `<a href="${safeHref}" title="${safeTitle}">${parsedText}</a>`;
    },

    strong(token: any): string {
      return styledContent('strong', marked.parseInline(token.tokens) as string);
    },

    em(token: any): string {
      return styledContent('em', marked.parseInline(token.tokens) as string);
    },

    table(token: any): string {
      const headerRow = token.header
        .map((cell: any) => {
          const text = marked.parseInline(cell.tokens) as string;
          return styledContent('th', text, undefined, `text-align: ${cell.align || 'left'}`);
        })
        .join('');
      const body = token.rows
        .map((row: any) => {
          const rowContent = row
            .map((cell: any) => {
              const text = marked.parseInline(cell.tokens) as string;
              return styledContent('td', text, undefined, `text-align: ${cell.align || 'left'}`);
            })
            .join('');
          return styledContent('tr', rowContent);
        })
        .join('');
      return `
        <section style="max-width: 100%; overflow: auto; -webkit-overflow-scrolling: touch">
          <table class="preview-table">
            <thead>${headerRow}</thead>
            <tbody>${body}</tbody>
          </table>
        </section>
      `;
    },

    hr(): string {
      return '<hr class="hr hr-dash">';
    },
  });

  marked.use({ renderer });

  // 渲染 Markdown
  let html = marked.parse(markdownContent) as string;

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

  // XSS 防护
  html = DOMPurify.sanitize(html, {
    ADD_TAGS: ['figure', 'figcaption', 'section'],
    ADD_ATTR: ['data-heading', 'class', 'style'],
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