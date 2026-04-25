/**
 * 预览管理器
 * 管理 VSCode Webview 预览面板的创建、更新和销毁
 * 支持 Preview/Markdown 模式切换
 */

import * as vscode from 'vscode';
import { renderMarkdown } from '../core/renderer';
import { ThemeManager, ThemeName } from './themeManager';
import { generatePreviewHtml, generateMarkdownHtml } from './webviewHtml';
import { ConfigStore } from '../storage/configStore';

/**
 * 编辑器模式
 */
export type EditorMode = 'preview' | 'markdown';

/**
 * 预览管理类
 * 负责创建和管理 Markdown 预览 Webview 面板
 */
export class PreviewManager {
  private panel: vscode.WebviewPanel | undefined;
  private themeManager: ThemeManager;
  private configStore: ConfigStore;
  private extensionUri: vscode.Uri;

  // 所有监听器统一管理
  private disposables: vscode.Disposable[] = [];

  private currentDocument: vscode.TextDocument | undefined;
  private currentMode: EditorMode = 'preview';

  // Context key 用于跟踪分屏预览是否激活和当前模式
  public static readonly sidePreviewActiveKey = 'wechatPubSidePreviewActive';
  public static readonly sidePreviewModeKey = 'wechatPubSidePreviewMode';

  // 单例实例
  private static instance: PreviewManager | undefined;

  constructor(
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext
  ) {
    this.extensionUri = extensionUri;
    this.themeManager = new ThemeManager(extensionUri.fsPath);
    this.configStore = new ConfigStore(context);
    PreviewManager.instance = this;
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): PreviewManager | undefined {
    return PreviewManager.instance;
  }

