/**
 * VSCode Webview API
 * 只能调用一次 acquireVsCodeApi，所有模块共享此实例
 */

declare function acquireVsCodeApi(): {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
};

// 只调用一次，导出供其他模块使用
export const vscode = acquireVsCodeApi();