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

  constructor(
    private extensionUri: vscode.Uri,
    context: vscode.ExtensionContext
  ) {
    this.themeManager = new ThemeManager(extensionUri.fsPath);
    this.configStore = new ConfigStore(context);
  }

  /**
   * 显示预览面板
   * @param editor 当前文本编辑器
   */
  show(editor: vscode.TextEditor): void {
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
      if (e.document === editor.document) {
        this.update(editor);
      }
    });
    this.disposables.push(changeDisposable);
  }

  /**
   * 更新预览内容
   * @param editor 当前文本编辑器
   */
  update(editor: vscode.TextEditor): void {
    if (!this.panel) {
      return;
    }

    // 获取文档内容
    const content = editor.document.getText();

    // 渲染 Markdown
    const { html } = renderMarkdown(content, {
      countStatus: this.configStore.getCountStatus(),
      isMacCodeBlock: this.configStore.getMacCodeBlock(),
    });

    // 获取主题和颜色配置
    const theme = this.configStore.getTheme() as ThemeName;
    const color = this.configStore.getPrimaryColor();
    const css = this.themeManager.getThemeCSS(theme, color);

    // 更新 Webview 内容
    this.panel.webview.html = generateWebviewHtml(html, css);
  }

  /**
   * 刷新预览（使用当前活动编辑器）
   */
  refresh(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor && this.panel) {
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