// popup.js - 弹出窗口的交互逻辑

(function() {
  'use strict';

  // ===== Tab 切换 =====
  document.querySelectorAll('.tab-nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-nav button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  // ===== 保存 / 测试 =====
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  document.getElementById('testBtn').addEventListener('click', testConnection);
  document.getElementById('addKbBtn').addEventListener('click', addKnowledge);
  document.getElementById('importKbBtn').addEventListener('click', importBatchKnowledge);

  // 加载设置
  loadSettings();
  loadKnowledge();

  function loadSettings() {
    chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, (msg) => {
      if (!msg) return;
      document.getElementById('enabled').checked = msg.enabled;
      document.getElementById('autoReply').checked = msg.autoReply;
      document.getElementById('sensitivity').value = msg.sensitivity;
      document.getElementById('provider').value = msg.apiProvider;
      document.getElementById('apiKey').value = msg.apiKey || '';
      document.getElementById('customModel').value = msg.customModel || '';
    });
  }

  function saveSettings() {
    const data = {
      enabled: document.getElementById('enabled').checked,
      autoReply: document.getElementById('autoReply').checked,
      sensitivity: document.getElementById('sensitivity').value,
      apiProvider: document.getElementById('provider').value,
      apiKey: document.getElementById('apiKey').value,
      customModel: document.getElementById('customModel').value,
    };

    chrome.runtime.sendMessage({ type: 'UPDATE_CONFIG', data }, (res) => {
      const status = document.getElementById('status');
      status.textContent = '✓ 设置已保存';
      status.className = 'status ok';
      setTimeout(() => { status.textContent = ''; }, 2000);
    });
  }

  function testConnection() {
    const provider = document.getElementById('provider').value;
    const apiKey = document.getElementById('apiKey').value;
    const model = document.getElementById('customModel').value;

    if (!apiKey) {
      document.getElementById('status').textContent = '✗ 请先填写 API Key';
      document.getElementById('status').className = 'status err';
      return;
    }

    document.getElementById('status').textContent = '连接中...';
    document.getElementById('status').className = 'status';

    chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' }, (res) => {
      if (res && res.success) {
        document.getElementById('status').textContent = '✓ 连接成功: ' + (res.model || provider);
        document.getElementById('status').className = 'status ok';
      } else {
        document.getElementById('status').textContent = '✗ 连接失败: ' + (res?.error || '未知错误');
        document.getElementById('status').className = 'status err';
      }
    });
  }

  // ===== 知识库管理 =====
  function addKnowledge() {
    const title = document.getElementById('kb-title').value.trim();
    const type = document.getElementById('kb-type').value;
    const text = document.getElementById('kb-text').value.trim();

    if (!title || !text) {
      alert('请填写标题和内容');
      return;
    }

    chrome.runtime.sendMessage({
      type: 'ADD_KNOWLEDGE',
      data: { title, type, text },
    }, (res) => {
      if (res && res.success) {
        document.getElementById('kb-title').value = '';
        document.getElementById('kb-text').value = '';
        loadKnowledge();
      }
    });
  }

  function deleteKnowledge(id) {
    chrome.runtime.sendMessage({
      type: 'DELETE_KNOWLEDGE',
      id: id,
    }, (res) => {
      if (res && res.success) {
        loadKnowledge();
      }
    });
  }

  function loadKnowledge() {
    chrome.runtime.sendMessage({ type: 'GET_KNOWLEDGE' }, (entries) => {
      if (!entries) return;
      const list = document.getElementById('kb-list');
      const count = document.getElementById('kb-count');
      count.textContent = entries.length;

      if (entries.length === 0) {
        list.innerHTML = '<div class="kb-empty">暂无知识条目，点击上方添加</div>';
        return;
      }

      list.innerHTML = entries.map(entry => `
        <div class="kb-entry">
          <div class="kb-entry-header">
            <span class="kb-entry-title">${escapeHtml(entry.title)}</span>
            <span class="kb-entry-type">${escapeHtml(entry.type)}</span>
          </div>
          <div class="kb-entry-text">${escapeHtml(entry.text)}</div>
          <button class="kb-entry-delete" onclick="this.closest('.kb-entry').remove(); chrome.runtime.sendMessage({type:'DELETE_KNOWLEDGE',id:'${entry.id}'},()=>{});" title="删除">×</button>
        </div>
      `).join('');
    });
  }

  function importBatchKnowledge() {
    const jsonStr = document.getElementById('kb-import-json').value.trim();
    if (!jsonStr) {
      alert('请输入 JSON 数据');
      return;
    }

    try {
      const entries = JSON.parse(jsonStr);
      if (!Array.isArray(entries)) {
        alert('JSON 必须是一个数组');
        return;
      }
      chrome.runtime.sendMessage({
        type: 'IMPORT_KNOWLEDGE',
        data: entries,
      }, (res) => {
        if (res && res.success) {
          document.getElementById('kb-import-json').value = '';
          loadKnowledge();
        }
      });
    } catch (e) {
      alert('JSON 格式错误: ' + e.message);
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();
