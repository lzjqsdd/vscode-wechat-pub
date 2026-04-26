/**
 * 图片上传服务
 * 支持上传本地图片到公众号，并替换 Markdown 中的图片路径
 * 自动压缩超过大小限制的图片（使用纯 JS 的 jimp 库）
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Jimp, JimpMime } from 'jimp';
import { WechatApiClient } from './api';
import { ConfigStore } from '../storage/configStore';
import { ImageRegistry } from '../storage/imageRegistry';

// 公众号图片大小限制
const MAX_SIZE_MB = 2;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

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
   * 使用 Jimp 压缩图片
   * @param filePath 图片路径
   * @param maxSizeBytes 最大大小（字节）
   * @returns 压缩后的图片 Buffer 和文件名
   */
  private async compressImage(filePath: string, maxSizeBytes: number): Promise<{ buffer: Buffer; filename: string }> {
    const ext = path.extname(filePath).toLowerCase();
    const originalFilename = path.basename(filePath);
    const originalSize = fs.statSync(filePath).size;

    console.log(`[wechatPub] 开始压缩图片: ${originalFilename}, 原大小: ${(originalSize / 1024 / 1024).toFixed(2)}MB`);

    // 读取图片
    const image = await Jimp.read(filePath);

    // 获取原始尺寸
    const originalWidth = image.width;
    const originalHeight = image.height;

    // 压缩策略：逐步降低质量和尺寸
    let quality = 85;
    let scale = 1.0;
    let buffer: Buffer | null = null;
    // PNG 大图转为 JPG 以获得更小体积
    const outputMime = ext === '.png' ? JimpMime.jpeg : JimpMime.jpeg;

    // 循环尝试不同参数直到满足大小限制
    while (quality >= 30 && scale >= 0.3) {
      try {
        // 计算缩放后的尺寸
        const newWidth = Math.round(originalWidth * scale);
        const newHeight = Math.round(originalHeight * scale);

        // 缩放图片（使用 resize 方法）
        if (scale < 1.0) {
          image.resize({ w: newWidth, h: newHeight });
        }

        // 获取 Buffer（JPEG 格式，设置质量）
        buffer = await image.getBuffer(outputMime, { quality });

        const sizeMB = buffer.length / 1024 / 1024;
        console.log(`[wechatPub] 压缩尝试: quality=${quality}, scale=${scale.toFixed(2)}, size=${sizeMB.toFixed(2)}MB`);

        if (buffer.length <= maxSizeBytes) {
          console.log(`[wechatPub] 压缩成功: 最终大小 ${sizeMB.toFixed(2)}MB`);
          break;
        }

        // 先降低质量，再缩小尺寸
        if (quality > 50) {
          quality -= 15;
        } else if (quality > 30) {
          quality -= 10;
          scale -= 0.15;
        } else {
          scale -= 0.1;
        }
      } catch (e) {
        console.error('[wechatPub] 压缩失败:', e);
        break;
      }
    }

    if (!buffer || buffer.length > maxSizeBytes) {
      throw new Error(
        `图片压缩后仍超过限制（${(buffer?.length || originalSize) / 1024 / 1024}MB > ${MAX_SIZE_MB}MB）。\n` +
        `建议使用专业工具预先处理: tinypng.com 或 squoosh.app`
      );
    }

    // 生成新文件名（PNG 转 JPG 时修改扩展名）
    let newFilename = originalFilename;
    if (ext === '.png') {
      newFilename = originalFilename.replace('.png', '.jpg');
    }

    return { buffer, filename: newFilename };
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

    // 检查文件大小
    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);

    let uploadBuffer: Buffer;
    let filename = path.basename(filePath);

    if (fileSizeMB > MAX_SIZE_MB) {
      // 提示用户正在自动压缩
      vscode.window.showInformationMessage(
        `图片大小 ${fileSizeMB.toFixed(2)}MB 超过限制，正在自动压缩...`
      );

      // 自动压缩
      const { buffer, filename: newFilename } = await this.compressImage(filePath, MAX_SIZE_BYTES);
      uploadBuffer = buffer;
      filename = newFilename;

      vscode.window.showInformationMessage(
        `图片已压缩为 ${(uploadBuffer.length / 1024 / 1024).toFixed(2)}MB，正在上传...`
      );
    } else {
      // 直接读取
      uploadBuffer = fs.readFileSync(filePath);
    }

    // 上传到公众号
    return await this.api.uploadImage(uploadBuffer, filename);
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