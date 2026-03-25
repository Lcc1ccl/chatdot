/**
 * ChatDot Navigator — Popup Script
 * 管理插件设置：启用/禁用、滚动模式、云同步、语言、消息预览
 */

(function () {
  'use strict';

  // ============================================
  // i18n 翻译表
  // ============================================
  const I18N = {
    zh: {
      nav_settings: '导航设置',
      enable_nav: '启用导航栏',
      show_preview: '悬浮预览消息',
      show_preview_desc: 'Hover 导航按钮时显示消息预览',
      scroll_mode: '滚动模式',
      smooth: '流动',
      instant: '跳跃',
      cloud_sync: '云同步',
      sync_settings: '同步设置到 Chrome',
      sync_settings_desc: '在不同设备间同步偏好',
      language: '语言 / Language',
      status_active: '导航侧边栏已激活',
      status_inactive: '导航侧边栏已停用',
      inspired_by: '灵感来自',
      star_project: '为项目点亮 ⭐',
    },
    en: {
      nav_settings: 'Navigation',
      enable_nav: 'Enable Sidebar',
      show_preview: 'Message Preview',
      show_preview_desc: 'Show message preview on button hover',
      scroll_mode: 'Scroll Mode',
      smooth: 'Smooth',
      instant: 'Jump',
      cloud_sync: 'Cloud Sync',
      sync_settings: 'Sync to Chrome',
      sync_settings_desc: 'Sync preferences across devices',
      language: 'Language / 语言',
      status_active: 'Navigation sidebar active',
      status_inactive: 'Navigation sidebar disabled',
      inspired_by: 'Inspired by',
      star_project: 'Star on GitHub ⭐',
    },
    ja: {
      nav_settings: 'ナビゲーション',
      enable_nav: 'サイドバーを有効化',
      show_preview: 'メッセージプレビュー',
      show_preview_desc: 'ボタンホバー時にメッセージをプレビュー',
      scroll_mode: 'スクロールモード',
      smooth: 'スムーズ',
      instant: 'ジャンプ',
      cloud_sync: 'クラウド同期',
      sync_settings: 'Chrome に同期',
      sync_settings_desc: 'デバイス間で設定を同期',
      language: '言語 / Language',
      status_active: 'ナビサイドバー有効',
      status_inactive: 'ナビサイドバー無効',
      inspired_by: 'インスピレーション元',
      star_project: 'GitHub でスター ⭐',
    },
    ko: {
      nav_settings: '내비게이션',
      enable_nav: '사이드바 활성화',
      show_preview: '메시지 미리보기',
      show_preview_desc: '버튼 호버 시 메시지 미리보기',
      scroll_mode: '스크롤 모드',
      smooth: '부드럽게',
      instant: '점프',
      cloud_sync: '클라우드 동기화',
      sync_settings: 'Chrome에 동기화',
      sync_settings_desc: '기기 간 설정 동기화',
      language: '언어 / Language',
      status_active: '내비게이션 사이드바 활성',
      status_inactive: '내비게이션 사이드바 비활성',
      inspired_by: '영감',
      star_project: 'GitHub 스타 ⭐',
    },
  };

  // ============================================
  // 默认设置
  // ============================================
  const DEFAULTS = {
    enabled: true,
    scrollMode: 'smooth',  // 'smooth' | 'instant'
    cloudSync: true,
    language: 'zh',
    showPreview: true,
  };

  // ============================================
  // DOM 引用
  // ============================================
  const toggleEnabled = document.getElementById('toggle-enabled');
  const togglePreview = document.getElementById('toggle-preview');
  const toggleSync = document.getElementById('toggle-sync');
  const scrollModeContainer = document.getElementById('scroll-mode');
  const langSelect = document.getElementById('lang-select');
  const langSection = document.getElementById('lang-section');
  const btnLang = document.getElementById('btn-lang');
  const statusEl = document.getElementById('status');

  // ============================================
  // 加载设置
  // ============================================
  const storageAPI = chrome.storage.sync || chrome.storage.local;

  storageAPI.get(DEFAULTS, (data) => {
    toggleEnabled.checked = data.enabled;
    togglePreview.checked = data.showPreview;
    toggleSync.checked = data.cloudSync;
    langSelect.value = data.language;

    // 更新滚动模式按钮
    scrollModeContainer.querySelectorAll('.seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === data.scrollMode);
    });

    updateStatus(data.enabled);
    applyI18n(data.language);
  });

  // ============================================
  // 保存 & 通知
  // ============================================
  function saveSettings(changes) {
    storageAPI.set(changes);
    notifyContentScript(changes);
  }

  function notifyContentScript(data) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'settingsChanged', ...data }).catch(() => {});
      }
    });
  }

  // ============================================
  // 事件绑定
  // ============================================

  // 启用/禁用
  toggleEnabled.addEventListener('change', () => {
    const enabled = toggleEnabled.checked;
    saveSettings({ enabled });
    updateStatus(enabled);
  });

  // 消息预览
  togglePreview.addEventListener('change', () => {
    saveSettings({ showPreview: togglePreview.checked });
  });

  // 云同步
  toggleSync.addEventListener('change', () => {
    const cloudSync = toggleSync.checked;
    // 如果关闭，切换到 local storage
    chrome.storage.sync.set({ cloudSync });
    chrome.storage.local.set({ cloudSync });
  });

  // 滚动模式
  scrollModeContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    scrollModeContainer.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    saveSettings({ scrollMode: btn.dataset.value });
  });

  // 语言切换面板 toggle
  btnLang.addEventListener('click', () => {
    const visible = langSection.style.display !== 'none';
    langSection.style.display = visible ? 'none' : 'block';
    btnLang.classList.toggle('active', !visible);
  });

  // 语言选择
  langSelect.addEventListener('change', () => {
    const lang = langSelect.value;
    saveSettings({ language: lang });
    applyI18n(lang);
  });

  // ============================================
  // i18n 应用
  // ============================================
  function applyI18n(lang) {
    const t = I18N[lang] || I18N.zh;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (t[key]) el.textContent = t[key];
    });
    // 更新滚动模式按钮文字
    scrollModeContainer.querySelectorAll('.seg-btn').forEach(btn => {
      const key = btn.dataset.i18n;
      if (t[key]) btn.textContent = t[key];
    });
  }

  // ============================================
  // 状态更新
  // ============================================
  function updateStatus(enabled) {
    const statusSpan = statusEl.querySelector('[data-i18n]');
    if (enabled) {
      statusEl.innerHTML = '✅ <span data-i18n="status_active">' + (statusSpan?.textContent || '导航侧边栏已激活') + '</span>';
      statusEl.className = 'status';
    } else {
      statusEl.innerHTML = '⏸️ <span data-i18n="status_inactive">' + (statusSpan?.textContent || '导航侧边栏已停用') + '</span>';
      statusEl.className = 'status inactive';
    }
    // 重新应用当前语言
    storageAPI.get({ language: 'zh' }, (d) => applyI18n(d.language));
  }

})();
