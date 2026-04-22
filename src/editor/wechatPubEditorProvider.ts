/**
 * 微信公众号 Custom Editor Provider
 * 实现 CustomTextEditorProvider 接口，为 .md 文件提供自定义编辑器
 * 始终显示 Markdown 编辑模式（源码）
 */

import * as vscode from 'vscode';
import { getMarkdownWebviewContent } from './markdownWebviewContent';
import { ConfigStore } from '../storage/configStore';
import { ThemeManager } from '../preview/themeManager';
import { applyDocumentEdit, debounce } from './documentSync';
import { PreviewManager } from '../preview/previewManager';

/**
 * 微信公众号编辑器 Provider
 */
export class WechatPubEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'wechatPub.markdownEditor';

  private readonly themeManager: ThemeManager;

  // 存储活动的 webview panels
  private static readonly activePanels = new Map<string, vscode.WebviewPanel>();
  private static readonly activeDocuments = new Map<string, vscode.TextDocument>();

  // 存储最后活动的 panel key
  private static lastActivePanelKey: string | undefined;

  // 存储正在从 webview 编辑的文档，用于防止 echo 循环
  private static readonly webviewEditingDocuments = new Set<string>();

  // 自定义 context key，用于控制按钮显示
  private static readonly contextKey = 'wechatPubCustomEditorActive';

  // 存储用于刷新的静态引用
  private static context: vscode.ExtensionContext | undefined;
  private static configStore: ConfigStore | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly configStore: ConfigStore
  ) {
    this.themeManager = new ThemeManager(context.extensionUri.fsPath);
  }

  /**
   * 注册 Custom Editor Provider 和相关命令
   */
  public static register(context: vscode.ExtensionContext): vscode.Disposable[] {
    const configStore = new ConfigStore(context);
    const provider = new WechatPubEditorProvider(context, configStore);

    // 存储静态引用用于刷新
    WechatPubEditorProvider.context = context;
    WechatPubEditorProvider.configStore = configStore;

    // 注册 Custom Editor Provider
    const editorProvider = vscode.window.registerCustomEditorProvider(
      WechatPubEditorProvider.viewType,
      provider,
      {
        supportsMultipleEditorsPerDocument: false,
      }
    );

    // 注册打开分屏预览命令
    const openPreviewCmd = vscode.commands.registerCommand('wechatPub.switchToPreview', () => {
      console.log('[wechatPub] switchToPreview 命令触发 - 打开分屏预览');

      const lastKey = WechatPubEditorProvider.lastActivePanelKey;
      let documentUri: vscode.Uri | undefined;

      if (lastKey) {
        documentUri = vscode.Uri.parse(lastKey, true);
      } else {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.languageId === 'markdown') {
          documentUri = activeEditor.document.uri;
        }
      }

      if (documentUri) {
        // 打开右侧分屏预览
        vscode.workspace.openTextDocument(documentUri).then(doc => {
          const previewManager = PreviewManager.getInstance();
          if (previewManager) {
            previewManager.showDocument(doc);
          }
        });
      } else {
        vscode.window.showWarningMessage('请先打开一个 Markdown 文件');
      }
    });

    context.subscriptions.push(editorProvider, openPreviewCmd);

    return [editorProvider, openPreviewCmd];
  }

  /**
   * 刷新所有活动的编辑器
   */
  public static refreshAll(): void {
    if (!WechatPubEditorProvider.context || !WechatPubEditorProvider.configStore) {
      return;
    }

    const themeManager = new ThemeManager(WechatPubEditorProvider.context.extensionUri.fsPath);

    for (const [key, panel] of WechatPubEditorProvider.activePanels) {
      const document = WechatPubEditorProvider.activeDocuments.get(key);
      if (document && panel) {
        panel.webview.html = getMarkdownWebviewContent(
          panel.webview,
          WechatPubEditorProvider.context.extensionUri,
          document,
          WechatPubEditorProvider.configStore,
          themeManager
        );
      }
    }
  }

  /**
   * 解析自定义文本编辑器
   */
  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    console.log('[wechatPub] resolveCustomTextEditor 开始');

    // 配置 webview
    webviewPanel.webview.options = {
      enableScripts: true,
    };

    // 存储活动的 panel 和 document
    const key = document.uri.toString();
    WechatPubEditorProvider.activePanels.set(key, webviewPanel);
    WechatPubEditorProvider.activeDocuments.set(key, document);
    WechatPubEditorProvider.lastActivePanelKey = key;

    // 设置 context key 为 true
    vscode.commands.executeCommand('setContext', WechatPubEditorProvider.contextKey, true);

    // 设置初始内容（始终为 Markdown 编辑模式）
    webviewPanel.webview.html = this.getMarkdownContent(document, webviewPanel.webview);

    // 监听 webview 消息
    webviewPanel.webview.onDidReceiveMessage(
      async (message: { type: string; content?: string }) => {
        switch (message.type) {
          case 'editContent':
            if (message.content) {
              // 标记正在从 webview 编辑
              WechatPubEditorProvider.webviewEditingDocuments.add(key);
              // 应用编辑
              await applyDocumentEdit(document, message.content);
              // 编辑完成后清除标记
              setTimeout(() => {
                WechatPubEditorProvider.webviewEditingDocuments.delete(key);
              }, 100);
            }
            break;

          case 'openSidePreview':
            // 打开右侧分屏预览
            const previewManager = PreviewManager.getInstance();
            if (previewManager) {
              previewManager.showDocument(document);
            }
            break;
        }
      },
      null,
      []
    );

    // 监听文档变化，实时更新 webview
    const changeDisposable = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === key) {
        // 如果是来自 webview 的编辑，跳过更新避免循环
        if (WechatPubEditorProvider.webviewEditingDocuments.has(key)) {
          return;
        }
        // 使用防抖更新
        this.debouncedUpdate(webviewPanel.webview, document);
      }
    });

    // 监听 panel 关闭
    webviewPanel.onDidDispose(() => {
      changeDisposable.dispose();
      WechatPubEditorProvider.activePanels.delete(key);
      WechatPubEditorProvider.activeDocuments.delete(key);
      if (WechatPubEditorProvider.lastActivePanelKey === key) {
        WechatPubEditorProvider.lastActivePanelKey = undefined;
        vscode.commands.executeCommand('setContext', WechatPubEditorProvider.contextKey, false);
      }
    });

    // 监听 panel 状态变化
    webviewPanel.onDidChangeViewState(() => {
      if (webviewPanel.active) {
        WechatPubEditorProvider.lastActivePanelKey = key;
        vscode.commands.executeCommand('setContext', WechatPubEditorProvider.contextKey, true);
      }
    });
  }

  /**
   * 获取当前活动的 Markdown 文档
   * 优先从 Custom Editor 获取，其次从 activeTextEditor 获取
   * @returns 文档 URI 或 undefined
   */
  public static getActiveMarkdownUri(): vscode.Uri | undefined {
    // 优先从 Custom Editor 获取
    const lastKey = WechatPubEditorProvider.lastActivePanelKey;
    if (lastKey) {
      try {
        return vscode.Uri.parse(lastKey, true);
      } catch (e) {
        console.error('[wechatPub] URI 解析失败:', e);
      }
    }

    // 其次从 activeTextEditor 获取
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.languageId === 'markdown') {
      return activeEditor.document.uri;
    }

    return undefined;
  }

  /**
   * 获取当前活动的 Markdown 文档内容
   * @returns 文档内容或 undefined
   */
  public static getActiveMarkdownContent(): string | undefined {
    const uri = WechatPubEditorProvider.getActiveMarkdownUri();
    if (!uri) {
      return undefined;
    }

    // 从 activeDocuments 获取（Custom Editor 场景）
    const key = uri.toString();
    const doc = WechatPubEditorProvider.activeDocuments.get(key);
    if (doc) {
      return doc.getText();
    }

    // 从 activeTextEditor 获取
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.uri.toString() === key) {
      return activeEditor.document.getText();
    }

    return undefined;
  }

  /**
   * 获取 Markdown 编辑内容
   */
  private getMarkdownContent(document: vscode.TextDocument, webview: vscode.Webview): string {
    return getMarkdownWebviewContent(
      webview,
      this.context.extensionUri,
      document,
      this.configStore,
      this.themeManager
    );
  }

  /**
   * 防抖更新
   */
  private debouncedUpdate = debounce((webview: vscode.Webview, document: vscode.TextDocument) => {
    webview.html = this.getMarkdownContent(document, webview);
  }, 100);
}