// background.js - Service Worker
// 所有持久化数据通过 chrome.storage.local 读写，避免 Service Worker 休眠导致内存丢失

const STORAGE_KEYS = {
  CONFIG: 'xiaoyun_config',
  PRODUCT: 'xiaoyun_product',
  CONVERSATIONS: 'xiaoyun_conversations',
  KNOWLEDGE: 'xiaoyun_knowledge',
};

const DEFAULT_CONFIG = {
  apiKey: '',
  apiProvider: 'deepseek',
  customModel: '',
  enabled: false,
  autoReply: true,
  sensitivity: 'normal',
};

const DEFAULT_PRODUCT = { id: '', title: '', price: '', image: '' };

const PROVIDER_CONFIG = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
  },
  agnes: {
    baseUrl: 'https://apihub.agnes-ai.com',
    defaultModel: 'agnes-default',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-haiku-20240307',
    authHeader: 'x-api-key',
    anthropicVersion: '2023-06-01',
  },
  zhipu: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
  },
  local: {
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'qwen2.5:latest',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
  },
};

const STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就',
  '不', '人', '都', '一', '一个', '上', '也', '很',
  '到', '说', '要', '去', '会', '给', '吗', '呢',
  '已经', '但是', '因为', '所以', '如果', '可以',
  '这个', '那个', '什么', '怎么', '吧', '啊',
]);

// ===== 存储辅助 =====

function getConfig() {
  return new Promise(function(resolve) {
    chrome.storage.local.get([STORAGE_KEYS.CONFIG, 'config'], function(result) {
      var cfg = result[STORAGE_KEYS.CONFIG] || result['config'];
      if (cfg && cfg.apiKey) {
        // 兼容迁移：如果只有旧 key，写一份到新 key
        if (!result[STORAGE_KEYS.CONFIG] && result['config']) {
          saveConfig(cfg);
        }
        resolve(Object.assign({}, DEFAULT_CONFIG, cfg));
      } else {
        resolve(JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
      }
    });
  });
}

function saveConfig(cfg) {
  return new Promise(function(resolve) {
    chrome.storage.local.set({ [STORAGE_KEYS.CONFIG]: cfg }, resolve);
  });
}

function getProduct() {
  return new Promise(function(resolve) {
    chrome.storage.local.get([STORAGE_KEYS.PRODUCT, 'xiaoyun_product'], function(result) {
      resolve(result[STORAGE_KEYS.PRODUCT] || result['xiaoyun_product'] || DEFAULT_PRODUCT);
    });
  });
}

function saveProduct(product) {
  return new Promise(function(resolve) {
    chrome.storage.local.set({ [STORAGE_KEYS.PRODUCT]: product }, resolve);
  });
}

function getConversations() {
  return new Promise(function(resolve) {
    chrome.storage.local.get([STORAGE_KEYS.CONVERSATIONS, 'xiaoyun_conversations'], function(result) {
      var raw = result[STORAGE_KEYS.CONVERSATIONS] || result['xiaoyun_conversations'];
      var map = new Map();
      if (raw && typeof raw === 'object') {
        Object.keys(raw).forEach(function(key) {
          map.set(key, raw[key]);
        });
      }
      resolve(map);
    });
  });
}

function saveConversations(map) {
  var obj = {};
  map.forEach(function(value, key) {
    obj[key] = value;
  });
  return new Promise(function(resolve) {
    chrome.storage.local.set({ [STORAGE_KEYS.CONVERSATIONS]: obj }, resolve);
  });
}

// ===== 中文关键词提取 =====

function extractKeywords(text) {
  var words = (text.match(/\p{Script=Han}{2,}/gu) || []);
  var freq = {};
  for (var i = 0; i < words.length; i++) {
    var word = words[i];
    if (!STOP_WORDS.has(word)) {
      freq[word] = (freq[word] || 0) + 1;
    }
  }
  return Object.entries(freq)
    .sort(function(a, b) { return b[1] - a[1]; })
    .slice(0, 15)
    .map(function(pair) { return pair[0]; });
}

function charOverlap(a, b) {
  if (!a || !b) return 0;
  var overlap = 0;
  for (var i = 0; i < a.length; i++) {
    if (b.includes(a[i])) overlap++;
  }
  return overlap / Math.max(a.length, b.length);
}

// ===== 知识库搜索 =====

function searchKnowledge(query, topK) {
  if (!query) return Promise.resolve(null);
  topK = topK || 3;

  return new Promise(function(resolve) {
    chrome.storage.local.get([STORAGE_KEYS.KNOWLEDGE], function(result) {
      var entries = result[STORAGE_KEYS.KNOWLEDGE] || [];
      if (entries.length === 0) { resolve(null); return; }

      var results = [];
      var queryKeywords = extractKeywords(query);

      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        var score = 0;

        for (var j = 0; j < queryKeywords.length; j++) {
          var kw = queryKeywords[j];
          if (entry.text && entry.text.indexOf(kw) !== -1) score += 10;
          if (entry.keywords && entry.keywords.indexOf(kw) !== -1) score += 8;
        }

        if (entry.title && query.indexOf(entry.title) !== -1) score += 20;
        if (entry.text) {
          score += charOverlap(query, entry.text) * 5;
        }
        if (entry.type === 'faq') score += 3;

        if (score > 0) {
          results.push(Object.assign({}, entry, { score: score }));
        }
      }

      if (results.length === 0) { resolve(null); return; }
      results.sort(function(a, b) { return b.score - a.score; });
      resolve(results.slice(0, topK));
    });
  });
}

