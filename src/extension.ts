/**
 * VSCode 插件入口
 * 注册命令、侧边栏视图和事件监听
 */

import * as vscode from 'vscode';
import { PreviewManager } from './preview/previewManager';
import { Publisher } from './wechat/publisher';
import { ConfigStore } from './storage/configStore';
import { DraftMappingStore } from './storage/draftMapping';
import { SidebarProvider } from './sidebar/sidebarProvider';

/**
 * 插件激活入口
 */
export function activate(context: vscode.ExtensionContext) {
  // 初始化各模块
  const configStore = new ConfigStore(context);
  const draftStore = new DraftMappingStore(context);
  const previewManager = new PreviewManager(context.extensionUri, context);
  const publisher = new Publisher(configStore, draftStore, context.extensionUri.fsPath);
  const sidebarProvider = new SidebarProvider(draftStore);

  // 注册侧边栏视图
  vscode.window.registerTreeDataProvider('wechatPub.sidebar', sidebarProvider);

  // 注册命令
  context.subscriptions.push(
    // 预览命令
    vscode.commands.registerCommand('wechatPub.preview', () => {
      try {
        const editor = vscode.window.activeTextEditor;
        if (editor?.document.languageId === 'markdown') {
          previewManager.show(editor);
        } else {
          vscode.window.showWarningMessage('请打开 Markdown 文件');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`预览失败: ${(error as Error).message}`);
      }
    }),

    // 复制 HTML 命令
    vscode.commands.registerCommand('wechatPub.copyHtml', async () => {
      try {
        const editor = vscode.window.activeTextEditor;
        if (editor?.document.languageId === 'markdown') {
          await publisher.copyHtml(editor);
        } else {
          vscode.window.showWarningMessage('请打开 Markdown 文件');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`复制 HTML 失败: ${(error as Error).message}`);
      }
    }),

    // 发布命令
    vscode.commands.registerCommand('wechatPub.publish', async () => {
      try {
        const editor = vscode.window.activeTextEditor;
        if (editor?.document.languageId === 'markdown') {
          await publisher.publish(editor);
          sidebarProvider.refresh();
        } else {
          vscode.window.showWarningMessage('请打开 Markdown 文件');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`发布失败: ${(error as Error).message}`);
      }
    }),

    // 更新草稿命令
    vscode.commands.registerCommand('wechatPub.updateDraft', async () => {
      try {
        const editor = vscode.window.activeTextEditor;
        if (editor?.document.languageId === 'markdown') {
          await publisher.publish(editor);
          sidebarProvider.refresh();
        } else {
          vscode.window.showWarningMessage('请打开 Markdown 文件');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`更新草稿失败: ${(error as Error).message}`);
      }
    }),

    // 切换主题命令
    vscode.commands.registerCommand('wechatPub.setTheme', async () => {
      try {
        const themes = ['default', 'grace', 'simple'];
        const selected = await vscode.window.showQuickPick(themes, {
          placeHolder: '选择预览主题'
        });
        if (selected) {
          configStore.setTheme(selected);
          previewManager.refresh();
          vscode.window.showInformationMessage(`主题已切换为: ${selected}`);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`切换主题失败: ${(error as Error).message}`);
      }
    }),

    // 打开草稿文件命令
    vscode.commands.registerCommand('wechatPub.openDraft', async (filePath: string) => {
      try {
        const doc = await vscode.workspace.openTextDocument(filePath);
        vscode.window.showTextDocument(doc);
      } catch (error) {
        vscode.window.showErrorMessage(`打开草稿失败: ${(error as Error).message}`);
      }
    }),

    // 监听配置变化
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('wechatPub')) {
        publisher.updateConfig();
      }
    })
  );

  console.log('微信公众号助手已激活');
}

/**
 * 插件停用
 */
export function deactivate() {}