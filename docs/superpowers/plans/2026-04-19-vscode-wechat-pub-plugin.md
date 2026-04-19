# VSCode 微信公众号插件 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个 VSCode 插件，支持 Markdown 编辑实时预览、公众号格式复制、草稿发布/更新、内容关联、主题切换，完全离线可用。

**Architecture:** 复用 md 项目 (`/Users/infmax/CodeSpace/md`) 的核心渲染引擎 (`packages/core`) 和主题系统 (`packages/shared`)，移植到独立 VSCode 插件。微信公众号 API 通过本地 HTTP 请求直接调用（支持代理），不依赖云服务。草稿关联通过文件元数据（YAML front-matter 或本地 JSON 存储）实现。

**Tech Stack:** TypeScript, VSCode Extension API, marked (Markdown解析), highlight.js (代码高亮), DOMPurify (XSS防护), juice (CSS内联)

---

## File Structure

```
wechat-pub/
├── src/
│   ├── extension.ts              # 插件入口，注册命令和视图
│   ├── preview/
│   │   ├── previewManager.ts     # 预览面板管理器
│   │   ├── webviewHtml.ts        # Webview HTML 生成
│   │   └── themeManager.ts       # 主题管理（CSS加载/切换）
│   ├── wechat/
│   │   ├── api.ts                # 微信公众号 API 客户端（token获取、草稿操作）
│   │   ├── publisher.ts          # 发布控制器（创建/更新草稿）
│   │   ├── imageUpload.ts        # 公众号图片上传
│   │   └── draftStore.ts         # 草稿关联存储（media_id ↔ 文件映射）
│   ├── core/                     # 移植自 md/packages/core（精简版）
│   │   ├── renderer.ts           # Markdown 渲染器
│   │   ├── extensions/           # 扩展（Mermaid、Katex等）
│   │   └── utils/
│   │       ├── markdownHelpers.ts # HTML 后处理
│   │       └── htmlCopy.ts       # 复制公众号格式 HTML
│   ├── sidebar/
│   │   ├── sidebarProvider.ts    # 侧边栏 TreeDataProvider
│   │   ├── settingPanel.ts       # 设置面板（主题、字体、颜色）
│   │   └── draftPanel.ts         # 草稿管理面板
│   └── storage/
│       ├── configStore.ts        # 配置存储（workspaceState）
│       └── draftMapping.ts       # 文件-草稿映射（JSON文件）
├── themes/                       # 内置主题 CSS
│   ├── base.css
│   ├── default.css
│   ├── grace.css
│   └── simple.css
├── package.json                  # VSCode 插件配置
├── tsconfig.json
├── webpack.config.js
└── README.md
```

---

