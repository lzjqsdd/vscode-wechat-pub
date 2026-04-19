/**
 * 配置存储模块
 * 用于管理用户配置项（主题、颜色、公众号配置等）
 */

import * as vscode from 'vscode';

export interface WechatConfig {
  appId: string;
  appSecret: string;
  proxyOrigin: string;
}

/**
 * 配置存储类
 * 管理用户偏好设置和微信配置
 */
export class ConfigStore {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * 获取微信公众号配置
   * @returns 微信配置对象
   */
  getWechatConfig(): WechatConfig {
    const config = vscode.workspace.getConfiguration('wechatPub');
    return {
      appId: config.get('appId', ''),
      appSecret: config.get('appSecret', ''),
      proxyOrigin: config.get('proxyOrigin', '')
    };
  }

  /**
   * 更新微信公众号配置
   * @param wechatConfig 微信配置对象
   */
  async updateWechatConfig(wechatConfig: Partial<WechatConfig>): Promise<void> {
    const config = vscode.workspace.getConfiguration('wechatPub');
    if (wechatConfig.appId !== undefined) {
      await config.update('appId', wechatConfig.appId, vscode.ConfigurationTarget.Global);
    }
    if (wechatConfig.appSecret !== undefined) {
      await config.update('appSecret', wechatConfig.appSecret, vscode.ConfigurationTarget.Global);
    }
    if (wechatConfig.proxyOrigin !== undefined) {
      await config.update('proxyOrigin', wechatConfig.proxyOrigin, vscode.ConfigurationTarget.Global);
    }
  }

  /**
   * 获取主题设置
   * @returns 主题名称
   */
  getTheme(): string {
    return this.context.workspaceState.get('theme', 'default');
  }

  /**
   * 设置主题
   * @param theme 主题名称
   */
  setTheme(theme: string): void {
    this.context.workspaceState.update('theme', theme);
  }

  /**
   * 获取主色调
   * @returns 颜色值
   */
  getPrimaryColor(): string {
    return this.context.workspaceState.get('primaryColor', '#35b378');
  }

  /**
   * 设置主色调
   * @param color 颜色值
   */
  setPrimaryColor(color: string): void {
    this.context.workspaceState.update('primaryColor', color);
  }

  /**
   * 获取是否使用 Mac 风格代码块
   * @returns 是否启用
   */
  getMacCodeBlock(): boolean {
    return this.context.workspaceState.get('isMacCodeBlock', true);
  }

  /**
   * 设置是否使用 Mac 风格代码块
   * @param value 是否启用
   */
  setMacCodeBlock(value: boolean): void {
    this.context.workspaceState.update('isMacCodeBlock', value);
  }

  /**
   * 获取字数统计状态
   * @returns 是否启用
   */
  getCountStatus(): boolean {
    return this.context.workspaceState.get('countStatus', true);
  }

  /**
   * 设置字数统计状态
   * @param value 是否启用
   */
  setCountStatus(value: boolean): void {
    this.context.workspaceState.update('countStatus', value);
  }

  /**
   * 获取最后使用的封面图 media_id
   * @returns media_id 或 undefined
   */
  getLastThumbMediaId(): string | undefined {
    return this.context.workspaceState.get('lastThumbMediaId');
  }

  /**
   * 设置最后使用的封面图 media_id
   * @param mediaId 封面图 media_id
   */
  setLastThumbMediaId(mediaId: string): void {
    this.context.workspaceState.update('lastThumbMediaId', mediaId);
  }

  /**
   * 获取自动保存间隔（毫秒）
   * @returns 间隔时间，默认 30000ms
   */
  getAutoSaveInterval(): number {
    return this.context.workspaceState.get('autoSaveInterval', 30000);
  }

  /**
   * 设置自动保存间隔
   * @param interval 间隔时间（毫秒）
   */
  setAutoSaveInterval(interval: number): void {
    this.context.workspaceState.update('autoSaveInterval', interval);
  }

  /**
   * 检查是否已配置微信凭证
   * @returns 是否已配置
   */
  isWechatConfigured(): boolean {
    const { appId, appSecret } = this.getWechatConfig();
    return Boolean(appId && appSecret);
  }
}