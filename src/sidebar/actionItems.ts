/**
 * 快捷操作节点定义
 * 包含发布、复制、更新等快捷操作
 */

import * as vscode from 'vscode';

/**
 * 快捷操作侧边栏节点
 */
export class ActionItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly icon: string,
    public readonly commandId: string,
    public readonly desc?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'action';

    // 设置图标
    this.iconPath = new vscode.ThemeIcon(icon);

    // 设置命令
    this.command = {
      command: commandId,
      title: label
    };

    // 设置描述
    if (desc) {
      this.tooltip = desc;
    }
  }
}

/**
 * 快捷操作列表
 */
export const ACTIONS = [
  {
    label: '🚀 发布当前文档',
    icon: 'rocket',
    commandId: 'wechatPub.publish',
    desc: '将当前 Markdown 文档发布到公众号草稿箱'
  },
  {
    label: '📋 复制公众号 HTML',
    icon: 'copy',
    commandId: 'wechatPub.copyHtml',
    desc: '生成公众号格式 HTML 并复制到剪贴板'
  },
  {
    label: '🔄 更新草稿',
    icon: 'sync',
    commandId: 'wechatPub.updateDraft',
    desc: '更新已发布的草稿内容'
  }
];

/**
 * 获取快捷操作节点列表
 */
export function getActionItems(): ActionItem[] {
  return ACTIONS.map(a => new ActionItem(a.label, a.icon, a.commandId, a.desc));
}