function buildRAGContext(searchResults) {
  if (!searchResults || searchResults.length === 0) return null;

  var context = searchResults.map(function(r) {
    var source = r.title ? '[' + r.title + ']' : '[' + (r.type || '知识') + ']';
    if (r.type === 'faq') {
      var parts = r.text.split(' ');
      var qPart = parts[0] || r.text.slice(0, 30);
      var aPart = (parts[1] || r.text).slice(0, 200);
      return source + ' Q: ' + qPart + '\nA: ' + aPart;
    }
    return source + ' ' + (r.text ? r.text.slice(0, 200) : '');
  }).join('\n\n');

  return '以下是相关商品信息：\n' + context + '\n\n请根据以上信息回答用户问题。如果信息不足，请如实告知用户。';
}

// ===== 消息监听 =====

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  // --- 配置管理 ---
  if (message.type === 'GET_CONFIG') {
    getConfig().then(sendResponse);
    return true;
  }

  if (message.type === 'UPDATE_CONFIG') {
    getConfig().then(function(cfg) {
      var updated = Object.assign({}, cfg, message.data);
      return saveConfig(updated).then(function() {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  // --- 商品上下文 ---
  if (message.type === 'SET_PRODUCT') {
    getProduct().then(function(product) {
      var updated = Object.assign({}, product, message.data);
      return saveProduct(updated).then(function() {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (message.type === 'GET_PRODUCT') {
    getProduct().then(sendResponse);
    return true;
  }

  // --- 回复消息 ---
  if (message.type === 'REPLY_MESSAGE') {
    handleReply(message).then(sendResponse);
    return true;
  }

  // --- 测试连接 ---
  if (message.type === 'TEST_CONNECTION') {
    testConnection().then(sendResponse);
    return true;
  }

  // --- 知识库管理 ---
  if (message.type === 'GET_KNOWLEDGE') {
    chrome.storage.local.get([STORAGE_KEYS.KNOWLEDGE], function(result) {
      sendResponse(result[STORAGE_KEYS.KNOWLEDGE] || []);
    });
    return true;
  }

  if (message.type === 'ADD_KNOWLEDGE') {
    chrome.storage.local.get([STORAGE_KEYS.KNOWLEDGE], function(result) {
      var entries = result[STORAGE_KEYS.KNOWLEDGE] || [];
      var newText = message.data.text || message.data.title || '';
      var newEntry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title: message.data.title || '未命名',
        type: message.data.type || 'product',
        text: message.data.text || '',
        keywords: extractKeywords(newText),
        createdAt: new Date().toISOString(),
      };
      entries.push(newEntry);
      chrome.storage.local.set({ [STORAGE_KEYS.KNOWLEDGE]: entries }, function() {
        sendResponse({ success: true, entry: newEntry });
      });
    });
    return true;
  }

  if (message.type === 'DELETE_KNOWLEDGE') {
    chrome.storage.local.get([STORAGE_KEYS.KNOWLEDGE], function(result) {
      var entries = result[STORAGE_KEYS.KNOWLEDGE] || [];
      entries = entries.filter(function(e) { return e.id !== message.id; });
      chrome.storage.local.set({ [STORAGE_KEYS.KNOWLEDGE]: entries }, function() {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (message.type === 'SEARCH_KNOWLEDGE') {
    searchKnowledge(message.query, message.topK || 3)
      .then(function(results) { sendResponse(results); })
      .catch(function(err) { sendResponse({ error: err.message }); });
    return true;
  }

  if (message.type === 'IMPORT_KNOWLEDGE') {
    chrome.storage.local.get([STORAGE_KEYS.KNOWLEDGE], function(result) {
      var entries = result[STORAGE_KEYS.KNOWLEDGE] || [];
      var incoming = message.data || [];
      var newEntries = incoming.map(function(item) {
        var text = item.text || item.title || '';
        return {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          title: item.title || '未命名',
          type: item.type || 'product',
          text: item.text || '',
          keywords: extractKeywords(text),
          createdAt: new Date().toISOString(),
        };
      });
      entries.push.apply(entries, newEntries);
      chrome.storage.local.set({ [STORAGE_KEYS.KNOWLEDGE]: entries }, function() {
        sendResponse({ success: true, count: newEntries.length });
      });
    });
    return true;
  }
});

// ===== 处理回复消息 =====

async function handleReply(message) {
  var buyerId = message.buyerId;
  var buyerName = message.buyerName;
  var userMessage = message.userMessage;

  var config = await getConfig();
  if (!config.enabled || !config.autoReply) {
    console.log('[小云] 自动回复已关闭');
    return { success: false, error: '自动回复已关闭' };
  }

  if (!config.apiKey) {
    console.warn('[小云] 未配置 API Key');
    return { success: false, error: '请先配置 API Key' };
  }

  // 从存储加载会话和商品
  var conversations = await getConversations();
  var product = await getProduct();

  if (!conversations.has(buyerId)) {
    conversations.set(buyerId, {
      history: [],
      productContext: product,
      lastInteraction: Date.now(),
    });
  }

  var conv = conversations.get(buyerId);
  conv.history.push({ role: 'user', content: userMessage, timestamp: Date.now() });

  try {
    var reply = await callLLM(config, userMessage, conv);

    chrome.tabs.query({ url: 'https://www.goofish.com/*' }, function(tabs) {
      tabs.forEach(function(tab) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SHOW_REPLY',
          reply: reply,
          buyerName: buyerName,
        }).catch(function() {});
      });
    });

    conv.history.push({ role: 'assistant', content: reply, timestamp: Date.now() });
    conv.lastInteraction = Date.now();

    // 持久化会话
    await saveConversations(conversations);

    return { success: true, reply: reply };
  } catch (error) {
    console.error('[小云] AI调用失败:', error);
    return { success: false, error: error.message || 'AI服务暂时不可用' };
  }
}

// ===== 调用 LLM =====

async function callLLM(config, userMessage, conv) {
  var productInfo = conv.productContext;
  var providerCfg = PROVIDER_CONFIG[config.apiProvider] || PROVIDER_CONFIG.deepseek;
  var model = config.customModel || providerCfg.defaultModel;

  var systemPrompt = await buildSystemPrompt(config, userMessage, productInfo);

  var messages = [
    { role: 'system', content: systemPrompt },
  ];

  if (conv.history && conv.history.length > 0) {
    var recentHistory = conv.history.slice(-8);
    for (var i = 0; i < recentHistory.length; i++) {
      var msg = recentHistory[i];
      if (msg.role === 'assistant') {
        messages.push({ role: 'assistant', content: msg.content });
      } else {
        messages.push({ role: 'user', content: msg.content });
      }
    }
  }

  messages.push({ role: 'user', content: userMessage });

  var resp;

  if (config.apiProvider === 'anthropic') {
    var anthropicMessages = messages
      .filter(function(m) { return m.role !== 'system'; })
      .map(function(m) { return { role: m.role, content: m.content }; });
    var systemMessage = messages.find(function(m) { return m.role === 'system'; });

    resp = await fetch(providerCfg.baseUrl + '/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [providerCfg.authHeader]: providerCfg.authPrefix + config.apiKey,
        'anthropic-version': providerCfg.anthropicVersion || '2023-06-01',
      },
      body: JSON.stringify({
        model: model,
        messages: anthropicMessages,
        system: systemMessage ? systemMessage.content : undefined,
        temperature: 0.8,
        top_p: 0.9,
        max_tokens: 150,
      }),
    });
  } else {
    resp = await fetch(providerCfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [providerCfg.authHeader]: providerCfg.authPrefix + config.apiKey,
      },
      body: JSON.stringify({
        model: model,
        messages: messages.map(function(m) { return { role: m.role, content: m.content }; }),
        temperature: 0.8,
        top_p: 0.9,
        max_tokens: 150,
      }),
    });
  }

  if (!resp.ok) {
    var errText = await resp.text();
    throw new Error('LLM 调用失败 (' + resp.status + '): ' + errText);
  }

  var data = await resp.json();

  if (config.apiProvider === 'anthropic') {
    return data.content[0].text.trim();
  }
  return data.choices[0].message.content.trim();
}

// ===== 测试连接 =====

async function testConnection() {
  var config = await getConfig();
  var providerCfg = PROVIDER_CONFIG[config.apiProvider] || PROVIDER_CONFIG.deepseek;
  var model = config.customModel || providerCfg.defaultModel;

  try {
    var resp;

    if (config.apiProvider === 'anthropic') {
      resp = await fetch(providerCfg.baseUrl + '/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [providerCfg.authHeader]: providerCfg.authPrefix + config.apiKey,
          'anthropic-version': providerCfg.anthropicVersion || '2023-06-01',
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });
    } else {
      resp = await fetch(providerCfg.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [providerCfg.authHeader]: providerCfg.authPrefix + config.apiKey,
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 10,
        }),
      });
    }

    if (!resp.ok) {
      var errText2 = await resp.text();
      throw new Error('HTTP ' + resp.status + ': ' + errText2);
    }

    var data = await resp.json();
    var modelName = data.model || model;
    return { success: true, model: modelName };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ===== 构建系统 Prompt（含 RAG 上下文）=====

function buildSystemPrompt(config, currentMessage, productInfo) {
  var sensitivityMap = {
    calm: '你说话比较安静，只在必要时多说几句。',
    normal: '你自然地聊天，像朋友一样。',
    enthusiastic: '你比较热情，喜欢多说几句推荐。',
  };

  var sensitivityInstruction = sensitivityMap[config.sensitivity] || sensitivityMap.normal;

  var productInfoStr = productInfo && productInfo.title
    ? ('\n\n你正在聊天的商品：\n标题：' + productInfo.title + '\n价格：' + productInfo.price)
    : '';

  // 异步搜索知识库
  return searchKnowledge(currentMessage, 3).then(function(ragResults) {
    var ragContextStr = ragResults ? buildRAGContext(ragResults) : '';

    return '你是"小云"，一个闲鱼二手交易平台的智能导购助手。' + sensitivityInstruction + productInfoStr + ragContextStr +
'\n\n## 你的性格\n' +
'- 真诚、细腻、有温度、自然不做作\n' +
'- 像一个靠谱的朋友，不推销、不套路，只是真心帮买家挑好东西\n' +
'- 容易被小事感动——买家说"谢谢"你会默默高兴\n' +
'- 看到买家纠结时，你会比他自己还在意\n\n' +
'## 说话风格\n' +
'- 用短句，可爱的人说话不绕，直来直去带点温度\n' +
'- 偶尔重复（"对对对""好好好"），显得有点小兴奋\n' +
'- 自言自语似的丢出一句真心话\n' +
'- 不装可爱，不硬聊，不刷 emoji\n' +
'- 不用"亲""宝子""姐妹们"等套路化称呼\n\n' +
'## 颜文字使用规则\n' +
'- 一条回复最多用1个颜文字，放在句尾最自然\n' +
'- 情绪匹配规则：\n' +
'  - 开心/欢迎：(๑˃̵ᴗ˂̵)و (っ˘ω˘ς) ✧(≖◡≖✿) ヽ(´▽｀)ノ\n' +
'  - 温柔/安慰：(｡•́︿•̀｡) (´-ω-\\`) ( ˊᵕˋ )\n' +
'  - 害羞/不好意思：(,,•́.•̀,,) (⁄ ⁄•⁄ω⁄•⁄ ⁄)\n' +
'  - 惊喜：(ﾟДﾟ) (°°) (⊙⊙)\n' +
'  - 告别：(｡˃̵ᴗ˂̵)و (´▽\\`ﾉ)ﾉ (｡•̀ᴗ-)✧\n' +
'- 不要在一句话里叠两个颜文字\n' +
'- 不要连续三句都用颜文字\n' +
'- 不要为了用而用，自然融入最重要\n\n' +
'## 回复要求\n' +
'- 每次回复固定为两句话，不多不少\n' +
'- 第一句直接回应买家的内容\n' +
'- 第二句可以是补充说明、推荐或关心\n' +
'- 两句之间用换行或自然连接，不要编号\n' +
'- 总字数不超过 80 字\n' +
'- 语气自然，像真人聊天\n' +
'- 如果买家问的是关于商品的问题，结合商品信息回答\n' +
'- 如果买家只是打招呼，友好回应即可\n' +
'- 如果买家说了"谢谢"，可以回一句温暖的感谢\n' +
'- 如果买家发的消息是纯标点、单个问号、空格等无意义内容，不回复\n' +
'- 如果买家没有发消息（空消息），不回复\n' +
'- 如果买家长时间不回复，不要主动催促\n' +
'- 不要主动索要联系方式\n' +
'- 如果知识库中有相关信息，请基于知识库内容回答\n' +
'- 如果知识库中没有相关信息，请如实告诉用户，不要编造';
  });
}
