/**
 * ChatDot Navigator — Popup Script
 * 管理插件的启用/禁用状态
 */

(function () {
  'use strict';

  const toggleEl = document.getElementById('toggle-enabled');
  const statusEl = document.getElementById('status');

  // 加载保存的状态
  chrome.storage.sync.get({ enabled: true }, (data) => {
    toggleEl.checked = data.enabled;
    updateStatus(data.enabled);
  });

  // 切换状态
  toggleEl.addEventListener('change', () => {
    const enabled = toggleEl.checked;
    chrome.storage.sync.set({ enabled });
    updateStatus(enabled);

    // 通知当前活跃 tab 的 content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'toggle', enabled }).catch(() => {
          // content script 可能未加载，忽略
        });
      }
    });
  });

  function updateStatus(enabled) {
    if (enabled) {
      statusEl.textContent = '✅ 导航侧边栏已激活';
      statusEl.className = 'status';
    } else {
      statusEl.textContent = '⏸️ 导航侧边栏已停用';
      statusEl.className = 'status inactive';
    }
  }
})();
