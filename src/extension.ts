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
import { ImageUploadService } from './wechat/imageUpload';
import { showColorPickerPanel } from './preview/colorPickerPanel';

/**
 * 插件激活入口
 */
export function activate(context: vscode.ExtensionContext) {
  // 初始化各模块
  const configStore = new ConfigStore(context);
  const draftStore = new DraftMappingStore(context);
  const previewManager = new PreviewManager(context.extensionUri, context);
  const publisher = new Publisher(configStore, draftStore, context.extensionUri.fsPath);
  const sidebarProvider = new SidebarProvider(configStore, draftStore);
  const imageUploadService = new ImageUploadService(configStore);

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
    vscode.commands.registerCommand('wechatPub.setTheme', async (theme: string) => {
      try {
        configStore.setTheme(theme);
        previewManager.refresh();
        sidebarProvider.refresh();
        vscode.window.showInformationMessage(`主题已切换为: ${theme}`);
      } catch (error) {
        vscode.window.showErrorMessage(`切换主题失败: ${(error as Error).message}`);
      }
    }),

    // 设置主题色命令
    vscode.commands.registerCommand('wechatPub.setPrimaryColor', async (color: string) => {
      try {
        configStore.setPrimaryColor(color);
        previewManager.refresh();
        sidebarProvider.refresh();
        vscode.window.showInformationMessage(`主题色已设置为: ${color}`);
      } catch (error) {
        vscode.window.showErrorMessage(`设置主题色失败: ${(error as Error).message}`);
      }
    }),

    // 自定义颜色命令（弹出颜色选择画板）
    vscode.commands.registerCommand('wechatPub.setCustomColor', async () => {
      try {
        const currentColor = configStore.getPrimaryColor();
        showColorPickerPanel(currentColor, (color: string) => {
          configStore.setPrimaryColor(color);
          previewManager.refresh();
          sidebarProvider.refresh();
          vscode.window.showInformationMessage(`主题色已设置为: ${color}`);
        });
      } catch (error) {
        vscode.window.showErrorMessage(`设置自定义颜色失败: ${(error as Error).message}`);
      }
    }),

    // 切换开关选项命令
    vscode.commands.registerCommand('wechatPub.toggleOption', async (key: string) => {
      try {
        let message = '';
        switch (key) {
          case 'isMacCodeBlock':
            const macCurrent = configStore.getMacCodeBlock();
            configStore.setMacCodeBlock(!macCurrent);
            message = `Mac 风格代码块: ${!macCurrent ? '开启' : '关闭'}`;
            break;
          case 'countStatus':
            const countCurrent = configStore.getCountStatus();
            configStore.setCountStatus(!countCurrent);
            message = `字数统计: ${!countCurrent ? '开启' : '关闭'}`;
            break;
          case 'isShowLineNumber':
            const lineNumCurrent = configStore.getShowLineNumber();
            configStore.setShowLineNumber(!lineNumCurrent);
            message = `代码块行号: ${!lineNumCurrent ? '开启' : '关闭'}`;
            break;
          case 'isCiteStatus':
            const citeCurrent = configStore.getCiteStatus();
            configStore.setCiteStatus(!citeCurrent);
            message = `微信外链转底部引用: ${!citeCurrent ? '开启' : '关闭'}`;
            break;
          case 'isUseIndent':
            const indentCurrent = configStore.getUseIndent();
            configStore.setUseIndent(!indentCurrent);
            message = `首行缩进: ${!indentCurrent ? '开启' : '关闭'}`;
            break;
          case 'isUseJustify':
            const justifyCurrent = configStore.getUseJustify();
            configStore.setUseJustify(!justifyCurrent);
            message = `两端对齐: ${!justifyCurrent ? '开启' : '关闭'}`;
            break;
          default:
            vscode.window.showWarningMessage(`未知的配置项: ${key}`);
            return;
        }
        vscode.window.showInformationMessage(message);
        previewManager.refresh();
        sidebarProvider.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(`切换选项失败: ${(error as Error).message}`);
      }
    }),

    // 设置代码块主题命令
    vscode.commands.registerCommand('wechatPub.setCodeBlockTheme', async (themeUrl: string) => {
      try {
        configStore.setCodeBlockTheme(themeUrl);
        previewManager.refresh();
        sidebarProvider.refresh();
        // 从 URL 提取主题名称显示
        const themeName = themeUrl.split('/').pop()?.replace('.min.css', '') || themeUrl;
        vscode.window.showInformationMessage(`代码块主题已设置为: ${themeName}`);
      } catch (error) {
        vscode.window.showErrorMessage(`设置代码块主题失败: ${(error as Error).message}`);
      }
    }),

    // 设置图注格式命令
    vscode.commands.registerCommand('wechatPub.setLegend', async (legend: string) => {
      try {
        configStore.setLegend(legend);
        previewManager.refresh();
        sidebarProvider.refresh();
        vscode.window.showInformationMessage(`图注格式已设置为: ${legend}`);
      } catch (error) {
        vscode.window.showErrorMessage(`设置图注格式失败: ${(error as Error).message}`);
      }
    }),

    // 设置字体命令
    vscode.commands.registerCommand('wechatPub.setFontFamily', async (fontFamily: string) => {
      try {
        configStore.setFontFamily(fontFamily);
        previewManager.refresh();
        sidebarProvider.refresh();
        vscode.window.showInformationMessage(`字体已设置`);
      } catch (error) {
        vscode.window.showErrorMessage(`设置字体失败: ${(error as Error).message}`);
      }
    }),

    // 设置字号命令
    vscode.commands.registerCommand('wechatPub.setFontSize', async (fontSize: string) => {
      try {
        configStore.setFontSize(fontSize);
        previewManager.refresh();
        sidebarProvider.refresh();
        vscode.window.showInformationMessage(`字号已设置为: ${fontSize}`);
      } catch (error) {
        vscode.window.showErrorMessage(`设置字号失败: ${(error as Error).message}`);
      }
    }),

    // 设置预览宽度命令
    vscode.commands.registerCommand('wechatPub.setPreviewWidth', async (mode: string) => {
      try {
        configStore.setPreviewWidth(mode);
        previewManager.refresh();
        sidebarProvider.refresh();
        const modeText = mode === 'mobile' ? '移动端（375px）' : '电脑端（自适应）';
        vscode.window.showInformationMessage(`预览模式已设置为: ${modeText}`);
      } catch (error) {
        vscode.window.showErrorMessage(`设置预览模式失败: ${(error as Error).message}`);
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

    // 图片上传命令（支持资源管理器和编辑器右键）
    vscode.commands.registerCommand('wechatPub.uploadImage', async (uri: vscode.Uri) => {
      try {
        await imageUploadService.handleUploadCommand(uri);
      } catch (error) {
        vscode.window.showErrorMessage(`上传图片失败: ${(error as Error).message}`);
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