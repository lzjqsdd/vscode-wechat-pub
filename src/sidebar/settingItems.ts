/**
 * 设置选项节点定义
 * 包含主题、颜色、开关等配置选项
 */

import * as vscode from 'vscode';

/**
 * 主题选项
 */
export const THEMES = [
  { label: '经典', value: 'default', icon: '☀️', desc: '经典风格，适合日常使用' },
  { label: '优雅', value: 'grace', icon: '🌸', desc: '优雅风格，带阴影效果' },
  { label: '简洁', value: 'simple', icon: '📝', desc: '简洁风格，现代扁平设计' }
];

/**
 * 主题色选项（11个预设颜色，同 md 项目）
 */
export const COLORS = [
  { label: '默认绿', value: '#35b378', icon: '🟢' },
  { label: '活力红', value: '#ea6f5a', icon: '🔴' },
  { label: '深邃黑', value: '#2b2b2b', icon: '⚫' },
  { label: '天空蓝', value: '#3b8bcc', icon: '🔵' },
  { label: '活力橙', value: '#f5a623', icon: '🟠' },
  { label: '清新青', value: '#1abc9c', icon: '🧊' },
  { label: '高贵紫', value: '#9b59b6', icon: '🔮' },
  { label: '温暖粉', value: '#e91e63', icon: '💗' },
  { label: '稳重灰', value: '#607d8b', icon: '🪨' },
  { label: '自然棕', value: '#8d6e63', icon: '🟤' },
  { label: '明亮黄', value: '#ffc107', icon: '🟡' }
];

/**
 * 开关选项
 */
export const TOGGLES = [
  {
    label: 'Mac 风格代码块',
    key: 'isMacCodeBlock',
    icon: '🖥️',
    desc: '显示三色圆点的代码块样式'
  },
  {
    label: '显示字数统计',
    key: 'countStatus',
    icon: '📊',
    desc: '在文章开头显示字数和阅读时间'
  }
];

/**
 * 设置侧边栏节点
 */
export class SettingItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly contextValue: string,
    public readonly value?: string,
    public readonly checked?: boolean,
    public readonly command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.contextValue = contextValue;

    if (checked) {
      this.label = `✓ ${this.label}`;
    }

    if (command) {
      this.command = command;
    }
  }
}

/**
 * 获取主题选项列表
 */
export function getThemeOptions(currentTheme: string): SettingItem[] {
  return THEMES.map(t => new SettingItem(
    `${t.icon} ${t.label}`,
    vscode.TreeItemCollapsibleState.None,
    'theme-option',
    t.value,
    currentTheme === t.value,
    {
      command: 'wechatPub.setTheme',
      title: '切换主题',
      arguments: [t.value]
    }
  ));
}

/**
 * 获取颜色选项列表
 */
export function getColorOptions(currentColor: string): SettingItem[] {
  return COLORS.map(c => new SettingItem(
    `${c.icon} ${c.label}`,
    vscode.TreeItemCollapsibleState.None,
    'color-option',
    c.value,
    currentColor === c.value,
    {
      command: 'wechatPub.setPrimaryColor',
      title: '设置主题色',
      arguments: [c.value]
    }
  ));
}

/**
 * 获取开关选项列表
 */
export function getToggleOptions(config: { isMacCodeBlock: boolean; countStatus: boolean }): SettingItem[] {
  return TOGGLES.map(t => new SettingItem(
    `${t.icon} ${t.label}`,
    vscode.TreeItemCollapsibleState.None,
    'toggle-option',
    t.key,
    config[t.key as keyof typeof config],
    {
      command: 'wechatPub.toggleOption',
      title: '切换选项',
      arguments: [t.key]
    }
  ));
}