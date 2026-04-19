/**
 * 颜色选择器面板
 * 使用 Webview 显示颜色选择画板
 */

import * as vscode from 'vscode';

/**
 * 预设颜色列表
 */
const PRESET_COLORS = [
  '#0F4C81', '#009874', '#FA5151', '#FECE00',
  '#92617E', '#55C9EA', '#B76E79', '#556B2F',
  '#333333', '#A9A9A9', '#FFB7C5', '#35b378',
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
];

/**
 * 显示颜色选择器面板
 * @param currentColor 当前颜色
 * @param onColorSelected 颜色选择回调
 */
export function showColorPickerPanel(
  currentColor: string,
  onColorSelected: (color: string) => void
): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    'colorPicker',
    '选择主题色',
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: false
    }
  );

  panel.webview.html = getPickerHtml(currentColor);

  // 处理来自 Webview 的消息
  panel.webview.onDidReceiveMessage(
    (message: { command: string; color: string }) => {
      if (message.command === 'selectColor') {
        onColorSelected(message.color);
        panel.dispose();
      }
    }
  );

  return panel;
}

/**
 * 生成颜色选择器 HTML
 */
function getPickerHtml(currentColor: string): string {
  const presetButtons = PRESET_COLORS.map(color => {
    const isSelected = color.toLowerCase() === currentColor.toLowerCase();
    return `
      <button
        class="color-btn ${isSelected ? 'selected' : ''}"
        style="background-color: ${color};"
        onclick="selectColor('${color}')"
        title="${color}">
        ${isSelected ? '<span class="check">✓</span>' : ''}
      </button>`;
  }).join('\n');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family);
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      padding: 20px;
      margin: 0;
    }
    h2 { margin: 0 0 16px 0; font-size: 16px; font-weight: 600; }
    .preset-section { margin-bottom: 24px; }
    .section-title { font-size: 13px; color: var(--vscode-descriptionForeground); margin-bottom: 12px; }
    .color-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; max-width: 280px; }
    .color-btn {
      width: 48px; height: 48px;
      border: 2px solid transparent;
      border-radius: 8px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
      position: relative;
    }
    .color-btn:hover { transform: scale(1.1); border-color: var(--vscode-focusBorder); }
    .color-btn.selected {
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 0 0 2px var(--vscode-editor-background), 0 0 0 4px var(--vscode-focusBorder);
    }
    .check { color: white; font-size: 18px; font-weight: bold; text-shadow: 0 1px 2px rgba(0,0,0,0.5); }
    .custom-section { margin-bottom: 20px; }
    .custom-picker-wrapper { display: flex; align-items: center; gap: 12px; }
    #colorPicker {
      width: 48px; height: 48px;
      border: none; border-radius: 8px;
      cursor: pointer; padding: 0;
    }
    #colorPicker::-webkit-color-swatch-wrapper { padding: 0; }
    #colorPicker::-webkit-color-swatch { border-radius: 8px; border: 2px solid var(--vscode-input-border); }
    #hexInput {
      flex: 1; max-width: 180px;
      padding: 8px 12px;
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      font-size: 14px; font-family: monospace;
    }
    #hexInput:focus { outline: none; border-color: var(--vscode-focusBorder); }
    .apply-btn {
      display: block; width: 100%; max-width: 280px;
      padding: 10px 16px; margin-top: 20px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none; border-radius: 4px;
      font-size: 14px; cursor: pointer; text-align: center;
    }
    .apply-btn:hover { background: var(--vscode-button-hoverBackground); }
    .current-color { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; font-size: 13px; }
    .current-preview { width: 24px; height: 24px; border-radius: 4px; border: 1px solid var(--vscode-input-border); }
  </style>
</head>
<body>
  <h2>🎨 选择主题色</h2>

  <div class="current-color">
    <span>当前颜色:</span>
    <div class="current-preview" id="currentPreview" style="background-color: ${currentColor};"></div>
    <span id="currentHex">${currentColor}</span>
  </div>

  <div class="preset-section">
    <div class="section-title">预设颜色</div>
    <div class="color-grid">${presetButtons}</div>
  </div>

  <div class="custom-section">
    <div class="section-title">自定义颜色</div>
    <div class="custom-picker-wrapper">
      <input type="color" id="colorPicker" value="${currentColor}" onchange="updateFromPicker()">
      <input type="text" id="hexInput" value="${currentColor}" placeholder="#RRGGBB" oninput="validateHex()">
    </div>
  </div>

  <button class="apply-btn" onclick="applyCustomColor()">应用自定义颜色</button>

  <script>
    const vscode = acquireVsCodeApi();
    let selectedColor = '${currentColor}';

    function selectColor(color) {
      selectedColor = color;
      updateDisplay(color);
      vscode.postMessage({ command: 'selectColor', color: color });
    }

    function updateFromPicker() {
      const picker = document.getElementById('colorPicker');
      const hex = picker.value.toUpperCase();
      document.getElementById('hexInput').value = hex;
      selectedColor = hex;
      updateDisplay(hex);
    }

    function validateHex() {
      const input = document.getElementById('hexInput');
      let value = input.value.trim();
      if (value && !value.startsWith('#')) { value = '#' + value; input.value = value; }
      const valid = /^#[A-Fa-f0-9]{6}$/.test(value);
      if (valid) {
        selectedColor = value.toUpperCase();
        document.getElementById('colorPicker').value = selectedColor;
        updateDisplay(selectedColor);
      }
    }

    function updateDisplay(color) {
      document.getElementById('currentPreview').style.backgroundColor = color;
      document.getElementById('currentHex').textContent = color;
      document.querySelectorAll('.color-btn').forEach(btn => {
        const btnColor = btn.getAttribute('title') || '';
        if (btnColor.toLowerCase() === color.toLowerCase()) {
          btn.classList.add('selected');
          const span = document.createElement('span');
          span.className = 'check';
          span.textContent = '✓';
          btn.appendChild(span);
        } else {
          btn.classList.remove('selected');
          const check = btn.querySelector('.check');
          if (check) { check.remove(); }
        }
      });
    }

    function applyCustomColor() {
      const hex = document.getElementById('hexInput').value.trim();
      const valid = /^#[A-Fa-f0-9]{6}$/i.test(hex);
      if (valid) { selectColor(hex.toUpperCase()); }
      else { alert('请输入有效的颜色格式，如 #FF6B6B'); }
    }
  </script>
</body>
</html>`;
}