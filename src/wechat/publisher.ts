/**
 * 发布控制器
 * 负责将 Markdown 内容发布到微信草稿箱
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WechatApiClient } from './api';
import { ConfigStore } from '../storage/configStore';
import { DraftMappingStore } from '../storage/draftMapping';
import { ImageRegistry } from '../storage/imageRegistry';
import { renderMarkdown } from '../core/renderer';
import { copyWechatHtml } from '../core/utils/htmlCopy';
import { ThemeManager, ThemeName } from '../preview/themeManager';

export class Publisher {
  private api: WechatApiClient;
  private draftStore: DraftMappingStore;
  private imageRegistry: ImageRegistry;
  private themeManager: ThemeManager;

  constructor(
    private configStore: ConfigStore,
    draftStore: DraftMappingStore,
    imageRegistry: ImageRegistry,
    extensionPath: string
  ) {
    const config = configStore.getWechatConfig();
    this.api = new WechatApiClient(config);
    this.draftStore = draftStore;
    this.imageRegistry = imageRegistry;
    this.themeManager = new ThemeManager(extensionPath);
  }

  /**
   * 从 HTML 中提取微信图片 URL
   */
  private extractWechatImageUrls(html: string): string[] {
    const regex = /https?:\/\/mmbiz\.qpic\.cn[^"']*/gi;
    const matches = html.match(regex) || [];
    return matches;
  }

  /**
   * 获取封面图 media_id
   * 优先级：1. 从文章中提取已上传图片并上传为永久素材  2. 使用上次保存的封面图
   */
  private async getThumbMediaId(html: string, documentPath: string): Promise<string | undefined> {
    // 尝试从文章中提取已上传的微信图片
    const wechatUrls = this.extractWechatImageUrls(html);

    for (const url of wechatUrls) {
      // 查找对应的本地图片路径
      const localPath = this.imageRegistry.getLocalPathByUrl(url);
      if (localPath && fs.existsSync(localPath)) {
        try {
          // 上传为永久素材作为封面图
          const buffer = fs.readFileSync(localPath);
          const filename = path.basename(localPath);
          const mediaId = await this.api.uploadMaterial(buffer, filename);
          // 保存封面图 media_id
          this.configStore.setLastThumbMediaId(mediaId);
          return mediaId;
        } catch (error) {
          console.error('[wechatPub] 上传封面图失败:', error);
          // 继续尝试下一个图片
        }
      }
    }

    // 如果文章中没有可用的图片，使用上次保存的封面图
    return this.configStore.getLastThumbMediaId();
  }

  async publish(editor: vscode.TextEditor): Promise<void> {
    // 配置校验
    if (!this.configStore.isWechatConfigured()) {
      vscode.window.showErrorMessage('请先配置微信公众号 AppID 和 AppSecret');
      return;
    }

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: '发布到公众号草稿箱...',
      cancellable: false
    }, async () => {
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
          // 获取封面图
          const thumbMediaId = await this.getThumbMediaId(wechatHtml, filePath);

          if (!thumbMediaId) {
            vscode.window.showWarningMessage('请先上传一张图片作为封面图，或在文章中添加已上传的图片');
            return;
          }

          const mediaId = await this.api.addDraft(title, wechatHtml, thumbMediaId);
          this.draftStore.associate(filePath, mediaId, title);
          vscode.window.showInformationMessage(`发布到草稿箱成功`);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`发布失败: ${(error as Error).message}`);
      }
    });
  }

  /**
   * 发布文档到公众号草稿箱（支持 TextDocument 参数）
   */
  async publishDocument(document: vscode.TextDocument): Promise<void> {
    // 配置校验
    if (!this.configStore.isWechatConfigured()) {
      vscode.window.showErrorMessage('请先配置微信公众号 AppID 和 AppSecret');
      return;
    }

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: '发布到公众号草稿箱...',
      cancellable: false
    }, async () => {
      const filePath = document.uri.fsPath;
      const content = document.getText();
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
          // 获取封面图
          const thumbMediaId = await this.getThumbMediaId(wechatHtml, filePath);

          if (!thumbMediaId) {
            vscode.window.showWarningMessage('请先上传一张图片作为封面图，或在文章中添加已上传的图片');
            return;
          }

          const mediaId = await this.api.addDraft(title, wechatHtml, thumbMediaId);
          this.draftStore.associate(filePath, mediaId, title);
          vscode.window.showInformationMessage(`发布到草稿箱成功`);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`发布失败: ${(error as Error).message}`);
      }
    });
  }

  async copyHtml(editor: vscode.TextEditor): Promise<void> {
    try {
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
    } catch (error) {
      vscode.window.showErrorMessage(`复制失败: ${(error as Error).message}`);
    }
  }

  private extractTitle(content: string): string | undefined {
    const firstLine = content.split('\n')[0];
    if (firstLine.startsWith('# ')) {
      return firstLine.slice(2).trim();
    }
    return undefined;
  }

  /**
   * 更新配置（当 VSCode 配置变化时调用）
   */
  updateConfig(): void {
    const config = this.configStore.getWechatConfig();
    this.api.updateConfig(config);
  }
}