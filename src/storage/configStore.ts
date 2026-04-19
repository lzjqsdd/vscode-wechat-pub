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

  // ==================== 新增配置项（同步 md 项目） ====================

  /**
   * 获取代码块主题 URL
   * @returns 代码块主题 URL
   */
  getCodeBlockTheme(): string {
    return this.context.workspaceState.get('codeBlockTheme', 'https://cdn-doocs.oss-cn-shenzhen.aliyuncs.com/npm/highlightjs/11.11.1/styles/github.min.css');
  }

  /**
   * 设置代码块主题 URL
   * @param theme 主题 URL
   */
  setCodeBlockTheme(theme: string): void {
    this.context.workspaceState.update('codeBlockTheme', theme);
  }

  /**
   * 获取图注格式
   * @returns 图注格式值
   */
  getLegend(): string {
    return this.context.workspaceState.get('legend', 'alt');
  }

  /**
   * 设置图注格式
   * @param legend 图注格式值
   */
  setLegend(legend: string): void {
    this.context.workspaceState.update('legend', legend);
  }

  /**
   * 获取是否显示代码块行号
   * @returns 是否启用
   */
  getShowLineNumber(): boolean {
    return this.context.workspaceState.get('isShowLineNumber', false);
  }

  /**
   * 设置是否显示代码块行号
   * @param value 是否启用
   */
  setShowLineNumber(value: boolean): void {
    this.context.workspaceState.update('isShowLineNumber', value);
  }

  /**
   * 获取微信外链转底部引用状态
   * @returns 是否启用
   */
  getCiteStatus(): boolean {
    return this.context.workspaceState.get('isCiteStatus', false);
  }

  /**
   * 设置微信外链转底部引用状态
   * @param value 是否启用
   */
  setCiteStatus(value: boolean): void {
    this.context.workspaceState.update('isCiteStatus', value);
  }

  /**
   * 获取段落首行缩进状态
   * @returns 是否启用
   */
  getUseIndent(): boolean {
    return this.context.workspaceState.get('isUseIndent', false);
  }

  /**
   * 设置段落首行缩进状态
   * @param value 是否启用
   */
  setUseIndent(value: boolean): void {
    this.context.workspaceState.update('isUseIndent', value);
  }

  /**
   * 获取段落两端对齐状态
   * @returns 是否启用
   */
  getUseJustify(): boolean {
    return this.context.workspaceState.get('isUseJustify', false);
  }

  /**
   * 设置段落两端对齐状态
   * @param value 是否启用
   */
  setUseJustify(value: boolean): void {
    this.context.workspaceState.update('isUseJustify', value);
  }

  /**
   * 获取字体设置
   * @returns 字体值
   */
  getFontFamily(): string {
    return this.context.workspaceState.get('fontFamily', '-apple-system-font,BlinkMacSystemFont, Helvetica Neue, PingFang SC, Hiragino Sans GB , Microsoft YaHei UI , Microsoft YaHei ,Arial,sans-serif');
  }

  /**
   * 设置字体
   * @param fontFamily 字体值
   */
  setFontFamily(fontFamily: string): void {
    this.context.workspaceState.update('fontFamily', fontFamily);
  }

  /**
   * 获取字号设置
   * @returns 字号值
   */
  getFontSize(): string {
    return this.context.workspaceState.get('fontSize', '16px');
  }

  /**
   * 设置字号
   * @param fontSize 字号值
   */
  setFontSize(fontSize: string): void {
    this.context.workspaceState.update('fontSize', fontSize);
  }

  /**
   * 获取预览宽度模式
   * @returns 'mobile' 或 'desktop'
   */
  getPreviewWidth(): string {
    return this.context.workspaceState.get('previewWidth', 'mobile');
  }

  /**
   * 设置预览宽度模式
   * @param mode 'mobile' 或 'desktop'
   */
  setPreviewWidth(mode: string): void {
    this.context.workspaceState.update('previewWidth', mode);
  }
}