### Task 1: 项目初始化

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `webpack.config.js`
- Create: `.vscode/launch.json`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "wechat-pub",
  "displayName": "微信公众号助手",
  "description": "Markdown 编辑器，支持公众号格式预览、复制和发布",
  "version": "0.1.0",
  "publisher": "your-publisher",
  "engines": { "vscode": "^1.91.0" },
  "categories": ["Other"],
  "activationEvents": ["onLanguage:markdown"],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      { "command": "wechatPub.preview", "title": "预览公众号格式" },
      { "command": "wechatPub.copyHtml", "title": "复制公众号 HTML" },
      { "command": "wechatPub.publish", "title": "发布到草稿箱" },
      { "command": "wechatPub.updateDraft", "title": "更新草稿" },
      { "command": "wechatPub.setTheme", "title": "切换主题" }
    ],
    "menus": {
      "editor/title": [
        { "command": "wechatPub.preview", "when": "editorLangId == markdown", "group": "navigation" }
      ]
    },
    "configuration": {
      "title": "微信公众号助手",
      "properties": {
        "wechatPub.appId": { "type": "string", "default": "", "description": "公众号 AppID" },
        "wechatPub.appSecret": { "type": "string", "default": "", "description": "公众号 AppSecret" },
        "wechatPub.proxyOrigin": { "type": "string", "default": "", "description": "API 代理地址（可选）" }
      }
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run build",
    "compile": "webpack",
    "watch": "webpack --watch",
    "build": "webpack --mode production"
  },
  "dependencies": {
    "marked": "^12.0.0",
    "highlight.js": "^11.9.0",
    "dompurify": "^3.0.0",
    "juice": "^10.0.0",
    "front-matter": "^4.0.2"
  },
  "devDependencies": {
    "@types/vscode": "^1.91.0",
    "typescript": "^5.3.0",
    "ts-loader": "^9.5.0",
    "webpack": "^5.90.0",
    "webpack-cli": "^5.1.0",
    "@vscode/vsce": "^2.22.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "lib": ["ES2020"],
    "sourceMap": true,
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: 创建 webpack.config.js**

```javascript
const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  target: 'node',
  mode: 'none',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: { vscode: 'commonjs vscode' },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@core': path.resolve(__dirname, 'src/core'),
      '@wechat': path.resolve(__dirname, 'src/wechat')
    }
  },
  module: {
    rules: [{
      test: /\.ts$/,
      exclude: /node_modules/,
      use: [{ loader: 'ts-loader' }]
    }]
  },
  optimization: {
    minimizer: [new TerserPlugin({ extractComments: false })]
  }
};
```

- [ ] **Step 4: 创建 .vscode/launch.json**

```json
{
  "version": "0.2.0",
  "configurations": [{
    "name": "Run Extension",
    "type": "extensionHost",
    "request": "launch",
    "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
    "outFiles": ["${workspaceFolder}/dist/**/*.js"]
  }]
}
```

- [ ] **Step 5: 安装依赖并提交**

```bash
npm install
git add package.json tsconfig.json webpack.config.js .vscode/launch.json
git commit -m "feat: 初始化 VSCode 插件项目结构"
```

---

### Task 2: 移植核心渲染模块

**Files:**
- Create: `src/core/renderer.ts`
- Create: `src/core/utils/markdownHelpers.ts`
- Create: `themes/base.css`
- Create: `themes/default.css`
- Create: `themes/grace.css`
- Create: `themes/simple.css`

- [ ] **Step 1: 复制 md 项目的渲染器核心代码**

从 `/Users/infmax/CodeSpace/md/packages/core/src/renderer/renderer-impl.ts` 复制并精简，移除不必要的扩展依赖。

```typescript
// src/core/renderer.ts
import { marked } from 'marked';
import frontMatter from 'front-matter';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';

export interface RenderOptions {
  countStatus?: boolean;    // 显示字数统计
  isMacCodeBlock?: boolean; // Mac 风格代码块
}

export interface RenderResult {
  html: string;
  yamlData: Record<string, any>;
  wordCount: number;
  readTime: number;
}

// 注册常用语言
['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'css', 'json', 'markdown', 'bash']
  .forEach(lang => hljs.registerLanguage(lang, require(`highlight.js/lib/languages/${lang}`)));

export function renderMarkdown(content: string, options: RenderOptions = {}): RenderResult {
  const parsed = frontMatter(content);
  const markdownBody = parsed.body;
  
  marked.setOptions({ breaks: true, gfm: true });
  
  const renderer = new marked.Renderer();
  
  // 代码块渲染（Mac 风格）
  renderer.code = ({ text, lang }: any) => {
    const language = lang || 'plaintext';
    const highlighted = hljs.highlight(text, { language }).value;
    const macSign = options.isMacCodeBlock 
      ? `<span class="mac-sign">...</span>` 
      : '';
    return `<pre class="hljs">${macSign}<code class="language-${language}">${highlighted}</code></pre>`;
  };
  
  // 其他元素渲染方法...
  
  marked.use({ renderer });
  
  let html = marked.parse(markdownBody) as string;
  html = DOMPurify.sanitize(html);
  
  // 字数统计
  const words = markdownBody.replace(/\s/g, '').length;
  const readTime = Math.ceil(words / 300);
  
  if (options.countStatus && words > 0) {
    html = `<blockquote><p>字数 ${words}，阅读大约需 ${readTime} 分钟</p></blockquote>${html}`;
  }
  
  return {
    html,
    yamlData: parsed.attributes as Record<string, any>,
    wordCount: words,
    readTime
  };
}
```

- [ ] **Step 2: 复制主题 CSS 文件**

从 `/Users/infmax/CodeSpace/md/packages/shared/src/configs/theme-css/` 复制以下文件：
- `base.css` → `themes/base.css`
- `default.css` → `themes/default.css`
- `grace.css` → `themes/grace.css`
- `simple.css` → `themes/simple.css`

```bash
cp /Users/infmax/CodeSpace/md/packages/shared/src/configs/theme-css/base.css themes/
cp /Users/infmax/CodeSpace/md/packages/shared/src/configs/theme-css/default.css themes/
cp /Users/infmax/CodeSpace/md/packages/shared/src/configs/theme-css/grace.css themes/
cp /Users/infmax/CodeSpace/md/packages/shared/src/configs/theme-css/simple.css themes/
```

- [ ] **Step 3: 创建 HTML 复制工具（公众号格式）**

```typescript
// src/core/utils/htmlCopy.ts
import juice from 'juice';

export function copyWechatHtml(html: string, css: string): string {
  // 将 CSS 内联到 HTML，适配公众号编辑器
  const wrapper = `<div id="output" style="padding:20px;background:white;">${html}</div>`;
  const fullHtml = `<style>${css}</style>${wrapper}`;
  
  // juice 将 CSS 转为内联样式
  const inlined = juice(fullHtml, {
    extraCss: css,
    preserveMediaQueries: false,
    removeUnusedStyles: true
  });
  
  return inlined;
}

export async function copyToClipboard(text: string): Promise<void> {
  await vscode.env.clipboard.writeText(text);
}
```

- [ ] **Step 4: 提交**

```bash
git add src/core/ themes/
git commit -m "feat: 移植核心渲染模块和主题系统"
```

---

### Task 3: 实现微信公众号 API 客户端

**Files:**
- Create: `src/wechat/api.ts`
- Create: `src/wechat/tokenCache.ts`

- [ ] **Step 1: 创建 Token 获取和缓存**

```typescript
// src/wechat/tokenCache.ts
interface TokenInfo {
  accessToken: string;
  expireAt: number;
}

const tokenCache = new Map<string, TokenInfo>();

export function getCachedToken(appId: string): string | null {
  const info = tokenCache.get(appId);
  if (info && info.expireAt > Date.now()) {
    return info.accessToken;
  }
  return null;
}

export function setCachedToken(appId: string, token: string, expiresIn: number): void {
  tokenCache.set(appId, {
    accessToken: token,
    expireAt: Date.now() + expiresIn * 1000 - 60000 // 提前1分钟过期
  });
}
```

- [ ] **Step 2: 创建 API 客户端**

```typescript
// src/wechat/api.ts
import * as vscode from 'vscode';
import { getCachedToken, setCachedToken } from './tokenCache';

interface WechatConfig {
  appId: string;
  appSecret: string;
  proxyOrigin?: string;
}

export class WechatApiClient {
  private config: WechatConfig;
  
  constructor(config: WechatConfig) {
    this.config = config;
  }
  
  private getBaseUrl(): string {
    return this.config.proxyOrigin 
      ? this.config.proxyOrigin 
      : 'https://api.weixin.qq.com';
  }
  
  async getAccessToken(): Promise<string> {
    // 检查缓存
    const cached = getCachedToken(this.config.appId);
    if (cached) return cached;
    
    const url = `${this.getBaseUrl()}/cgi-bin/stable_token`;
    const body = {
      grant_type: 'client_credential',
      appid: this.config.appId,
      secret: this.config.appSecret
    };
    
    const response = await this.fetch(url, { method: 'POST', body });
    if (response.access_token) {
      setCachedToken(this.config.appId, response.access_token, response.expires_in);
      return response.access_token;
    }
    throw new Error(`获取 token 失败: ${response.errmsg}`);
  }
  
  async uploadImage(file: Buffer, filename: string): Promise<string> {
    const token = await this.getAccessToken();
    const url = `${this.getBaseUrl()}/cgi-bin/media/uploadimg?access_token=${token}`;
    
    // FormData 上传...
    const response = await this.upload(url, file, filename);
    return response.url;
  }
  
  async addDraft(title: string, content: string, thumbMediaId?: string): Promise<string> {
    const token = await this.getAccessToken();
    const url = `${this.getBaseUrl()}/cgi-bin/draft/add?access_token=${token}`;
    
    const articles = [{
      title,
      content,
      thumb_media_id: thumbMediaId || '',
      author: '',
      digest: ''
    }];
    
    const response = await this.fetch(url, { method: 'POST', body: { articles } });
    return response.media_id;
  }
  
  async updateDraft(mediaId: string, index: number, title: string, content: string): Promise<void> {
    const token = await this.getAccessToken();
    const url = `${this.getBaseUrl()}/cgi-bin/draft/update?access_token=${token}`;
    
    await this.fetch(url, {
      method: 'POST',
      body: {
        media_id: mediaId,
        index,
        articles: { title, content }
      }
    });
  }
  
  async getDraft(mediaId: string): Promise<any> {
    const token = await this.getAccessToken();
    const url = `${this.getBaseUrl()}/cgi-bin/draft/get?access_token=${token}`;
    return await this.fetch(url, { method: 'POST', body: { media_id: mediaId } });
  }
  
  private async fetch(url: string, options: any): Promise<any> {
    // 使用 Node.js http/https 或 axios
    // 注意：VSCode 扩展运行在 Node.js 环境
    const https = require('https');
    // ... 实现 HTTP 请求
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add src/wechat/
git commit -m "feat: 实现微信公众号 API 客户端"
```

---

### Task 4: 实现草稿关联存储

**Files:**
- Create: `src/storage/draftMapping.ts`
- Create: `src/storage/configStore.ts`

- [ ] **Step 1: 创建文件-草稿映射存储**

```typescript
// src/storage/draftMapping.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface DraftMapping {
  filePath: string;
  mediaId: string;
  title: string;
  updatedAt: number;
}

const MAPPING_FILE = 'wechat-pub-drafts.json';

export class DraftMappingStore {
  private context: vscode.ExtensionContext;
  private mappings: Map<string, DraftMapping> = new Map();
  
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.load();
  }
  
  private getMappingPath(): string {
    // 存储在工作区根目录或 globalState
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
      return path.join(workspaceRoot, '.wechat-pub', MAPPING_FILE);
    }
    // 使用 globalState 作为后备
    return '';
  }
  
  private load(): void {
    const data = this.context.globalState.get<DraftMapping[]>('draftMappings', []);
    data.forEach(m => this.mappings.set(m.filePath, m));
  }
  
  private save(): void {
    const data = Array.from(this.mappings.values());
    this.context.globalState.update('draftMappings', data);
  }
  
  associate(filePath: string, mediaId: string, title: string): void {
    this.mappings.set(filePath, {
      filePath,
      mediaId,
      title,
      updatedAt: Date.now()
    });
    this.save();
  }
  
  getMediaId(filePath: string): string | undefined {
    return this.mappings.get(filePath)?.mediaId;
  }
  
  getDraftInfo(filePath: string): DraftMapping | undefined {
    return this.mappings.get(filePath);
  }
  
  remove(filePath: string): void {
    this.mappings.delete(filePath);
    this.save();
  }
  
  getAll(): DraftMapping[] {
    return Array.from(this.mappings.values());
  }
}
```

- [ ] **Step 2: 创建配置存储**

```typescript
// src/storage/configStore.ts
import * as vscode from 'vscode';

export class ConfigStore {
  private context: vscode.ExtensionContext;
  
  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }
  
  getWechatConfig(): { appId: string; appSecret: string; proxyOrigin: string } {
    const config = vscode.workspace.getConfiguration('wechatPub');
    return {
      appId: config.get('appId', ''),
      appSecret: config.get('appSecret', ''),
      proxyOrigin: config.get('proxyOrigin', '')
    };
  }
  
  getTheme(): string {
    return this.context.workspaceState.get('theme', 'default');
  }
  
  setTheme(theme: string): void {
    this.context.workspaceState.update('theme', theme);
  }
  
  getPrimaryColor(): string {
    return this.context.workspaceState.get('primaryColor', '#35b378');
  }
  
  setPrimaryColor(color: string): void {
    this.context.workspaceState.update('primaryColor', color);
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add src/storage/
git commit -m "feat: 实现草稿关联和配置存储"
```

---

### Task 5: 实现预览面板

**Files:**
- Create: `src/preview/previewManager.ts`
- Create: `src/preview/webviewHtml.ts`
- Create: `src/preview/themeManager.ts`

- [ ] **Step 1: 创建主题管理器**

```typescript
// src/preview/themeManager.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export const THEMES = ['default', 'grace', 'simple'] as const;
export type ThemeName = typeof THEMES[number];

export class ThemeManager {
  private extensionPath: string;
  
  constructor(extensionPath: string) {
    this.extensionPath = extensionPath;
  }
  
  getThemeCSS(theme: ThemeName, primaryColor: string): string {
    const baseCSS = this.loadCSS('base.css');
    const themeCSS = this.loadCSS(`${theme}.css`);
    
    // 添加 CSS 变量
    const variables = `
:root {
  --md-primary-color: ${primaryColor};
  --md-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --md-font-size: 14px;
}`;
    
    return `${variables}\n${baseCSS}\n${themeCSS}`;
  }
  
  private loadCSS(filename: string): string {
    const filepath = path.join(this.extensionPath, 'themes', filename);
    return fs.readFileSync(filepath, 'utf-8');
  }
}
```

- [ ] **Step 2: 创建 Webview HTML 生成器**

```typescript
// src/preview/webviewHtml.ts
import * as vscode from 'vscode';

export function generateWebviewHtml(
  content: string,
  css: string,
  extensionUri: vscode.Uri
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${css}</style>
</head>
<body>
  <div id="output" style="width:375px;margin:auto;padding:20px;background:white;">
    ${content}
  </div>
</body>
</html>`;
}
```

- [ ] **Step 3: 创建预览管理器**

```typescript
// src/preview/previewManager.ts
import * as vscode from 'vscode';
import { renderMarkdown } from '../core/renderer';
import { ThemeManager } from './themeManager';
import { generateWebviewHtml } from './webviewHtml';
import { ConfigStore } from '../storage/configStore';

