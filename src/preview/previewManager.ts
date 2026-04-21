/**
 * 预览管理器
 * 管理 VSCode Webview 预览面板的创建、更新和销毁
 */

import * as vscode from 'vscode';
import { renderMarkdown } from '../core/renderer';
import { ThemeManager, ThemeName } from './themeManager';
import { generateWebviewHtml } from './webviewHtml';
import { ConfigStore } from '../storage/configStore';

/**
 * 预览管理类
 * 负责创建和管理 Markdown 预览 Webview 面板
 */
export class PreviewManager {
  private panel: vscode.WebviewPanel | undefined;
  private themeManager: ThemeManager;
  private configStore: ConfigStore;
  private disposables: vscode.Disposable[] = [];
  private _isDisposed = false;
  private currentDocument: vscode.TextDocument | undefined;

  constructor(
    private extensionUri: vscode.Uri,
    context: vscode.ExtensionContext
  ) {
    this.themeManager = new ThemeManager(extensionUri.fsPath);
    this.configStore = new ConfigStore(context);
  }

  /**
   * 检测 VSCode 颜色主题类型
   * @returns 'light' | 'dark' | 'high-contrast'
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
   * @param editor 当前文本编辑器
   */
  show(editor: vscode.TextEditor): void {
    console.log('[wechatPub] show() called:', {
      documentPath: editor.document.uri.fsPath,
      documentLanguageId: editor.document.languageId,
      contentLength: editor.document.getText().length,
      vscodeThemeKind: this.getVSCodeThemeKind()
    });
    this.currentDocument = editor.document;
    this._showPanel();
    this.update(editor);
    this._setupDocumentListener();
  }

  /**
   * 显示预览面板（从文档直接打开，无需编辑器）
   * @param document 文档
   */
  showDocument(document: vscode.TextDocument): void {
    console.log('[wechatPub] showDocument() called:', {
      documentPath: document.uri.fsPath,
      documentLanguageId: document.languageId,
      contentLength: document.getText().length,
    });
    this.currentDocument = document;
    this._showPanel();
    this._updateFromDocument(document);
    this._setupDocumentListener();
  }

  /**
   * 创建或显示 Webview 面板
   */
  private _showPanel(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Two);
      return;
    }

    // 创建新的 Webview 面板
    this.panel = vscode.window.createWebviewPanel(
      'wechatPubPreview',
      '公众号预览',
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    // 监听面板关闭事件
    this.panel.onDidDispose(() => {
      this._cleanup();
    });

    // 监听 VSCode 颜色主题变化
    const colorThemeDisposable = vscode.window.onDidChangeActiveColorTheme(() => {
      if (this.panel && this.currentDocument) {
        this._updateFromDocument(this.currentDocument);
      }
    });
    this.disposables.push(colorThemeDisposable);
  }

  /**
   * 设置文档变化监听
   */
  private _setupDocumentListener(): void {
    // 避免重复注册
    if (this._documentListenerRegistered) return;
    this._documentListenerRegistered = true;

    // 监听文档变化，实时更新预览
    const changeDisposable = vscode.workspace.onDidChangeTextDocument(e => {
      if (this.currentDocument && e.document.uri.toString() === this.currentDocument.uri.toString()) {
        this._updateFromDocument(e.document);
      }
    });
    this.disposables.push(changeDisposable);

    // 监听活动编辑器变化，切换文档时更新预览
    const switchDisposable = vscode.window.onDidChangeActiveTextEditor(e => {
      if (e && e.document.languageId === 'markdown' && this.panel) {
        this.currentDocument = e.document;
        this._updateFromDocument(e.document);
      }
    });
    this.disposables.push(switchDisposable);
  }

  private _documentListenerRegistered = false;

  /**
   * 更新预览内容
   * @param editor 当前文本编辑器
   */
  update(editor: vscode.TextEditor): void {
    this._updateFromDocument(editor.document);
  }

  /**
   * 从文档更新预览内容
   * @param document 文档
   */
  private _updateFromDocument(document: vscode.TextDocument): void {
    if (!this.panel) {
      console.log('[wechatPub] _updateFromDocument() skipped: no panel');
      return;
    }

    console.log('[wechatPub] _updateFromDocument() called:', {
      documentPath: document.uri.fsPath,
      currentDocumentPath: this.currentDocument?.uri.fsPath,
      vscodeThemeKind: this.getVSCodeThemeKind()
    });

    // 获取文档内容
    const content = document.getText();

    // 渲染 Markdown
    const { html } = renderMarkdown(content, {
      countStatus: this.configStore.getCountStatus(),
      isMacCodeBlock: this.configStore.getMacCodeBlock(),
      citeStatus: this.configStore.getCiteStatus(),
      legend: this.configStore.getLegend(),
    });

    // 获取主题和颜色配置
    const theme = this.configStore.getTheme() as ThemeName;
    const color = this.configStore.getPrimaryColor();
    const vscodeThemeKind = this.getVSCodeThemeKind();
    const css = this.themeManager.getThemeCSS(theme, color, vscodeThemeKind, {
      fontFamily: this.configStore.getFontFamily(),
      fontSize: this.configStore.getFontSize(),
      useIndent: this.configStore.getUseIndent(),
      useJustify: this.configStore.getUseJustify(),
    });

    // 更新 Webview 内容
    this.panel.webview.html = generateWebviewHtml(html, css, vscodeThemeKind, this.configStore.getPreviewWidth());
  }

  /**
   * 刷新预览（使用记住的文档或当前活动编辑器）
   */
  refresh(): void {
    if (!this.panel) {
      return;
    }

    // 优先使用记住的文档
    if (this.currentDocument) {
      this._updateFromDocument(this.currentDocument);
      return;
    }

    // 否则尝试使用当前活动编辑器
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'markdown') {
      this.currentDocument = editor.document;
      this._updateFromDocument(editor.document);
    }
  }

  /**
   * 关闭预览面板
   */
  close(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }
  }

  /**
   * 统一的清理逻辑
   * 防止重复 dispose
   */
  private _cleanup(): void {
    if (this._isDisposed) return;
    this._isDisposed = true;
    this.panel = undefined;
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }

  /**
   * 销毁管理器，清理资源
   */
  dispose(): void {
    this._cleanup();
  }
}