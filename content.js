// content.js - 闲鱼页面内容脚本
// 负责：注入UI、监听消息、与background通信、自动回复

(function() {
  'use strict';

  console.log('[小云] 启动中...');

  // 等待 DOM 就绪
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    // 注入悬浮按钮
    injectFloatingButton();

    // 注入设置面板
    injectSettingsPanel();

    // 检测当前商品
    detectCurrentProduct();

    // 设置消息监听
    setupMessageObserver();

    // 向 background 报告商品上下文
    try {
      chrome.runtime.sendMessage({
        type: 'SET_PRODUCT',
        data: {
          id: currentProductId,
          title: currentProductTitle,
          price: currentProductPrice,
          image: currentProductImage,
        }
      }).catch(() => {});
    } catch (err) {
      // background may not be ready
    }

    console.log('[小云] 就绪 ✓');
  }

  // ===== 商品检测 =====
  let currentProductId = '';
  let currentProductTitle = '';
  let currentProductPrice = '';
  let currentProductImage = '';

  function detectCurrentProduct() {
    // 闲鱼商品页 URL: www.goofish.com/detail/qxxx.htm 或类似
    const urlMatch = window.location.pathname.match(/\/detail\/([^/]+)/);
    if (urlMatch) {
      currentProductId = urlMatch[1];
    }

    // 尝试从页面提取商品信息
    const titleSelectors = [
      '.post-title', '.item-title', '.detail-title',
      'h1.title', '.main-title', '.goods-title',
      '[class*="title"]', '[class*="name"]',
    ];
    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 2) {
        currentProductTitle = el.textContent.trim();
        break;
      }
    }

    const priceSelectors = [
      '.price', '.amount', '.post-price', '.money',
      '[class*="price"]', '[class*="amount"]',
    ];
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      if (el && /[\d.]/.test(el.textContent)) {
        currentProductPrice = el.textContent.trim();
        break;
      }
    }

    const imgSelectors = [
      '.cover-img', '.main-image', 'img[itemprop="image"]',
      '.detail-img', '[class*="image"] img',
    ];
    for (const sel of imgSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        currentProductImage = el.src || el.getAttribute('src') || el.getAttribute('data-src') || '';
        if (currentProductImage) break;
      }
    }
  }

  // ===== 悬浮按钮 =====
  function injectFloatingButton() {
    const btn = document.createElement('div');
    btn.id = 'xiaoyun-float-btn';
    btn.innerHTML = `
      <div class="xy-float-btn">
        <span class="xy-icon">☁️</span>
        <span class="xy-label">小云在线</span>
        <span class="xy-status-dot"></span>
      </div>
    `;
    btn.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 999999;
      cursor: pointer; transition: all 0.3s;
    `;
    document.body.appendChild(btn);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const panel = document.getElementById('xiaoyun-settings-panel');
      if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      }
    });

    // 加载配置状态
    chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, (msg) => {
      try {
        if (msg && msg.enabled) {
          btn.querySelector('.xy-status-dot').classList.add('active');
        }
      } catch (err) {
        // button may not exist yet
      }
    });
  }

  // ===== 设置面板 =====
  function injectSettingsPanel() {
    const panel = document.createElement('div');
    panel.id = 'xiaoyun-settings-panel';
    panel.style.display = 'none';
    panel.innerHTML = `
      <div class="xy-settings-overlay" id="xy-overlay"></div>
      <div class="xy-settings-card">
        <div class="xy-settings-header">
          <h3>☁️ 小云设置</h3>
          <button class="xy-close-btn" id="xy-close-settings">×</button>
        </div>
        <div class="xy-settings-body">
          <div class="xy-setting-row">
            <label>总开关</label>
            <label class="xy-switch">
              <input type="checkbox" id="xy-enabled">
              <span class="xy-slider"></span>
            </label>
          </div>
          <div class="xy-setting-row">
            <label>自动回复</label>
            <label class="xy-switch">
              <input type="checkbox" id="xy-auto-reply" checked>
              <span class="xy-slider"></span>
            </label>
          </div>
          <div class="xy-setting-row">
            <label>回复热情度</label>
            <select id="xy-sensitivity">
              <option value="calm">安静型（少说话）</option>
              <option value="normal" selected>正常型</option>
              <option value="enthusiastic">热情型（多互动）</option>
            </select>
          </div>
          <div class="xy-setting-row">
            <label>API Provider</label>
            <select id="xy-provider">
              <option value="openai">OpenAI 兼容</option>
              <option value="agnes">Agnes-AI</option>
              <option value="deepseek" selected>DeepSeek</option>
              <option value="anthropic">Anthropic</option>
              <option value="zhipu">智谱 GLM</option>
              <option value="local">本地模型</option>
            </select>
          </div>
          <div class="xy-setting-row">
            <label>API Key</label>
            <input type="password" id="xy-api-key" placeholder="sk-...">
          </div>
          <div class="xy-setting-row">
            <label>自定义模型</label>
            <input type="text" id="xy-custom-model" placeholder="留空则使用默认模型">
          </div>
        </div>
        <div class="xy-settings-footer">
          <button class="xy-save-btn" id="xy-save-settings">保存设置</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // 绑定事件
    document.getElementById('xy-close-settings').addEventListener('click', () => {
      panel.style.display = 'none';
    });
    document.getElementById('xy-overlay').addEventListener('click', () => {
      panel.style.display = 'none';
    });
    document.getElementById('xy-save-settings').addEventListener('click', saveSettings);

    // 加载已有设置
    loadSettings();
  }

  function loadSettings() {
    chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, (msg) => {
      if (!msg) return;
      try {
        const el1 = document.getElementById('xy-enabled');
        const el2 = document.getElementById('xy-auto-reply');
        const el3 = document.getElementById('xy-sensitivity');
        const el4 = document.getElementById('xy-provider');
        const el5 = document.getElementById('xy-api-key');
        const el6 = document.getElementById('xy-custom-model');
        if (el1) el1.checked = msg.enabled;
        if (el2) el2.checked = msg.autoReply;
        if (el3) el3.value = msg.sensitivity;
        if (el4) el4.value = msg.apiProvider;
        if (el5) el5.value = msg.apiKey || '';
        if (el6) el6.value = msg.customModel || '';
      } catch (err) {
        // panel may not be ready
      }
    });
  }

  function saveSettings() {
    const data = {
      enabled: document.getElementById('xy-enabled').checked,
      autoReply: document.getElementById('xy-auto-reply').checked,
      sensitivity: document.getElementById('xy-sensitivity').value,
      apiProvider: document.getElementById('xy-provider').value,
      apiKey: document.getElementById('xy-api-key').value,
      customModel: document.getElementById('xy-custom-model').value,
    };

    chrome.runtime.sendMessage({ type: 'UPDATE_CONFIG', data }, (res) => {
      if (res && res.success) {
        const dot = document.querySelector('#xiaoyun-float-btn .xy-status-dot');
        if (dot) dot.classList.add('active');
        showToast('✓ 设置已保存');
      }
    });
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'xy-simple-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // ===== 消息监听 =====
  // 已发送消息的追踪（避免重复回复）
  const processedMessageTexts = new Set();
  const MAX_PROCESSED_CACHE = 100;
  let lastChatPageState = false;

  function setupMessageObserver() {
    // 使用 MutationObserver 监听 DOM 变化
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          // 检查是否在聊天页面
          if (isChatPage()) {
            shouldCheck = true;
            break;
          }
        }
      }
      if (shouldCheck) {
        checkForNewMessages();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 定期兜底检测 + 页面切换检测
    setInterval(() => {
      var currentChatPage = isChatPage();
      // 检测是否刚进入聊天页面（清理已处理消息缓存）
      if (currentChatPage && !lastChatPageState) {
        processedMessageTexts.clear();
        console.log('[小云] 进入聊天页面，清理消息缓存');
      }
      lastChatPageState = currentChatPage;

      if (currentChatPage) {
        checkForNewMessages();
      }
    }, 3000);
  }

  // 判断是否在聊天页面
  function isChatPage() {
    return document.querySelector('.message-text--zV88pB7N') !== null;
  }

  // 检测新消息
  function checkForNewMessages() {
    if (!isChatPage()) return;

    // 获取所有左侧消息气泡（买家消息）
    const buyerMsgEls = document.querySelectorAll('.message-text--zV88pB7N.message-text-left--Wvuv8NsL');
    if (buyerMsgEls.length === 0) return;

    // 遍历找新的
    for (var i = 0; i < buyerMsgEls.length; i++) {
      var el = buyerMsgEls[i];
      var text = el.textContent.trim();
      if (!text || text.length < 1 || text.length > 200) continue;

      // 跳过已处理的
      if (processedMessageTexts.has(text)) continue;

      // 标记为已处理
      processedMessageTexts.add(text);
      if (processedMessageTexts.size > MAX_PROCESSED_CACHE) {
        // 清除最早的一半
        var arr = Array.from(processedMessageTexts);
        processedMessageTexts.clear();
        arr.slice(Math.floor(arr.length / 2)).forEach(function(t) {
          processedMessageTexts.add(t);
        });
      }

      console.log('[小云] 检测到新消息:', text.substring(0, 50));

      // 自动回复
      autoReply(text, '买家', el);
      break; // 每次只回复最新的一条
    }
  }

  // ===== 自动回复 =====
  async function autoReply(messageText, buyerName, msgElement) {
    // 获取当前配置
    var config = await new Promise(function(resolve) {
      chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, function(msg) {
        resolve(msg);
      });
    });

    if (!config || !config.enabled || !config.autoReply) {
      console.log('[小云] 自动回复已关闭');
      return;
    }

    if (!config.apiKey) {
      console.warn('[小云] 未配置 API Key');
      return;
    }

    console.log('[小云] 正在生成回复...');

    // 生成买家 ID（用消息文本的前几个字作为标识，避免重复）
    const buyerId = 'buyer_' + messageText.substring(0, 10).replace(/\s/g, '');

    try {
      // 调用 background 处理
      const result = await callBackgroundReply(buyerId, buyerName, messageText);

      if (result && result.success) {
        console.log('[小云] 回复生成成功:', result.reply);
        // 自动填入并发送
        fillAndSendReply(result.reply, msgElement);
      } else {
        console.error('[小云] 回复失败:', result?.error);
      }
    } catch (error) {
      console.error('[小云] 调用 AI 失败:', error);
    }
  }

  // 调用 background.js 处理回复
  async function callBackgroundReply(buyerId, buyerName, userMessage) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ success: false, error: '请求超时' });
      }, 30000); // 30 秒超时

      chrome.runtime.sendMessage({
        type: 'REPLY_MESSAGE',
        buyerId: buyerId,
        buyerName: buyerName,
        userMessage: userMessage,
      }, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });
  }

  // 自动填入并发送回复
  function fillAndSendReply(reply, originalMsgEl) {
    // 找到聊天输入框
    const input = findChatInput();
    if (!input) {
      console.warn('[小云] 未找到输入框，显示回复提示');
      showReplyToast(reply);
      return;
    }

    console.log('[小云] 找到输入框，正在填入...');

    // 填入文本
    fillInput(input, reply);

    // 等待 DOM 更新后自动发送
    setTimeout(() => {
      autoSend(input);
    }, 500);
  }

  // 查找聊天输入框
  function findChatInput() {
    // 闲鱼 textarea 选择器
    var el = document.querySelector('textarea.textarea-no-border--cIId06_i');
    if (el && isVisible(el)) return el;

    // 兜底：找最后一个可见 textarea
    var all = document.querySelectorAll('textarea');
    for (var i = all.length - 1; i >= 0; i--) {
      if (isVisible(all[i])) return all[i];
    }

    return null;
  }

  // 检查元素是否可见
  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.top >= 0;
  }

  // 填入文本（兼容 textarea 和 contenteditable）
  function fillInput(input, text) {
    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
      input.value = text;
      // 触发 input 事件
      const event = new Event('input', { bubbles: true });
      input.dispatchEvent(event);

      // 触发 compositionend 事件（某些框架需要）
      const compEvent = new CompositionEvent('compositionend', { bubbles: true });
      input.dispatchEvent(compEvent);
    } else {
      // contenteditable
      input.textContent = text;
      input.focus();

      // 触发 input 事件
      const event = new Event('input', { bubbles: true });
      input.dispatchEvent(event);

      // 触发 compositionend 事件
      const compEvent = new CompositionEvent('compositionend', { bubbles: true });
      input.dispatchEvent(compEvent);
    }
  }

  // 自动发送
  function autoSend(input) {
    // 先聚焦
    input.focus();

    // 尝试按 Enter 键发送
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(enterEvent);

    const pressEvent = new KeyboardEvent('keyup', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(pressEvent);

    // 查找发送按钮
    const sendBtn = findSendButton();
    if (sendBtn) {
      console.log('[小云] 找到发送按钮，正在点击...');
      setTimeout(() => {
        sendBtn.click();
        // 发送成功后滚动到原始买家消息位置
        setTimeout(() => {
          scrollToMessage(originalMsgEl);
        }, 300);
      }, 200);
    } else {
      // 没找到发送按钮，至少填入了
      console.log('[小云] 未找到发送按钮，文本已填入');
      showToast('✅ 已填入，请手动发送');
    }
  }

  // 滚动到指定消息元素
  function scrollToMessage(el) {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // 高亮闪烁一下
    el.style.transition = 'background 0.3s';
    el.style.background = 'rgba(102, 126, 234, 0.15)';
    setTimeout(() => {
      el.style.background = '';
    }, 1500);
  }

  // 查找发送按钮
  function findSendButton() {
    // 闲鱼发送按钮：button.ant-btn 内有"发送"文字
    var allBtns = document.querySelectorAll('button.ant-btn');
    for (var i = 0; i < allBtns.length; i++) {
      var btn = allBtns[i];
      // 跳过 disabled 的按钮
      if (btn.disabled) continue;
      // 检查按钮内是否有"发送"文字
      if (btn.textContent.indexOf('发送') !== -1) {
        if (isVisible(btn)) return btn;
      }
    }
    return null;
  }

  // 如果自动发送失败，显示回复提示
  function showReplyToast(reply) {
    // 移除旧的 toast
    const old = document.getElementById('xiaoyun-reply-toast');
    if (old) old.remove();

    const container = document.createElement('div');
    container.id = 'xiaoyun-reply-toast';
    container.className = 'xy-reply-toast';
    container.innerHTML = `
      <div class="xy-toast-content">
        <div class="xy-toast-header">
          <span>☁️ 小云的回复</span>
          <button class="xy-toast-close">×</button>
        </div>
        <div class="xy-toast-body">${escapeHtml(reply)}</div>
        <div class="xy-toast-actions">
          <button class="xy-btn xy-btn-primary xy-copy-btn">📋 复制</button>
          <button class="xy-btn xy-btn-success xy-send-btn">📤 发送</button>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    container.querySelector('.xy-toast-close').addEventListener('click', () => {
      container.remove();
    });

    container.querySelector('.xy-copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(reply).then(() => {
        const btn = container.querySelector('.xy-copy-btn');
        btn.textContent = '✓ 已复制';
        setTimeout(() => { btn.textContent = '📋 复制'; }, 2000);
      });
    });

    container.querySelector('.xy-send-btn').addEventListener('click', () => {
      const input = findChatInput();
      if (input) {
        fillInput(input, reply);
        setTimeout(() => autoSend(input), 300);
      }
      container.remove();
    });

    // 30 秒自动消失
    setTimeout(() => {
      if (container.parentNode) container.remove();
    }, 30000);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ===== 接收 background 的消息 =====
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SHOW_REPLY') {
      showReplyToast(message.reply);
    }
  });

})();
