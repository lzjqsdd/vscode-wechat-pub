/**
 * 文件-草稿映射存储模块
 * 用于关联本地 Markdown 文件和微信草稿 media_id
 */

import * as vscode from 'vscode';

export interface DraftMapping {
  filePath: string;
  mediaId: string;
  title: string;
  updatedAt: number;
}

/**
 * 草稿映射存储类
 * 管理本地文件与微信草稿的关联关系
 */
export class DraftMappingStore {
  private context: vscode.ExtensionContext;
  private mappings: Map<string, DraftMapping> = new Map();

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.load();
  }

  /**
   * 从 globalState 加载映射数据
   */
  private load(): void {
    const data = this.context.globalState.get<DraftMapping[]>('draftMappings', []);
    data.forEach(m => this.mappings.set(m.filePath, m));
  }

  /**
   * 保存映射数据到 globalState
   */
  private save(): void {
    const data = Array.from(this.mappings.values());
    this.context.globalState.update('draftMappings', data);
  }

  /**
   * 创建或更新文件与草稿的关联
   * @param filePath 本地文件路径
   * @param mediaId 微信草稿 media_id
   * @param title 文章标题
   */
  associate(filePath: string, mediaId: string, title: string): void {
    this.mappings.set(filePath, {
      filePath,
      mediaId,
      title,
      updatedAt: Date.now()
    });
    this.save();
  }

  /**
   * 获取文件对应的草稿 media_id
   * @param filePath 本地文件路径
   * @returns media_id 或 undefined
   */
  getMediaId(filePath: string): string | undefined {
    return this.mappings.get(filePath)?.mediaId;
  }

  /**
   * 获取文件的草稿完整信息
   * @param filePath 本地文件路径
   * @returns 草稿映射信息或 undefined
   */
  getDraftInfo(filePath: string): DraftMapping | undefined {
    return this.mappings.get(filePath);
  }

  /**
   * 移除文件的草稿关联
   * @param filePath 本地文件路径
   */
  remove(filePath: string): void {
    this.mappings.delete(filePath);
    this.save();
  }

  /**
   * 获取所有草稿映射
   * @returns 所有映射列表
   */
  getAll(): DraftMapping[] {
    return Array.from(this.mappings.values());
  }

  /**
   * 检查文件是否已关联草稿
   * @param filePath 本地文件路径
   * @returns 是否存在关联
   */
  has(filePath: string): boolean {
    return this.mappings.has(filePath);
  }

  /**
   * 根据 media_id 查找对应的文件路径
   * @param mediaId 微信草稿 media_id
   * @returns 文件路径或 undefined
   */
  getFilePathByMediaId(mediaId: string): string | undefined {
    for (const mapping of this.mappings.values()) {
      if (mapping.mediaId === mediaId) {
        return mapping.filePath;
      }
    }
    return undefined;
  }

  /**
   * 清除所有映射数据
   */
  clear(): void {
    this.mappings.clear();
    this.save();
  }
}