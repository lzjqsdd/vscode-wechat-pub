/**
 * 发布控制器
 * 负责将 Markdown 内容发布到微信草稿箱
 */

import * as vscode from 'vscode';
import { WechatApiClient } from './api';
import { ConfigStore } from '../storage/configStore';
import { DraftMappingStore } from '../storage/draftMapping';
import { renderMarkdown } from '../core/renderer';
import { copyWechatHtml } from '../core/utils/htmlCopy';
import { ThemeManager, ThemeName } from '../preview/themeManager';

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
    const { html, yamlData } = renderMarkdown(content, {
      countStatus: this.configStore.getCountStatus(),
      isMacCodeBlock: this.configStore.getMacCodeBlock()
    });

    const title = yamlData.title || this.extractTitle(content) || '未命名文章';

    // 生成公众号格式 HTML
    const theme = this.configStore.getTheme() as ThemeName;
    const css = this.themeManager.getThemeCSS(theme, this.configStore.getPrimaryColor());
    const wechatHtml = copyWechatHtml(html, css);

    // 检查是否已有草稿
    const existingMediaId = this.draftStore.getMediaId(filePath);

    try {
      if (existingMediaId) {
        await this.api.updateDraft(existingMediaId, 0, title, wechatHtml);
        vscode.window.showInformationMessage(`草稿更新成功`);
      } else {
        const mediaId = await this.api.addDraft(title, wechatHtml);
        this.draftStore.associate(filePath, mediaId, title);
        vscode.window.showInformationMessage(`发布到草稿箱成功`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`发布失败: ${(error as Error).message}`);
    }
  }

  async copyHtml(editor: vscode.TextEditor): Promise<void> {
    const content = editor.document.getText();
    const { html } = renderMarkdown(content, {
      countStatus: this.configStore.getCountStatus(),
      isMacCodeBlock: this.configStore.getMacCodeBlock()
    });

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