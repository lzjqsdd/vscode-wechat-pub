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
  private cssCache: Map<string, string> = new Map();

  constructor(extensionPath: string) {
    this.extensionPath = extensionPath;
  }

  /**
   * 获取主题 CSS
   * @param theme 主题名称
   * @param primaryColor 主色调
   * @param vscodeThemeKind VSCode 颜色主题类型（light/dark）
   * @returns 合并后的 CSS 字符串
   */
  getThemeCSS(theme: ThemeName, primaryColor: string, vscodeThemeKind: string = 'light'): string {
    const baseCSS = this.loadCSS('base.css');
    const themeCSS = this.loadCSS(`${theme}.css`);

    // 根据 VSCode 主题调整预览背景
    const isDark = vscodeThemeKind === 'dark' || vscodeThemeKind === 'high-contrast';
    const previewBackground = isDark ? '#1e1e1e' : '#f5f5f5';
    const previewContentBackground = isDark ? '#252526' : '#ffffff';
    const previewText = isDark ? '#cccccc' : '#333333';

    const variables = `
:root {
  --md-primary-color: ${primaryColor};
  --md-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --md-font-size: 14px;
  --md-preview-bg: ${previewBackground};
  --md-content-bg: ${previewContentBackground};
  --md-text-color: ${previewText};
}`;

    return `${variables}\n${baseCSS}\n${themeCSS}`;
  }

  /**
   * 加载 CSS 文件内容（带缓存）
   * @param filename CSS 文件名
   * @returns CSS 内容
   */
  private loadCSS(filename: string): string {
    if (this.cssCache.has(filename)) {
      return this.cssCache.get(filename)!;
    }
    const filepath = path.join(this.extensionPath, 'themes', filename);
    try {
      const css = fs.readFileSync(filepath, 'utf-8');
      this.cssCache.set(filename, css);
      return css;
    } catch (error) {
      console.error(`Failed to load CSS file: ${filename}`, error);
      return '';
    }
  }
}