# 开发问题记录

本文档记录 wechat-pub VSCode 插件开发过程中遇到的各种问题及解决方案。

---

## 1. command 'wechatPub.preview' not found

### 问题现象
插件安装后，命令面板输入 `wechatPub.preview` 提示命令未找到。

### 根因分析

#### 第一阶段：Webpack 生产模式压缩问题
- **原因**: webpack `vscode:prepublish` 使用 `--mode production`，terser 压缩器会重命名函数名，导致 `exports.activate` 被压缩为其他名称
- **解决**: 将 `package.json` 中 `vscode:prepublish` 改为 `webpack`（不指定 mode），webpack.config.js 使用 `mode: 'none'`

#### 第二阶段：publisher ID 问题
- **原因**: `publisher: "your-publisher"` 不是有效的 VSCode publisher ID
- **解决**: 改为 `"publisher": "infmax"`

#### 第三阶段：jsdom CSS 文件路径问题（最终根因）
- **原因**: jsdom 库在模块加载阶段读取 `default-stylesheet.css`，路径计算使用 `path.resolve(__dirname, "../../browser/default-stylesheet.css")`，webpack 打包后 `__dirname` 指向错误位置，最终路径指向 `~/.vscode/extensions/browser/default-stylesheet.css`（全局目录）
- **解决**:
  1. 修改 webpack.config.js 添加 `node: { __dirname: false }` 保持原始 `__dirname`
  2. 使用 copy-webpack-plugin 将 CSS 文件复制到正确位置
  3. 同时在全局目录 `~/.vscode/extensions/browser/` 创建 CSS 文件作为兜底

### 相关文件
- `webpack.config.js` - 添加 `__dirname: false` 和 copy-webpack-plugin
- `package.json` - publisher 改为 infmax

### 错误日志位置
VSCode Extension Host 日志：
```
~/Library/Application Support/Code/logs/<timestamp>/window1/exthost/exthost.log
```

查看方式：
1. `Cmd+Shift+P` → `Developer: Toggle Developer Tools`
2. 查看 Console 标签页的错误信息

---

## 2. DOMPurify Node.js 环境失败

### 问题现象
DOMPurify 在 Node.js 环境中无法工作。

### 根因分析
- DOMPurify 设计用于浏览器环境，依赖 DOM API
- Node.js 环境没有原生 DOM

### 解决方案
使用 `isomorphic-dompurify` 替代：
```bash
npm install isomorphic-dompurify
```

### 相关文件
- `src/core/renderer.ts` - 改用 `isomorphic-dompurify`

---

## 3. TypeScript marked.Renderer 继承问题

### 问题现象
TypeScript 编译时报错 `this.parser` 不存在。

### 根因分析
TypeScript 类型定义中 `marked.Renderer` 类没有 `parser` 属性。

### 解决方案
使用 `Object.assign` 模式替代类继承：
```typescript
const renderer = Object.assign(new marked.Renderer(), {
  code(code, language) {
    // 自定义实现
  },
  // 其他自定义方法
});
```

### 相关文件
- `src/core/renderer.ts`

---

## 4. XSS 属性注入漏洞

### 问题现象
Markdown 图片 alt 属性可能被注入恶意 HTML/JS。

### 根因分析
marked 库默认不转义 HTML 属性值。

### 解决方案
添加 `escapeAttribute()` 函数处理 href/alt/title 等属性：
```typescript
function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
```

### 相关文件
- `src/core/renderer.ts`

---

## 5. 公众号 API 模板字符串语法错误

### 问题现象
API multipart 请求格式错误。

### 根因分析
使用单引号 `'...'` 导致 `${boundary}` 无法解析。

### 解决方案
改用反引号：
```typescript
// 错误
const footer = '\r\n--${boundary}--\r\n';
// 正确
const footer = `\r\n--${boundary}--\r\n`;
```

### 相关文件
- `src/wechat/api.ts`

---

## 6. 公众号 API 错误判断逻辑错误

### 问题现象
API 成功响应被错误判定为失败。

### 根因分析
公众号 API 成功时不返回 `errcode`，失败时返回 `errcode`。

### 解决方案
```typescript
// 错误
if (response.errcode !== 0) { ... }
// 正确
if (response.errcode !== undefined && response.errcode !== 0) { ... }
```

### 相关文件
- `src/wechat/api.ts`

---

## 7. Preview Panel 双重 dispose 问题

### 问题现象
预览面板关闭时报错 `Cannot dispose disposed object`。

### 根因分析
`onDidChangeViewState` 事件多次触发，导致 dispose 被多次调用。

### 解决方案
添加 `_isDisposed` 标志位和 `_cleanup()` 方法：
```typescript
private _isDisposed = false;

private _cleanup() {
  if (this._isDisposed) return;
  this._isDisposed = true;
  // 清理逻辑
}
```

### 相关文件
- `src/preview/previewManager.ts`

---

## 8. marked(): input parameter is undefined or null

### 问题现象
预览失败，提示 `marked(): input parameter is undefined or null`。

