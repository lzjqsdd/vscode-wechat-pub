/**
 * 设置选项节点定义
 * 包含主题、颜色、代码块、段落排版等配置选项
 * 分类结构同步 md 项目
 */

import * as vscode from 'vscode';

// ==================== 排版主题 ====================

/**
 * 主题选项（渲染主题）
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
  { label: '经典蓝', value: '#0F4C81', icon: '💙' },
  { label: '翡翠绿', value: '#009874', icon: '💚' },
  { label: '活力橘', value: '#FA5151', icon: '🧡' },
  { label: '柠檬黄', value: '#FECE00', icon: '💛' },
  { label: '薰衣紫', value: '#92617E', icon: '💜' },
  { label: '天空蓝', value: '#55C9EA', icon: '🩵' },
  { label: '玫瑰金', value: '#B76E79', icon: '💗' },
  { label: '橄榄绿', value: '#556B2F', icon: '🌿' },
  { label: '石墨黑', value: '#333333', icon: '🖤' },
  { label: '雾烟灰', value: '#A9A9A9', icon: '🪨' },
  { label: '樱花粉', value: '#FFB7C5', icon: '🌸' }
];

/**
 * 代码块主题选项（常用主题精选）
 */
export const CODE_BLOCK_THEMES = [
  { label: 'GitHub', value: 'github', desc: '简洁明亮' },
  { label: 'GitHub Dark', value: 'github-dark', desc: '深色版本' },
  { label: 'Monokai', value: 'monokai', desc: '经典深色' },
  { label: 'Atom One Dark', value: 'atom-one-dark', desc: '流行深色' },
  { label: 'Atom One Light', value: 'atom-one-light', desc: '流行浅色' },
  { label: 'VS2015', value: 'vs2015', desc: 'Visual Studio' },
  { label: 'Tomorrow Night', value: 'tomorrow-night-bright', desc: '明亮夜间' },
  { label: 'Nord', value: 'nord', desc: '北极风格' },
  { label: 'Tokyo Night', value: 'tokyo-night-dark', desc: '东京夜间' },
  { label: 'Default', value: 'default', desc: '默认样式' }
];

/**
 * 图注格式选项
 */
export const LEGEND_OPTIONS = [
  { label: 'title 优先', value: 'title-alt', icon: '📌', desc: '优先显示 title' },
  { label: 'alt 优先', value: 'alt-title', icon: '🏷️', desc: '优先显示 alt' },
  { label: '只显示 title', value: 'title', icon: '📄', desc: '仅显示 title' },
  { label: '只显示 alt', value: 'alt', icon: '📝', desc: '仅显示 alt' },
  { label: '文件名', value: 'filename', icon: '📁', desc: '显示文件名' },
  { label: '不显示', value: 'none', icon: '🚫', desc: '不显示图注' }
];

// ==================== 字体字号 ====================

/**
 * 字体选项
 */
export const FONT_FAMILY_OPTIONS = [
  { label: '无衬线', value: '-apple-system-font,BlinkMacSystemFont, Helvetica Neue, PingFang SC, Hiragino Sans GB , Microsoft YaHei UI , Microsoft YaHei ,Arial,sans-serif', desc: '字体123Abc' },
  { label: '衬线', value: 'Optima-Regular, Optima, PingFangSC-light, PingFangTC-light, \'PingFang SC\', Cambria, Cochin, Georgia, Times, \'Times New Roman\', serif', desc: '字体123Abc' },
  { label: '等宽', value: 'Menlo, Monaco, \'Courier New\', monospace', desc: '字体123Abc' }
];

/**
 * 字号选项
 */
export const FONT_SIZE_OPTIONS = [
  { label: '14px', value: '14px', desc: '更小' },
  { label: '15px', value: '15px', desc: '稍小' },
  { label: '16px', value: '16px', desc: '推荐' },
  { label: '17px', value: '17px', desc: '稍大' },
  { label: '18px', value: '18px', desc: '更大' }
];

// ==================== 代码块设置 ====================

/**
 * 代码块开关选项
 */
export const CODE_BLOCK_TOGGLES = [
  {
    label: 'Mac 风格代码块',
    key: 'isMacCodeBlock',
    icon: '🖥️',
    desc: '显示三色圆点的代码块样式'
  },
  {
    label: '显示行号',
    key: 'isShowLineNumber',
    icon: '🔢',
    desc: '在代码块左侧显示行号'
  }
];