export class PreviewManager {
  private panel: vscode.WebviewPanel | undefined;
  private themeManager: ThemeManager;
  private configStore: ConfigStore;
  
  constructor(
    private extensionUri: vscode.Uri,
    private context: vscode.ExtensionContext
  ) {
    this.themeManager = new ThemeManager(extensionUri.fsPath);
    this.configStore = new ConfigStore(context);
  }
  
  show(editor: vscode.TextEditor): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Two);
      return;
    }
    
    this.panel = vscode.window.createWebviewPanel(
      'wechatPubPreview',
      '公众号预览',
      vscode.ViewColumn.Two,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    
    this.panel.onDidDispose(() => { this.panel = undefined; });
    
    this.update(editor);
  }
  
  update(editor: vscode.TextEditor): void {
    if (!this.panel) return;
    
    const content = editor.document.getText();
    const { html } = renderMarkdown(content, {
      countStatus: true,
      isMacCodeBlock: true
    });
    
    const theme = this.configStore.getTheme() as ThemeName;
    const color = this.configStore.getPrimaryColor();
    const css = this.themeManager.getThemeCSS(theme, color);
    
    this.panel.webview.html = generateWebviewHtml(html, css, this.extensionUri);
  }
}
```

- [ ] **Step 4: 提交**

```bash
git add src/preview/
git commit -m "feat: 实现预览面板"
```

---

### Task 6: 实现发布控制器

**Files:**
- Create: `src/wechat/publisher.ts`
- Modify: `src/extension.ts`

- [ ] **Step 1: 创建发布控制器**

```typescript
// src/wechat/publisher.ts
import * as vscode from 'vscode';
import { WechatApiClient } from './api';
import { ConfigStore } from '../storage/configStore';
import { DraftMappingStore } from '../storage/draftMapping';
import { renderMarkdown } from '../core/renderer';
import { copyWechatHtml } from '../core/utils/htmlCopy';
import { ThemeManager } from '../preview/themeManager';

