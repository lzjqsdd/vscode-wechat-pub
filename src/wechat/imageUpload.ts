/**
 * 图片上传服务
 * 支持上传本地图片到公众号，并替换 Markdown 中的图片路径
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WechatApiClient } from './api';
import { ConfigStore } from '../storage/configStore';
import { ImageRegistry } from '../storage/imageRegistry';

export class ImageUploadService {
  private api: WechatApiClient;
  private configStore: ConfigStore;
  private imageRegistry: ImageRegistry;

  constructor(configStore: ConfigStore, imageRegistry: ImageRegistry) {
    this.configStore = configStore;
    this.api = new WechatApiClient(configStore.getWechatConfig());
    this.imageRegistry = imageRegistry;
  }

  /**
   * 上传本地图片文件到公众号
   * @param filePath 图片文件路径
   * @returns 返回公众号图片 URL
   */
  async uploadLocalImage(filePath: string): Promise<string> {
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    // 检查文件类型
    const ext = path.extname(filePath).toLowerCase();
    const allowedExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    if (!allowedExts.includes(ext)) {
      throw new Error(`不支持的图片格式: ${ext}`);
    }

    // 读取文件
    const buffer = fs.readFileSync(filePath);
    const filename = path.basename(filePath);

    // 上传到公众号
    return await this.api.uploadImage(buffer, filename);
  }

  /**
   * 上传图片并替换编辑器中的图片路径
   * @param editor VSCode 编辑器
   * @param localPath 本地图片路径
   * @param url 公众号图片 URL
   */
  async replaceImagePath(
    editor: vscode.TextEditor,
    localPath: string,
    url: string
  ): Promise<void> {
    const document = editor.document;
    const text = document.getText();

    // 查找并替换图片路径
    // 支持 Markdown 格式: ![alt](path) 和 HTML 格式: <img src="path">
    const patterns = [
      // Markdown 格式
      new RegExp(`\\!\\[[^\\]]*\\]\\(${this.escapeRegex(localPath)}\\)`, 'g'),
      // HTML 格式
      new RegExp(`<img[^>]*src="${this.escapeRegex(localPath)}"[^>]*>`, 'g'),
      // 相对路径
      new RegExp(`\\!\\[[^\\]]*\\]\\(${this.escapeRegex(path.basename(localPath))}\\)`, 'g')
    ];

    let newText = text;
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        newText = newText.replace(pattern, (match) => {
          return match.replace(localPath, url).replace(path.basename(localPath), url);
        });
      }
    }

    // 应用编辑
    if (newText !== text) {
      await editor.edit(editBuilder => {
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(text.length)
        );
        editBuilder.replace(fullRange, newText);
      });
    }
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 处理图片上传命令
   * @param uri 文件 URI（来自资源管理器右键或编辑器）
   */
  async handleUploadCommand(uri?: vscode.Uri): Promise<void> {
    // 检查微信配置
    if (!this.configStore.isWechatConfigured()) {
      vscode.window.showErrorMessage('请先配置微信公众号 AppID 和 AppSecret');
      return;
    }

    let imagePath: string;

    // 获取图片路径
    if (uri && uri.fsPath) {
      imagePath = uri.fsPath;
    } else {
      // 从当前编辑器获取图片路径
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('请选择一个图片文件');
        return;
      }

      // 尝试从选区获取图片路径
      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);

      // 匹配 Markdown 图片语法
      const match = selectedText.match(/!\[[^\]]*\]\(([^)]+)\)/);
      if (match && match[1]) {
        imagePath = match[1];
        // 处理相对路径
        if (!path.isAbsolute(imagePath)) {
          const docPath = editor.document.uri.fsPath;
          const docDir = path.dirname(docPath);
          imagePath = path.resolve(docDir, imagePath);
        }
      } else {
        vscode.window.showWarningMessage('请选择一个图片路径或右键点击图片文件');
        return;
      }
    }

    // 显示进度
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: '上传图片到公众号...',
      cancellable: false
    }, async () => {
      try {
        const url = await this.uploadLocalImage(imagePath);

        // 自动记录到 ImageRegistry
        this.imageRegistry.register(imagePath, url);

        vscode.window.showInformationMessage(`图片上传成功`);

        // 询问下一步操作
        const action = await vscode.window.showQuickPick(
          ['替换文档中的图片路径', '仅复制链接'],
          { placeHolder: '选择下一步操作' }
        );

        if (action === '替换文档中的图片路径') {
          const editor = vscode.window.activeTextEditor;
          if (editor && editor.document.languageId === 'markdown') {
            await this.replaceImagePath(editor, imagePath, url);
            vscode.window.showInformationMessage('图片路径已替换');
          }
        } else {
          await vscode.env.clipboard.writeText(url);
          vscode.window.showInformationMessage('图片链接已复制到剪贴板');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`上传失败: ${(error as Error).message}`);
      }
    });
  }
}