  /**
   * 检测 VSCode 颜色主题类型
   */
  private getVSCodeThemeKind(): string {
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
   * 显示预览面板
   */
  show(editor: vscode.TextEditor): void {
    console.log('[PreviewManager] show() called, document:', editor.document.uri.fsPath);
    this.currentDocument = editor.document;
    this._showPanel();
    this._updateContent();
  }

  /**
   * 显示预览面板（从文档直接打开）
   */
  showDocument(document: vscode.TextDocument): void {
    console.log('[PreviewManager] showDocument() called');
    this.currentDocument = document;
    this._showPanel();
    this._updateContent();
  }

  /**
   * 切换模式
   */
  switchMode(mode: EditorMode): void {
    if (!this.panel || !this.currentDocument) {
      return;
    }
    this.currentMode = mode;
    vscode.commands.executeCommand('setContext', PreviewManager.sidePreviewModeKey, mode);
    this._updateContent();
  }

  /**
   * 获取当前模式
   */
  getMode(): EditorMode {
    return this.currentMode;
  }

  /**
   * 检查面板是否激活
   */
  isActive(): boolean {
    return this.panel?.active || false;
  }

  /**
   * 创建或显示 Webview 面板
   */
  private _showPanel(): void {
    console.log('[PreviewManager] _showPanel() called, current panel:', this.panel ? 'exists' : 'undefined');

    // 如果面板存在且有效，直接显示
    if (this.panel) {
      console.log('[PreviewManager] panel exists, calling reveal()');
      this.panel.reveal(vscode.ViewColumn.Two);
      return;
    }

    console.log('[PreviewManager] creating new panel...');

    // 清理旧的监听器（如果有的话）
    this._cleanupListeners();

    // 重置单例
    PreviewManager.instance = this;

    // 创建新面板
    this.panel = vscode.window.createWebviewPanel(
      'wechatPubPreview',
      '公众号预览',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    console.log('[PreviewManager] new panel created');

    // 注册面板事件监听器（这些会随面板销毁自动清理，但仍需存储以防手动清理）
    const messageDisposable = this.panel.webview.onDidReceiveMessage(
      (message: { type: string; content?: string }) => {
        if (message.type === 'editContent' && message.content && this.currentDocument) {
          this._applyEdit(message.content);
        }
      }
    );
    this.disposables.push(messageDisposable);

    // 面板关闭事件
    const disposeDisposable = this.panel.onDidDispose(() => {
      console.log('[PreviewManager] panel onDidDispose triggered');
      vscode.commands.executeCommand('setContext', PreviewManager.sidePreviewActiveKey, false);
      vscode.commands.executeCommand('setContext', PreviewManager.sidePreviewModeKey, undefined);
      this.panel = undefined;
      this._cleanupListeners();
    });
    this.disposables.push(disposeDisposable);

    // 面板状态变化
    const viewStateDisposable = this.panel.onDidChangeViewState(() => {
      vscode.commands.executeCommand('setContext', PreviewManager.sidePreviewActiveKey, this.panel?.active || false);
    });
    this.disposables.push(viewStateDisposable);

    // 注册 VSCode 全局事件监听器
    this._registerGlobalListeners();

    // 设置初始 context
    vscode.commands.executeCommand('setContext', PreviewManager.sidePreviewActiveKey, true);
    vscode.commands.executeCommand('setContext', PreviewManager.sidePreviewModeKey, this.currentMode);
  }

  /**
   * 注册 VSCode 全局事件监听器
   * 所有监听器都存入 disposables 数组以便统一清理
   */
  private _registerGlobalListeners(): void {
    console.log('[PreviewManager] registering global listeners');

    // 监听文档变化
    const docChangeDisposable = vscode.workspace.onDidChangeTextDocument(e => {
      if (this.currentDocument && e.document.uri.toString() === this.currentDocument.uri.toString()) {
        if (this.currentMode === 'markdown' && this._webviewEditing) {
          this._webviewEditing = false;
          return;
        }
        this._updateContent();
      }
    });
    this.disposables.push(docChangeDisposable);

    // 监听活动编辑器变化
    const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(e => {
      if (e && e.document.languageId === 'markdown' && this.panel) {
        this.currentDocument = e.document;
        this._updateContent();
      }
    });
    this.disposables.push(editorChangeDisposable);

    // 监听 VSCode 颜色主题变化
    const colorThemeDisposable = vscode.window.onDidChangeActiveColorTheme(() => {
      if (this.panel && this.currentDocument) {
        this._updateContent();
      }
    });
    this.disposables.push(colorThemeDisposable);
  }

  private _webviewEditing = false;

  /**
   * 应用编辑到文档
   */
  private _applyEdit(content: string): Thenable<boolean> {
    if (!this.currentDocument) return Promise.resolve(false);
    this._webviewEditing = true;
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      this.currentDocument.positionAt(0),
      this.currentDocument.positionAt(this.currentDocument.getText().length)
    );
    edit.replace(this.currentDocument.uri, fullRange, content);
    return vscode.workspace.applyEdit(edit);
  }

  /**
   * 更新面板内容
   */
  private _updateContent(): void {
    if (!this.panel || !this.currentDocument) {
      console.log('[PreviewManager] _updateContent skipped: panel=', this.panel ? 'exists' : 'undefined', 'document=', this.currentDocument ? 'exists' : 'undefined');
      return;
    }

    console.log('[PreviewManager] _updateContent called');

    const content = this.currentDocument.getText();
    const vscodeThemeKind = this.getVSCodeThemeKind();
    const theme = this.configStore.getTheme() as ThemeName;
    const color = this.configStore.getPrimaryColor();
    const css = this.themeManager.getThemeCSS(theme, color, vscodeThemeKind, {
      fontFamily: this.configStore.getFontFamily(),
      fontSize: this.configStore.getFontSize(),
      useIndent: this.configStore.getUseIndent(),
      useJustify: this.configStore.getUseJustify(),
    });

    if (this.currentMode === 'preview') {
      const { html } = renderMarkdown(content, {
        countStatus: this.configStore.getCountStatus(),
        isMacCodeBlock: this.configStore.getMacCodeBlock(),
        citeStatus: this.configStore.getCiteStatus(),
        legend: this.configStore.getLegend(),
      });
      this.panel.webview.html = generatePreviewHtml(html, css, vscodeThemeKind, this.configStore.getPreviewWidth());
    } else {
      this.panel.webview.html = generateMarkdownHtml(content, css, vscodeThemeKind, this.extensionUri, this.panel.webview);
    }
  }

  /**
   * 滚动同步
   */
  syncScroll(data: {
    mode: 'scroll' | 'cursor';
    ratio?: number;
    heading?: { level: number; title: string } | null;
    cursorLine?: number;
    linesTotal?: number;
  }): void {
    if (!this.panel || this.currentMode !== 'preview') return;
    this.panel.webview.postMessage({
      type: 'syncScroll',
      ...data
    });
  }

  /**
   * 刷新预览
   */
  refresh(): void {
    if (!this.panel) return;
    if (this.currentDocument) {
      this._updateContent();
      return;
    }
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'markdown') {
      this.currentDocument = editor.document;
      this._updateContent();
    }
  }

  /**
   * 关闭预览面板
   */
  close(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
      this._cleanupListeners();
    }
  }

  /**
   * 清理所有监听器
   */
  private _cleanupListeners(): void {
    console.log('[PreviewManager] _cleanupListeners called, disposables count:', this.disposables.length);
    this.disposables.forEach(d => {
      try {
        d.dispose();
      } catch (e) {
        // 忽略已 dispose 的错误
      }
    });
    this.disposables = [];
  }

  /**
   * 销毁管理器
   */
  dispose(): void {
    this.close();
  }
}