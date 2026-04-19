/**
 * 主题管理器
 * 负责加载和管理预览主题的 CSS 样式
 */

import * as path from 'path';
import * as fs from 'fs';

export const THEMES = ['default', 'grace', 'simple'] as const;
export type ThemeName = typeof THEMES[number];

/**
 * 主题管理类
 * 加载基础样式和主题特定样式
 */
export class ThemeManager {
  private extensionPath: string;

  constructor(extensionPath: string) {
    this.extensionPath = extensionPath;
  }

  /**
   * 获取主题 CSS
   * @param theme 主题名称
   * @param primaryColor 主色调
   * @returns 合并后的 CSS 字符串
   */
  getThemeCSS(theme: ThemeName, primaryColor: string): string {
    const baseCSS = this.loadCSS('base.css');
    const themeCSS = this.loadCSS(`${theme}.css`);

    const variables = `
:root {
  --md-primary-color: ${primaryColor};
  --md-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --md-font-size: 14px;
}`;

    return `${variables}\n${baseCSS}\n${themeCSS}`;
  }

  /**
   * 加载 CSS 文件内容
   * @param filename CSS 文件名
   * @returns CSS 内容
   */
  private loadCSS(filename: string): string {
    const filepath = path.join(this.extensionPath, 'themes', filename);
    try {
      return fs.readFileSync(filepath, 'utf-8');
    } catch (error) {
      console.error(`Failed to load CSS file: ${filename}`, error);
      return '';
    }
  }
}