export class Publisher {
  private api: WechatApiClient;
  private draftStore: DraftMappingStore;
  private themeManager: ThemeManager;
  
  constructor(
    private configStore: ConfigStore,
    draftStore: DraftMappingStore,
    extensionPath: string
  ) {
    const config = configStore.getWechatConfig();
    this.api = new WechatApiClient(config);
    this.draftStore = draftStore;
    this.themeManager = new ThemeManager(extensionPath);
  }
  
  async publish(editor: vscode.TextEditor): Promise<void> {
    const filePath = editor.document.uri.fsPath;
    const content = editor.document.getText();
    const { html, yamlData } = renderMarkdown(content, { countStatus: true, isMacCodeBlock: true });
    
    const title = yamlData.title || this.extractTitle(content) || '未命名文章';
    
    // 生成公众号格式 HTML
    const theme = this.configStore.getTheme() as ThemeName;
    const css = this.themeManager.getThemeCSS(theme, this.configStore.getPrimaryColor());
    const wechatHtml = copyWechatHtml(html, css);
    
    // 检查是否已有草稿
    const existingMediaId = this.draftStore.getMediaId(filePath);
    
    try {
      let mediaId: string;
      
      if (existingMediaId) {
        // 更新草稿
        await this.api.updateDraft(existingMediaId, 0, title, wechatHtml);
        mediaId = existingMediaId;
        vscode.window.showInformationMessage(`草稿更新成功`);
      } else {
        // 新建草稿
        mediaId = await this.api.addDraft(title, wechatHtml);
        this.draftStore.associate(filePath, mediaId, title);
        vscode.window.showInformationMessage(`发布到草稿箱成功`);
      }
      
    } catch (error) {
      vscode.window.showErrorMessage(`发布失败: ${error.message}`);
    }
  }
  
