/**
 * VSCode 插件入口
 * 注册命令、侧边栏视图和事件监听
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PreviewManager } from './preview/previewManager';
import { Publisher } from './wechat/publisher';
import { ConfigStore } from './storage/configStore';
import { DraftMappingStore } from './storage/draftMapping';
import { ImageRegistry } from './storage/imageRegistry';
import { SidebarProvider } from './sidebar/sidebarProvider';
import { ImageUploadService } from './wechat/imageUpload';
import { ImageFileDecorationProvider } from './explorer/fileDecorationProvider';
import { ImageItem } from './sidebar/imageItems';
import { showColorPickerPanel } from './preview/colorPickerPanel';
import { WechatPubEditorProvider } from './editor/wechatPubEditorProvider';

/**
 * 安全提取错误信息
 * 避免 unsafe type assertion
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 插件激活入口
 */
export function activate(context: vscode.ExtensionContext) {
  // 获取工作区根路径
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

  // 初始化各模块
  const configStore = new ConfigStore(context);
  const draftStore = new DraftMappingStore(context);
  const imageRegistry = new ImageRegistry(workspaceRoot);
  const previewManager = new PreviewManager(context.extensionUri, context);
  const publisher = new Publisher(configStore, draftStore, imageRegistry, context.extensionUri.fsPath);
  const sidebarProvider = new SidebarProvider(configStore, draftStore, imageRegistry);
  const imageUploadService = new ImageUploadService(configStore, imageRegistry);

  // 注册 FileDecorationProvider
  const decorationProvider = new ImageFileDecorationProvider(imageRegistry);
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(decorationProvider)
  );

  // 注册侧边栏视图
  vscode.window.registerTreeDataProvider('wechatPub.sidebar', sidebarProvider);

  // 注册 Custom Editor provider（命令在 provider 内部注册）
  const disposables = WechatPubEditorProvider.register(context);
  context.subscriptions.push(...disposables);

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
        vscode.window.showErrorMessage(`预览失败: ${getErrorMessage(error)}`);
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
        vscode.window.showErrorMessage(`复制 HTML 失败: ${getErrorMessage(error)}`);
      }
    }),

    // 发布命令（支持 Custom Editor 和右键菜单传入 URI）
    vscode.commands.registerCommand('wechatPub.publish', async (uri?: vscode.Uri) => {
      try {
        let documentUri: vscode.Uri | undefined;

        // 优先使用命令传入的 URI（右键菜单场景）
        if (uri) {
          documentUri = uri;
        } else {
          // 其次从 Custom Editor 或 activeTextEditor 获取
          documentUri = WechatPubEditorProvider.getActiveMarkdownUri();
        }

        if (!documentUri) {
          vscode.window.showWarningMessage('请打开 Markdown 文件');
          return;
        }

        // 打开文档并获取内容
        const doc = await vscode.workspace.openTextDocument(documentUri);
        await publisher.publishDocument(doc);
        sidebarProvider.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(`发布失败: ${getErrorMessage(error)}`);
      }
    }),

    // 更新草稿命令（支持 Custom Editor 和右键菜单传入 URI）
    vscode.commands.registerCommand('wechatPub.updateDraft', async (uri?: vscode.Uri) => {
      try {
        let documentUri: vscode.Uri | undefined;

        // 优先使用命令传入的 URI（右键菜单场景）
        if (uri) {
          documentUri = uri;
        } else {
          // 其次从 Custom Editor 或 activeTextEditor 获取
          documentUri = WechatPubEditorProvider.getActiveMarkdownUri();
        }

        if (!documentUri) {
          vscode.window.showWarningMessage('请打开 Markdown 文件');
          return;
        }

        // 打开文档并获取内容
        const doc = await vscode.workspace.openTextDocument(documentUri);
        await publisher.publishDocument(doc);
        sidebarProvider.refresh();
      } catch (error) {
        vscode.window.showErrorMessage(`更新草稿失败: ${getErrorMessage(error)}`);
      }
    }),

    // 切换主题命令
    vscode.commands.registerCommand('wechatPub.setTheme', async (theme: string) => {
      try {
        configStore.setTheme(theme);
        previewManager.refresh();
        sidebarProvider.refresh();
        WechatPubEditorProvider.refreshAll();
        vscode.window.showInformationMessage(`主题已切换为: ${theme}`);
      } catch (error) {
        vscode.window.showErrorMessage(`切换主题失败: ${getErrorMessage(error)}`);
      }
    }),

    // 设置主题色命令
    vscode.commands.registerCommand('wechatPub.setPrimaryColor', async (color: string) => {
      try {
        configStore.setPrimaryColor(color);
        previewManager.refresh();
        sidebarProvider.refresh();
        WechatPubEditorProvider.refreshAll();
        vscode.window.showInformationMessage(`主题色已设置为: ${color}`);
      } catch (error) {
        vscode.window.showErrorMessage(`设置主题色失败: ${getErrorMessage(error)}`);
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
          WechatPubEditorProvider.refreshAll();
          vscode.window.showInformationMessage(`主题色已设置为: ${color}`);
        });
      } catch (error) {
        vscode.window.showErrorMessage(`设置自定义颜色失败: ${getErrorMessage(error)}`);
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
        WechatPubEditorProvider.refreshAll();
      } catch (error) {
        vscode.window.showErrorMessage(`切换选项失败: ${getErrorMessage(error)}`);
      }
    }),

    // 设置代码块主题命令
    vscode.commands.registerCommand('wechatPub.setCodeBlockTheme', async (themeUrl: string) => {
      try {
        configStore.setCodeBlockTheme(themeUrl);
        previewManager.refresh();
        sidebarProvider.refresh();
        WechatPubEditorProvider.refreshAll();
        // 从 URL 提取主题名称显示
        const themeName = themeUrl.split('/').pop()?.replace('.min.css', '') || themeUrl;
        vscode.window.showInformationMessage(`代码块主题已设置为: ${themeName}`);
      } catch (error) {
        vscode.window.showErrorMessage(`设置代码块主题失败: ${getErrorMessage(error)}`);
      }
    }),

    // 设置图注格式命令
    vscode.commands.registerCommand('wechatPub.setLegend', async (legend: string) => {
      try {
        configStore.setLegend(legend);
        previewManager.refresh();
        sidebarProvider.refresh();
        WechatPubEditorProvider.refreshAll();
        vscode.window.showInformationMessage(`图注格式已设置为: ${legend}`);
      } catch (error) {
        vscode.window.showErrorMessage(`设置图注格式失败: ${getErrorMessage(error)}`);
      }
    }),

    // 设置字体命令
    vscode.commands.registerCommand('wechatPub.setFontFamily', async (fontFamily: string) => {
      try {
        configStore.setFontFamily(fontFamily);
        previewManager.refresh();
        sidebarProvider.refresh();
        WechatPubEditorProvider.refreshAll();
        vscode.window.showInformationMessage(`字体已设置`);
      } catch (error) {
        vscode.window.showErrorMessage(`设置字体失败: ${getErrorMessage(error)}`);
      }
    }),

    // 设置字号命令
    vscode.commands.registerCommand('wechatPub.setFontSize', async (fontSize: string) => {
      try {
        configStore.setFontSize(fontSize);
        previewManager.refresh();
        sidebarProvider.refresh();
        WechatPubEditorProvider.refreshAll();
        vscode.window.showInformationMessage(`字号已设置为: ${fontSize}`);
      } catch (error) {
        vscode.window.showErrorMessage(`设置字号失败: ${getErrorMessage(error)}`);
      }
    }),

    // 设置预览宽度命令
    vscode.commands.registerCommand('wechatPub.setPreviewWidth', async (mode: string) => {
      try {
        configStore.setPreviewWidth(mode);
        previewManager.refresh();
        sidebarProvider.refresh();
        WechatPubEditorProvider.refreshAll();
        const modeText = mode === 'mobile' ? '移动端（375px）' : '电脑端（自适应）';
        vscode.window.showInformationMessage(`预览模式已设置为: ${modeText}`);
      } catch (error) {
        vscode.window.showErrorMessage(`设置预览模式失败: ${getErrorMessage(error)}`);
      }
    }),

    // 打开草稿文件命令
    vscode.commands.registerCommand('wechatPub.openDraft', async (filePath: string) => {
      try {
        const doc = await vscode.workspace.openTextDocument(filePath);
        vscode.window.showTextDocument(doc);
      } catch (error) {
        vscode.window.showErrorMessage(`打开草稿失败: ${getErrorMessage(error)}`);
      }
    }),

    // 图片上传命令（支持资源管理器和编辑器右键）
    vscode.commands.registerCommand('wechatPub.uploadImage', async (uri: vscode.Uri) => {
      try {
        await imageUploadService.handleUploadCommand(uri);
      } catch (error) {
        vscode.window.showErrorMessage(`上传图片失败: ${getErrorMessage(error)}`);
      }
    }),

    // 分屏预览模式切换命令
    vscode.commands.registerCommand('wechatPub.sideSwitchToPreview', () => {
      const manager = PreviewManager.getInstance();
      if (manager) {
        manager.switchMode('preview');
      }
    }),

    vscode.commands.registerCommand('wechatPub.sideSwitchToMarkdown', () => {
      const manager = PreviewManager.getInstance();
      if (manager) {
        manager.switchMode('markdown');
      }
    }),

    // 打开图片文件
    vscode.commands.registerCommand('wechatPub.openImageFile', async (absolutePath: string) => {
      try {
        if (absolutePath && fs.existsSync(absolutePath)) {
          const uri = vscode.Uri.file(absolutePath);
          await vscode.commands.executeCommand('vscode.open', uri);
        } else {
          vscode.window.showWarningMessage('图片文件不存在或已移动');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`打开图片失败: ${getErrorMessage(error)}`);
      }
    }),

    // 复制图片 URL（支持侧边栏节点和文件树 URI）
    vscode.commands.registerCommand('wechatPub.copyImageUrl', async (itemOrUri: ImageItem | vscode.Uri) => {
      let url: string | undefined;

      // 判断参数类型
      if (itemOrUri instanceof vscode.Uri) {
        // 从文件树传入的 URI
        url = imageRegistry.getUrlByLocalPath(itemOrUri.fsPath);
      } else if (itemOrUri?.record?.wechatUrl) {
        // 从侧边栏传入的 ImageItem
        url = itemOrUri.record.wechatUrl;
      }

      if (url) {
        await vscode.env.clipboard.writeText(url);
        vscode.window.showInformationMessage('图片 URL 已复制');
      } else {
        vscode.window.showWarningMessage('该图片未上传到公众号');
      }
    }),

    // 复制 Markdown 格式（支持侧边栏节点和文件树 URI）
    vscode.commands.registerCommand('wechatPub.copyImageMarkdown', async (itemOrUri: ImageItem | vscode.Uri) => {
      let url: string | undefined;
      let filename: string | undefined;

      // 判断参数类型
      if (itemOrUri instanceof vscode.Uri) {
        // 从文件树传入的 URI
        url = imageRegistry.getUrlByLocalPath(itemOrUri.fsPath);
        filename = path.basename(itemOrUri.fsPath);
      } else if (itemOrUri?.record?.wechatUrl) {
        // 从侧边栏传入的 ImageItem
        url = itemOrUri.record.wechatUrl;
        filename = itemOrUri.record.filename || 'image';
      }

      if (url) {
        const md = `![${filename}](${url})`;
        await vscode.env.clipboard.writeText(md);
        vscode.window.showInformationMessage('完整 Markdown 链接已复制');
      } else {
        vscode.window.showWarningMessage('该图片未上传到公众号');
      }
    }),

    // 删除图片记录（支持侧边栏节点和文件树 URI）
    vscode.commands.registerCommand('wechatPub.removeImageRecord', async (itemOrUri: ImageItem | vscode.Uri) => {
      let localPath: string | undefined;

      // 判断参数类型
      if (itemOrUri instanceof vscode.Uri) {
        // 从文件树传入的 URI
        localPath = itemOrUri.fsPath;
      } else if (itemOrUri?.record?.localPath) {
        // 从侧边栏传入的 ImageItem
        localPath = imageRegistry.getAbsolutePath(itemOrUri.record.localPath);
      }

      if (localPath) {
        const confirm = await vscode.window.showWarningMessage(
          '确定删除此图片记录？',
          '确定', '取消'
        );
        if (confirm === '确定') {
          imageRegistry.remove(localPath);
          sidebarProvider.refresh();
          vscode.window.showInformationMessage('记录已删除');
        }
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