// ==================== 段落排版设置 ====================

/**
 * 段落排版开关选项
 */
export const PARAGRAPH_TOGGLES = [
  {
    label: '首行缩进',
    key: 'isUseIndent',
    icon: '↩️',
    desc: '段落首行缩进两个字符'
  },
  {
    label: '两端对齐',
    key: 'isUseJustify',
    icon: ' ↔️',
    desc: '段落文字两端对齐'
  },
  {
    label: '字数统计',
    key: 'countStatus',
    icon: '📊',
    desc: '在文章开头显示字数和阅读时间'
  },
  {
    label: '微信外链转底部引用',
    key: 'isCiteStatus',
    icon: '🔗',
    desc: '将非公众号链接转为脚注'
  }
];

// ==================== 设置分组定义 ====================

/**
 * 设置分组
 */
export const SETTING_GROUPS = [
  { label: '🎨 排版主题', key: 'theme-group', children: ['theme', 'color', 'codeBlockTheme', 'legend'] },
  { label: '🖥️ 代码块', key: 'code-block-group', children: ['codeBlockToggles'] },
  { label: '📝 段落排版', key: 'paragraph-group', children: ['paragraphToggles'] },
  { label: '📐 字体字号', key: 'font-group', children: ['fontFamily', 'fontSize'] }
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

// ==================== 获取选项列表函数 ====================

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
 * 获取代码块主题选项列表
 */
export function getCodeBlockThemeOptions(currentTheme: string): SettingItem[] {
  const baseUrl = 'https://cdn-doocs.oss-cn-shenzhen.aliyuncs.com/npm/highlightjs/11.11.1/styles/';
  return CODE_BLOCK_THEMES.map(t => new SettingItem(
    `🎨 ${t.label}`,
    vscode.TreeItemCollapsibleState.None,
    'codeblock-theme-option',
    `${baseUrl}${t.value}.min.css`,
    currentTheme === `${baseUrl}${t.value}.min.css`,
    {
      command: 'wechatPub.setCodeBlockTheme',
      title: '设置代码块主题',
      arguments: [`${baseUrl}${t.value}.min.css`]
    }
  ));
}

/**
 * 获取图注格式选项列表
 */
export function getLegendOptions(currentLegend: string): SettingItem[] {
  return LEGEND_OPTIONS.map(l => new SettingItem(
    `${l.icon} ${l.label}`,
    vscode.TreeItemCollapsibleState.None,
    'legend-option',
    l.value,
    currentLegend === l.value,
    {
      command: 'wechatPub.setLegend',
      title: '设置图注格式',
      arguments: [l.value]
    }
  ));
}

/**
 * 获取字体选项列表
 */
export function getFontFamilyOptions(currentFont: string): SettingItem[] {
  return FONT_FAMILY_OPTIONS.map(f => new SettingItem(
    `🔤 ${f.label}`,
    vscode.TreeItemCollapsibleState.None,
    'font-option',
    f.value,
    currentFont === f.value,
    {
      command: 'wechatPub.setFontFamily',
      title: '设置字体',
      arguments: [f.value]
    }
  ));
}

/**
 * 获取字号选项列表
 */
export function getFontSizeOptions(currentSize: string): SettingItem[] {
  return FONT_SIZE_OPTIONS.map(s => new SettingItem(
    `📏 ${s.label}`,
    vscode.TreeItemCollapsibleState.None,
    'fontsize-option',
    s.value,
    currentSize === s.value,
    {
      command: 'wechatPub.setFontSize',
      title: '设置字号',
      arguments: [s.value]
    }
  ));
}

/**
 * 获取代码块开关选项列表
 */
export function getCodeBlockToggleOptions(config: { isMacCodeBlock: boolean; isShowLineNumber: boolean }): SettingItem[] {
  return CODE_BLOCK_TOGGLES.map(t => new SettingItem(
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

/**
 * 获取段落排版开关选项列表
 */
export function getParagraphToggleOptions(config: { isUseIndent: boolean; isUseJustify: boolean; countStatus: boolean; isCiteStatus: boolean }): SettingItem[] {
  return PARAGRAPH_TOGGLES.map(t => new SettingItem(
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