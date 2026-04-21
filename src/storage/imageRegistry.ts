/**
 * 图片记录管理模块
 * 管理 .wechat-pub/images.json 的读写操作
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface ImageRecord {
  localPath: string;       // 相对路径
  wechatUrl: string;       // 微信图片 URL
  uploadTime: string;      // ISO 日期字符串
  filename?: string;       // 原始文件名
}

export interface ImageRegistryData {
  images: ImageRecord[];
}

export class ImageRegistry {
  private registryPath: string;
  private data: ImageRegistryData;
  private workspaceRoot: string | undefined;
  private _onDidChange = new vscode.EventEmitter<void>();

  /** 数据变化事件，用于刷新 TreeView 和 FileDecoration */
  onDidChange = this._onDidChange.event;

  constructor(workspaceRoot: string | undefined) {
    this.workspaceRoot = workspaceRoot;
    this.registryPath = workspaceRoot
      ? path.join(workspaceRoot, '.wechat-pub', 'images.json')
      : '';
    this.data = { images: [] };
    this.load();
  }

  /** 加载图片记录 */
  private load(): void {
    if (!this.registryPath || !fs.existsSync(this.registryPath)) {
      return;
    }
    try {
      const content = fs.readFileSync(this.registryPath, 'utf-8');
      this.data = JSON.parse(content);
    } catch (e) {
      console.error('加载图片记录失败:', e);
      this.data = { images: [] };
    }
  }

  /** 保存图片记录 */
  private save(): void {
    if (!this.registryPath || !this.workspaceRoot) {
      return;
    }
    // 确保 .wechat-pub 目录存在
    const dir = path.dirname(this.registryPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.registryPath, JSON.stringify(this.data, null, 2));
    this._onDidChange.fire();
  }

  /** 注册图片（上传成功后调用） */
  register(localPath: string, wechatUrl: string): void {
    // 存储相对路径
    const relativePath = this.getRelativePath(localPath);
    const filename = path.basename(localPath);

    // 检查是否已存在记录（更新而非重复添加）
    const existing = this.data.images.find(
      img => img.localPath === relativePath
    );

    if (existing) {
      existing.wechatUrl = wechatUrl;
      existing.uploadTime = new Date().toISOString();
    } else {
      this.data.images.push({
        localPath: relativePath,
        wechatUrl,
        uploadTime: new Date().toISOString(),
        filename
      });
    }
    this.save();
  }

  /** 获取相对路径 */
  private getRelativePath(absolutePath: string): string {
    if (!this.workspaceRoot) {
      return absolutePath;
    }
    return path.relative(this.workspaceRoot, absolutePath);
  }

  /** 获取绝对路径 */
  getAbsolutePath(relativePath: string): string | undefined {
    if (!this.workspaceRoot) {
      return undefined;
    }
    return path.resolve(this.workspaceRoot, relativePath);
  }

  /** 根据本地路径获取微信 URL */
  getUrlByLocalPath(localPath: string): string | undefined {
    const relativePath = this.getRelativePath(localPath);
    return this.data.images.find(img => img.localPath === relativePath)?.wechatUrl;
  }

  /** 根据微信 URL 获取本地路径 */
  getLocalPathByUrl(wechatUrl: string): string | undefined {
    const record = this.data.images.find(img => img.wechatUrl === wechatUrl);
    if (!record) {
      return undefined;
    }
    return this.getAbsolutePath(record.localPath);
  }

  /** 获取所有图片记录 */
  getAll(): ImageRecord[] {
    return this.data.images;
  }

  /** 检查文件是否已上传 */
  isUploaded(localPath: string): boolean {
    const relativePath = this.getRelativePath(localPath);
    return this.data.images.some(img => img.localPath === relativePath);
  }

  /** 删除图片记录 */
  remove(localPath: string): void {
    const relativePath = this.getRelativePath(localPath);
    this.data.images = this.data.images.filter(
      img => img.localPath !== relativePath
    );
    this.save();
  }

  /** 清空所有记录 */
  clear(): void {
    this.data.images = [];
    this.save();
  }
}