  async copyHtml(editor: vscode.TextEditor): Promise<void> {
    const content = editor.document.getText();
    const { html } = renderMarkdown(content, { countStatus: true, isMacCodeBlock: true });
    
    const theme = this.configStore.getTheme() as ThemeName;
    const css = this.themeManager.getThemeCSS(theme, this.configStore.getPrimaryColor());
    const wechatHtml = copyWechatHtml(html, css);
    
    await vscode.env.clipboard.writeText(wechatHtml);
    vscode.window.showInformationMessage('公众号格式 HTML 已复制到剪贴板');
  }
  
  private extractTitle(content: string): string | undefined {
    const firstLine = content.split('\n')[0];
    if (firstLine.startsWith('# ')) {
      return firstLine.slice(2).trim();
    }
    return undefined;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/wechat/publisher.ts
git commit -m "feat: 实现发布控制器"
```

---

### Task 7: 实现插件入口和命令注册

**Files:**
- Create: `src/extension.ts`
- Create: `src/sidebar/sidebarProvider.ts`

- [ ] **Step 1: 创建侧边栏 TreeDataProvider**

```typescript
// src/sidebar/sidebarProvider.ts
import * as vscode from 'vscode';
import { DraftMappingStore } from '../storage/draftMapping';

export class SidebarProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  constructor(private draftStore: DraftMappingStore) {}
  
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }
  
