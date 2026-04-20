/**
 * 微信公众号 Custom Editor Provider
 * 实现 CustomTextEditorProvider 接口，为 .md 文件提供自定义编辑器
 */

import * as vscode from 'vscode';
import { EditorStateManager, EditorMode } from './editorStateManager';
import { WebviewMessage, ExtensionMessage } from './webviewMessages';
import { getPreviewWebviewContent } from './previewWebviewContent';
import { ConfigStore } from '../storage/configStore';
import { ThemeManager } from '../preview/themeManager';
import { renderMarkdown } from '../core/renderer';

/**
 * 创建防抖函数
 * @param fn 要防抖的函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  return ((...args: Parameters<T>) => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = undefined;
    }, delay);
  }) as T;
}

/**
 * 微信公众号编辑器 Provider
 */
export class WechatPubEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'wechatPub.markdownEditor';

  private readonly themeManager: ThemeManager;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly stateManager: EditorStateManager,
    private readonly configStore: ConfigStore
  ) {
    this.themeManager = new ThemeManager(context.extensionUri.fsPath);
  }

  /**
   * 注册 Custom Editor Provider
   */
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const stateManager = new EditorStateManager(context);
    const configStore = new ConfigStore(context);
    const provider = new WechatPubEditorProvider(context, stateManager, configStore);

    return vscode.window.registerCustomEditorProvider(
      WechatPubEditorProvider.viewType,
      provider,
      {
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  /**
   * 解析自定义编辑器
   */
  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    // 检查是否已取消
    if (token.isCancellationRequested) {
      return;
    }

    // 配置 webview
    webviewPanel.webview.options = {
      enableScripts: true,
    };

    // 获取当前模式
    const mode = this.stateManager.getMode(document.uri);

    // 设置初始内容
    webviewPanel.webview.html = getPreviewWebviewContent(
      webviewPanel.webview,
      this.context.extensionUri,
      document,
      mode,
      this.configStore,
      this.themeManager
    );

    // 监听 webview 消息
    webviewPanel.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        if (token.isCancellationRequested) {
          return;
        }
        await this.handleWebviewMessage(message, document, webviewPanel);
      },
      undefined,
      this.context.subscriptions
    );

    // 跟踪 panel 是否已销毁
    let isDisposed = false;
    webviewPanel.onDidDispose(() => {
      isDisposed = true;
    }, undefined, this.context.subscriptions);

    // 创建防抖的预览更新函数（200ms 延迟）
    const debouncedUpdatePreview = debounce((doc: vscode.TextDocument) => {
      if (!token.isCancellationRequested && !isDisposed) {
        this.updatePreview(webviewPanel, doc);
      }
    }, 200);

    // 监听文档变化，实时更新预览（使用防抖）
    const changeDisposable = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === document.uri.toString()) {
        debouncedUpdatePreview(document);
      }
    });
    this.context.subscriptions.push(changeDisposable);

    // 监听 VSCode 颜色主题变化
    const colorThemeDisposable = vscode.window.onDidChangeActiveColorTheme(() => {
      if (token.isCancellationRequested || isDisposed) {
        return;
      }
      const currentMode = this.stateManager.getMode(document.uri);
      webviewPanel.webview.html = getPreviewWebviewContent(
        webviewPanel.webview,
        this.context.extensionUri,
        document,
        currentMode,
        this.configStore,
        this.themeManager
      );
    });
    this.context.subscriptions.push(colorThemeDisposable);
  }

  /**
   * 处理来自 webview 的消息
   */
  private async handleWebviewMessage(
    message: WebviewMessage,
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    switch (message.type) {
      case 'switchMode':
        if (message.mode) {
          await this.handleSwitchMode(message.mode, document, webviewPanel);
        }
        break;

      case 'editContent':
        // Markdown 模式下的编辑通知（可用于实时同步）
        break;

      case 'updateContent':
        // 从 Markdown 模式切换回 Preview 模式时，更新文档内容
        if (message.content !== undefined) {
          await this.updateDocumentContent(document, message.content);
        }
        break;
    }
  }

  /**
   * 处理模式切换
   */
  private async handleSwitchMode(
    newMode: EditorMode,
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    // 保存新模式
    this.stateManager.setMode(document.uri, newMode);

    if (newMode === 'preview') {
      // 切换到 Preview 模式，发送渲染后的 HTML
      this.updatePreview(webviewPanel, document);
    } else {
      // 切换到 Markdown 模式，发送原始 Markdown
      this.postMessage(webviewPanel, {
        type: 'switchMode',
        mode: 'markdown',
        markdown: this.escapeMarkdownForWebview(document.getText()),
        html: '',
      });
    }
  }

  /**
   * 更新预览内容
   */
  private updatePreview(
    webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument
  ): void {
    const content = document.getText();
    const { html } = renderMarkdown(content, {
      countStatus: this.configStore.getCountStatus(),
      isMacCodeBlock: this.configStore.getMacCodeBlock(),
      citeStatus: this.configStore.getCiteStatus(),
      legend: this.configStore.getLegend(),
    });

    this.postMessage(webviewPanel, {
      type: 'updatePreview',
      html: html,
    });
  }

  /**
   * 更新文档内容
   */
  private async updateDocumentContent(
    document: vscode.TextDocument,
    newContent: string
  ): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      newContent
    );
    await vscode.workspace.applyEdit(edit);
  }

  /**
   * 发送消息到 webview
   */
  private postMessage(
    webviewPanel: vscode.WebviewPanel,
    message: ExtensionMessage
  ): void {
    webviewPanel.webview.postMessage(message);
  }

  /**
   * 转义 Markdown 用于 webview 传输
   */
  private escapeMarkdownForWebview(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}