### 根因分析
1. `frontMatter` 解析失败时 `parsed.body` 为 undefined
2. marked v12 token-based API 中，某些 token 没有 `tokens` 属性（如 codespan 只有 text）

### 解决方案
在 renderer 中添加防御性检查：
```typescript
// 确保 markdownContent 不为空
markdownContent = parsed.body || '';

// 所有 token.tokens 使用前检查是否存在
const text = token.tokens
  ? (marked.parseInline(token.tokens) as string)
  : (token.text || '');

// 所有 token 数组属性检查
const items = token.items || [];
const header = token.header || [];
const rows = token.rows || [];

// 最终渲染前检查内容
if (markdownContent && markdownContent.trim()) {
  html = marked.parse(markdownContent) as string;
}
```

### 相关文件
- `src/core/renderer.ts`

---

## 9. 预览内容不随文档切换更新

### 问题现象
切换到另一个 Markdown 文件时，预览面板仍显示旧文档内容。

### 根因分析
- `onDidChangeTextDocument` 监听的是最初打开时的 `editor.document`
- 切换文档后，预览仍监听旧文档的变化

### 解决方案
添加 `onDidChangeActiveTextEditor` 监听文档切换：
```typescript
// 记录当前预览的文档
private currentDocument: vscode.TextDocument | undefined;

// 监听活动编辑器变化
const switchDisposable = vscode.window.onDidChangeActiveTextEditor(e => {
  if (e && e.document.languageId === 'markdown' && this.panel) {
    this.currentDocument = e.document;
    this.update(e);
  }
});
```

### 相关文件
- `src/preview/previewManager.ts`

---

## 10. marked v12 renderer API 上下文丢失导致渲染失败

### 问题现象
预览页面只显示字数统计或空白，Console 报错：
```
TypeError: Cannot read properties of undefined (reading 'parseInline')
at _Renderer.paragraph
```

### 根因分析
marked v12 的自定义 renderer 使用 `this.parser.parseInline(tokens)`，但在渲染嵌套 inline 元素（如 paragraph 内的 strong）时，`this.parser` 上下文丢失变为 undefined。

这是因为：
1. `parseInline()` 内部会调用 inline renderer（strong, em, link 等）
2. inline renderer 被调用时，`this` 不再指向原 Renderer 实例
3. 自定义的 `paragraph`、`heading` 等方法在 inline 上下文中再次被调用时崩溃

### 解决方案
**放弃自定义 renderer，改用 HTML 后处理方案：**

```typescript
// 不自定义 renderer，使用默认渲染
let html = marked.parse(markdownContent) as string;

// 后处理：代码高亮
html = html.replace(/<pre><code class="language-([^"]*)">([\s\S]*?)<\/code><\/pre>/g, 
  (match, lang, code) => {
    const highlighted = hljs.highlight(decodedCode, { language }).value;
    return `<pre class="hljs code__pre">${macSign}<code>${highlighted}</code></pre>`;
  });

// 后处理：图片包装
html = html.replace(/<img([^>]*)>/g, (match, attrs) => {
  return `<figure><img ${attrs}/></figure>`;
});
```

### 关键点
- **不要自定义 inline renderer**（strong, em, codespan）- 它们会在 parseInline 上下文中调用，this.parser 会丢失
- **使用后处理替代** - 对默认渲染的 HTML 进行二次处理
- **正则使用 `[\s\S]*?`** - 匹配代码块中的换行符

### 相关文件
- `src/core/renderer.ts`

---

## 11. VSCode 颜色主题适配与预览刷新

### 问题现象
1. 预览页面在 VSCode 深色模式下仍然显示浅色背景
2. 点击侧边栏切换主题后，预览面板不更新

### 根因分析
1. **颜色主题检测缺失**：没有检测 VSCode 的 `activeColorTheme.kind` 来判断深浅色模式
2. **refresh() 条件过严**：要求 `activeTextEditor.languageId === 'markdown'`，但点击侧边栏时焦点不在编辑器

### 解决方案

**1. 添加 VSCode 颜色主题检测**
```typescript
private getVSCodeThemeKind(): string {
  const kind = vscode.window.activeColorTheme.kind;
  switch (kind) {
    case vscode.ColorThemeKind.Light: return 'light';
    case vscode.ColorThemeKind.Dark: return 'dark';
    // ...
  }
}
```

**2. 监听颜色主题变化**
```typescript
const colorThemeDisposable = vscode.window.onDidChangeActiveColorTheme(() => {
  if (this.panel) {
    this.refresh();
  }
});
```

**3. 改进 refresh() 方法**
```typescript
refresh(): void {
  if (!this.panel) return;
  
  // 优先使用记住的文档，不依赖 activeTextEditor
  if (this.currentDocument) {
    const content = this.currentDocument.getText();
    // 直接渲染更新...
    return;
  }
  
  // 否则尝试当前编辑器
  const editor = vscode.window.activeTextEditor;
  // ...
}
```

### 相关文件
- `src/preview/previewManager.ts`
- `src/preview/themeManager.ts`
- `src/preview/webviewHtml.ts`

---

## 待补充

开发过程中遇到的新问题将继续记录在此文档。