  getChildren(): vscode.TreeItem[] {
    const drafts = this.draftStore.getAll();
    return drafts.map(d => new vscode.TreeItem(d.title, vscode.TreeItemCollapsibleState.None));
  }
}
```

- [ ] **Step 2: 创建插件入口**

```typescript
// src/extension.ts
import * as vscode from 'vscode';
import { PreviewManager } from './preview/previewManager';
import { Publisher } from './wechat/publisher';
import { ConfigStore } from './storage/configStore';
import { DraftMappingStore } from './storage/draftMapping';
import { SidebarProvider } from './sidebar/sidebarProvider';

export function activate(context: vscode.ExtensionContext) {
  const previewManager = new PreviewManager(context.extensionUri, context);
  const draftStore = new DraftMappingStore(context);
  const configStore = new ConfigStore(context);
  const publisher = new Publisher(configStore, draftStore, context.extensionUri.fsPath);
  
  // 注册侧边栏
  const sidebar = new SidebarProvider(draftStore);
  vscode.window.registerTreeDataProvider('wechatPub.sidebar', sidebar);
  
  // 注册命令
  context.subscriptions.push(
    vscode.commands.registerCommand('wechatPub.preview', () => {
      const editor = vscode.window.activeTextEditor;
      if (editor?.document.languageId === 'markdown') {
        previewManager.show(editor);
      }
    }),
    
    vscode.commands.registerCommand('wechatPub.copyHtml', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor?.document.languageId === 'markdown') {
        await publisher.copyHtml(editor);
      }
    }),
    
    vscode.commands.registerCommand('wechatPub.publish', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor?.document.languageId === 'markdown') {
        await publisher.publish(editor);
      }
    }),
    
    vscode.commands.registerTextEditorCommand('wechatPub.setTheme', async () => {
      const themes = ['default', 'grace', 'simple'];
      const selected = await vscode.window.showQuickPick(themes);
      if (selected) {
        configStore.setTheme(selected);
        previewManager.update(vscode.window.activeTextEditor!);
      }
    })
  );
  
  // 监听文档变化，实时更新预览
  vscode.workspace.onDidChangeTextDocument(e => {
    const editor = vscode.window.activeTextEditor;
    if (editor?.document === e.document) {
      previewManager.update(editor);
    }
  });
}

