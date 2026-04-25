/**
 * 图片上传服务
 * 支持上传本地图片到公众号，并替换 Markdown 中的图片路径
 * 自动压缩超过大小限制的图片
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
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
   * 压缩图片到指定大小以内
   * @param filePath 图片路径
   * @param maxSizeBytes 最大大小（字节）
   * @returns 压缩后的图片 Buffer
   */
  private async compressImage(filePath: string, maxSizeBytes: number): Promise<{ buffer: Buffer; wasCompressed: boolean }> {
    const originalBuffer = fs.readFileSync(filePath);
    const originalSize = originalBuffer.length;

    // 如果已经满足大小限制，直接返回
    if (originalSize <= maxSizeBytes) {
      return { buffer: originalBuffer, wasCompressed: false };
    }

    const ext = path.extname(filePath).toLowerCase();
    const originalSizeMB = originalSize / (1024 * 1024);

    console.log(`[wechatPub] 图片大小 ${originalSizeMB.toFixed(2)}MB 超过限制，开始自动压缩...`);

    // 获取图片元信息
    const metadata = await sharp(originalBuffer).metadata();
    const originalWidth = metadata.width || 800;
    const originalHeight = metadata.height || 600;

    // 压缩策略：逐步降低质量和尺寸
    let compressedBuffer: Buffer | null = null;
    let currentQuality = 85;  // 初始质量
    let currentScale = 1.0;   // 初始缩放比例

    // 根据图片格式选择压缩策略
    const isPng = ext === '.png';
    const isJpeg = ext === '.jpg' || ext === '.jpeg';
    const isGif = ext === '.gif';
    const isWebp = ext === '.webp';

    // 尝试不同压缩参数
    while (currentQuality >= 20 && currentScale >= 0.3) {
      try {
        const scaledWidth = Math.round(originalWidth * currentScale);
        const scaledHeight = Math.round(originalHeight * currentScale);

        let sharpInstance = sharp(originalBuffer)
          .resize(scaledWidth, scaledHeight, {
            fit: 'inside',
            withoutEnlargement: true
          });

        // 根据格式选择输出选项
        if (isPng) {
          // PNG: 使用 JPEG 输出（更小），或者压缩 PNG
          // 对于大 PNG，转为 JPEG 通常能大幅减小体积
          sharpInstance = sharpInstance
            .flatten({ background: { r: 255, g: 255, b: 255, alpha: 1 } }) // 移除透明通道
            .jpeg({ quality: currentQuality, mozjpeg: true });
        } else if (isJpeg || isWebp) {
          sharpInstance = sharpInstance.jpeg({ quality: currentQuality, mozjpeg: true });
        } else if (isGif) {
          // GIF 不支持 sharp 压缩，尝试转为 JPEG
          sharpInstance = sharpInstance.jpeg({ quality: currentQuality, mozjpeg: true });
        } else {
          sharpInstance = sharpInstance.jpeg({ quality: currentQuality, mozjpeg: true });
        }

        compressedBuffer = await sharpInstance.toBuffer();

        console.log(`[wechatPub] 压缩尝试: quality=${currentQuality}, scale=${currentScale.toFixed(2)}, size=${(compressedBuffer.length / 1024 / 1024).toFixed(2)}MB`);

        if (compressedBuffer.length <= maxSizeBytes) {
          console.log(`[wechatPub] 压缩成功: ${(compressedBuffer.length / 1024 / 1024).toFixed(2)}MB`);
          break;
        }

        // 先降低质量，再缩小尺寸
        if (currentQuality > 50) {
          currentQuality -= 10;
        } else if (currentQuality > 30) {
          currentQuality -= 5;
          currentScale -= 0.1;
        } else {
          currentQuality -= 5;
          currentScale -= 0.1;
        }
      } catch (e) {
        console.error('[wechatPub] 压缩失败:', e);
        break;
      }
    }

    if (!compressedBuffer || compressedBuffer.length > maxSizeBytes) {
      throw new Error(
        `图片压缩后仍超过限制（${(compressedBuffer?.length || originalSize) / 1024 / 1024}MB > ${MAX_SIZE_MB}MB）。` +
        `建议使用专业工具预先处理，如 tinypng.com 或 squoosh.app`
      );
    }

    return { buffer: compressedBuffer, wasCompressed: true };
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

    // 检查文件大小，决定是否需要压缩
    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);

    let uploadBuffer: Buffer;
    let filename = path.basename(filePath);

    if (fileSizeMB > MAX_SIZE_MB) {
      // 提示用户将要自动压缩
      vscode.window.showInformationMessage(
        `图片大小 ${fileSizeMB.toFixed(2)}MB 超过限制，正在自动压缩...`
      );

      // 自动压缩
      const { buffer, wasCompressed } = await this.compressImage(filePath, MAX_SIZE_BYTES);
      uploadBuffer = buffer;

      // 如果压缩了，修改文件名（PNG 转 JPEG）
      if (wasCompressed && ext === '.png') {
        filename = filename.replace('.png', '.jpg');
      }
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