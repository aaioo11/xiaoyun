// xiaoyun-ui.js - 小云UI组件库（独立于content.js，可复用）
// 提供统一的样式和UI组件

(function() {
  'use strict';

  // 确保只注入一次
  if (window.__xiaoyun_ui_injected) return;
  window.__xiaoyun_ui_injected = true;

  // 动态注入CSS
  const style = document.createElement('style');
  style.textContent = `
    /* ========== 悬浮按钮 ========== */
    .xy-float-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
      cursor: pointer;
      user-select: none;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .xy-float-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
    }

    .xy-float-btn .xy-icon {
      font-size: 16px;
    }

    .xy-float-btn .xy-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(255,255,255,0.5);
      transition: background 0.3s;
    }

    .xy-float-btn .xy-status-dot.active {
      background: #4ade80;
      box-shadow: 0 0 6px #4ade80;
    }

    /* ========== 设置面板 ========== */
    .xy-settings-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 999998;
    }

    .xy-settings-card {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 999999;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      width: 420px;
      max-height: 80vh;
      overflow-y: auto;
    }

    .xy-settings-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
    }

    .xy-settings-header h3 {
      margin: 0;
      font-size: 16px;
      color: #1f2937;
    }

    .xy-close-btn {
      background: none;
      border: none;
      font-size: 24px;
      color: #9ca3af;
      cursor: pointer;
      line-height: 1;
    }

    .xy-close-btn:hover {
      color: #374151;
    }

    .xy-settings-body {
      padding: 20px;
    }

    .xy-setting-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      gap: 12px;
    }

    .xy-setting-row label {
      font-size: 14px;
      color: #374151;
      white-space: nowrap;
    }

    .xy-setting-row input[type="text"],
    .xy-setting-row input[type="password"],
    .xy-setting-row select {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 13px;
      outline: none;
      transition: border-color 0.2s;
    }

    .xy-setting-row input:focus,
    .xy-setting-row select:focus {
      border-color: #667eea;
    }

    .xy-setting-row select {
      min-width: 120px;
    }

    /* 开关样式 */
    .xy-switch {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
      flex: none;
    }

    .xy-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .xy-slider {
      position: absolute;
      cursor: pointer;
      inset: 0;
      background: #d1d5db;
      border-radius: 24px;
      transition: 0.3s;
    }

    .xy-slider::before {
      content: '';
      position: absolute;
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background: white;
      border-radius: 50%;
      transition: 0.3s;
    }

    .xy-switch input:checked + .xy-slider {
      background: #667eea;
    }

    .xy-switch input:checked + .xy-slider::before {
      transform: translateX(20px);
    }

    /* 测试按钮 */
    .xy-test-btn {
      padding: 6px 14px;
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .xy-test-btn:hover {
      background: #e5e7eb;
    }

    .xy-test-result {
      font-size: 12px;
      margin-left: 8px;
    }

    .xy-auto-tag {
      font-size: 11px;
      background: #667eea;
      color: white;
      padding: 2px 8px;
      border-radius: 10px;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .xy-settings-footer {
      padding: 12px 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
    }

    .xy-save-btn {
      padding: 10px 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .xy-save-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    /* ========== 回复提示 ========== */
    .xy-reply-prompt {
      position: fixed;
      bottom: 70px;
      right: 20px;
      z-index: 999998;
      background: white;
      border-radius: 14px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.15);
      width: 320px;
      overflow: hidden;
    }

    .xy-prompt-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-size: 14px;
      font-weight: 500;
    }

    .xy-prompt-count {
      background: rgba(255,255,255,0.3);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
    }

    .xy-prompt-body {
      padding: 14px 16px;
      font-size: 13px;
      color: #6b7280;
      line-height: 1.5;
    }

    .xy-prompt-actions {
      display: flex;
      gap: 8px;
      padding: 0 16px 14px;
    }

    /* ========== 通用按钮 ========== */
    .xy-btn {
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      flex: 1;
    }

    .xy-btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .xy-btn-primary:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    .xy-btn-secondary {
      background: #f3f4f6;
      color: #374151;
      border: 1px solid #d1d5db;
    }

    .xy-btn-secondary:hover {
      background: #e5e7eb;
    }

    .xy-btn-success {
      background: #22c55e;
      color: white;
    }

    .xy-btn-success:hover {
      background: #16a34a;
    }

    /* ========== 回复弹窗 ========== */
    .xy-reply-toast {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 999999;
      width: 400px;
      max-width: 90vw;
    }

    .xy-toast-content {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25);
      overflow: hidden;
    }

    .xy-toast-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 18px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-size: 14px;
      font-weight: 500;
    }

    .xy-toast-close {
      background: none;
      border: none;
      color: white;
      font-size: 20px;
      cursor: pointer;
      opacity: 0.8;
      line-height: 1;
    }

    .xy-toast-close:hover {
      opacity: 1;
    }

    .xy-toast-body {
      padding: 16px 18px;
      font-size: 14px;
      line-height: 1.7;
      color: #1f2937;
      max-height: 200px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .xy-toast-body.xy-editing {
      background: #fefce8;
      border: 2px dashed #fbbf24;
      border-radius: 6px;
      padding: 12px;
      cursor: text;
    }

    .xy-toast-actions {
      display: flex;
      gap: 6px;
      padding: 12px 18px;
      border-top: 1px solid #f3f4f6;
    }

    .xy-toast-actions .xy-btn {
      font-size: 12px;
      padding: 7px 12px;
    }

    /* ========== 错误弹窗 ========== */
    .xy-error-toast {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      width: 360px;
    }

    /* ========== 简易Toast ========== */
    .xy-simple-toast {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 999999;
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 12px 24px;
      border-radius: 10px;
      font-size: 14px;
      animation: xy-fade-in 0.2s ease;
    }

    @keyframes xy-fade-in {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
      to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
  `;
  document.head.appendChild(style);

})();