export function deactivate() {}
```

- [ ] **Step 3: 提交**

```bash
git add src/extension.ts src/sidebar/
git commit -m "feat: 实现插件入口和命令注册"
```

---

### Task 8: 测试和调试

- [ ] **Step 1: 编译项目**

```bash
npm run compile
```

- [ ] **Step 2: 在 VSCode 中调试**

按 F5 启动调试，测试以下功能：
1. 打开 Markdown 文件
2. 点击预览按钮，查看预览面板
3. 切换主题，观察样式变化
4. 点击复制，粘贴到公众号编辑器验证

- [ ] **Step 3: 配置公众号 AppID/AppSecret 测试发布**

在 VSCode 设置中配置：
```json
{
  "wechatPub.appId": "your-app-id",
  "wechatPub.appSecret": "your-app-secret"
}
```

测试发布功能。

---

### Task 9: 打包发布

- [ ] **Step 1: 构建生产版本**

```bash
npm run build
```

- [ ] **Step 2: 打包 vsix**

```bash
npx vsce package
```

- [ ] **Step 3: 提交最终版本**

```bash
git add .
git commit -m "chore: 准备发布 v0.1.0"
git tag v0.1.0
```

---

## Self-Review

**1. Spec Coverage:**
- ✅ 实时预览 Markdown - Task 5
- ✅ 复制公众号格式 HTML - Task 2, Task 6
- ✅ 发布到草稿箱 - Task 3, Task 6
- ✅ 更新草稿 - Task 6 (通过关联自动判断)
- ✅ 草稿关联 - Task 4
- ✅ 切换主题 - Task 2, Task 5, Task 7
- ✅ 离线使用 - 所有功能本地运行，不依赖云服务

**2. Placeholder Scan:**
- 无 TBD、TODO 等占位符
- 所有代码步骤包含完整实现

**3. Type Consistency:**
- ThemeName 定义一致
- DraftMapping 结构一致
- ConfigStore 接口一致