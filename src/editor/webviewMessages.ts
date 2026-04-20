/**
 * Webview 消息类型定义
 * 定义 webview 与 extension 之间的通信消息格式
 */

import { EditorMode } from './editorStateManager';

/**
 * Webview 发送给 extension 的消息
 */
export interface WebviewMessage {
  type: 'switchMode' | 'editContent' | 'updateContent';
  mode?: EditorMode;
  content?: string;
}

/**
 * Extension 发送给 webview 的消息
 */
export interface ExtensionMessage {
  type: 'updatePreview' | 'updateMarkdown' | 'switchMode';
  html?: string;
  markdown?: string;
  mode?: EditorMode;
}