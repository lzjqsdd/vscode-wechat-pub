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

    // 如果面板已存在，直接显示并更新
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Two);
      this.update(editor);
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

    // 初始更新
    this.update(editor);

    // 监听文档变化，实时更新预览
    const changeDisposable = vscode.workspace.onDidChangeTextDocument(e => {
      if (this.currentDocument && e.document.uri.fsPath === this.currentDocument.uri.fsPath) {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.uri.fsPath === this.currentDocument.uri.fsPath) {
          this.update(activeEditor);
        }
      }
    });
    this.disposables.push(changeDisposable);

    // 监听活动编辑器变化，切换文档时更新预览
    const switchDisposable = vscode.window.onDidChangeActiveTextEditor(e => {
      if (e && e.document.languageId === 'markdown' && this.panel) {
        this.currentDocument = e.document;
        this.update(e);
      }
    });
    this.disposables.push(switchDisposable);

    // 监听 VSCode 颜色主题变化
    const colorThemeDisposable = vscode.window.onDidChangeActiveColorTheme(() => {
      if (this.panel) {
        this.refresh();
      }
    });
    this.disposables.push(colorThemeDisposable);
  }

  /**
   * 更新预览内容
   * @param editor 当前文本编辑器
   */
  update(editor: vscode.TextEditor): void {
    if (!this.panel) {
      console.log('[wechatPub] update() skipped: no panel');
      return;
    }

    console.log('[wechatPub] update() called:', {
      documentPath: editor.document.uri.fsPath,
      currentDocumentPath: this.currentDocument?.uri.fsPath,
      activeEditorPath: vscode.window.activeTextEditor?.document.uri.fsPath,
      vscodeThemeKind: this.getVSCodeThemeKind()
    });

    // 获取文档内容
    const content = editor.document.getText();

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
    this.panel.webview.html = generateWebviewHtml(html, css, vscodeThemeKind);
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
      // 找到该文档对应的编辑器
      const visibleEditors = vscode.window.visibleTextEditors;
      const targetEditor = visibleEditors.find(e => e.document.uri.fsPath === this.currentDocument!.uri.fsPath);
      if (targetEditor) {
        this.update(targetEditor);
        return;
      }
      // 如果找不到编辑器，直接用文档内容更新
      const content = this.currentDocument.getText();
      const { html } = renderMarkdown(content, {
        countStatus: this.configStore.getCountStatus(),
        isMacCodeBlock: this.configStore.getMacCodeBlock(),
        citeStatus: this.configStore.getCiteStatus(),
        legend: this.configStore.getLegend(),
      });
      const theme = this.configStore.getTheme() as ThemeName;
      const color = this.configStore.getPrimaryColor();
      const vscodeThemeKind = this.getVSCodeThemeKind();
      const css = this.themeManager.getThemeCSS(theme, color, vscodeThemeKind, {
        fontFamily: this.configStore.getFontFamily(),
        fontSize: this.configStore.getFontSize(),
        useIndent: this.configStore.getUseIndent(),
        useJustify: this.configStore.getUseJustify(),
      });
      this.panel.webview.html = generateWebviewHtml(html, css, vscodeThemeKind);
      return;
    }

    // 否则尝试使用当前活动编辑器
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'markdown') {
      this.currentDocument = editor.document;
      this.update(editor);
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