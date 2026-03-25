/**
 * ChatDot — Popup Script
 * Modern iOS-style settings with full functional logic.
 *
 * 所有开关功能完整可用：
 *  - enabled: 控制 content script 中侧边栏的显示/隐藏
 *  - showPreview: 控制 hover 消息预览的启用/禁用
 *  - showOutline: 控制大纲按钮和面板的显示/隐藏
 *  - scrollMode: 控制滚动行为 smooth/instant
 *  - language: 实时切换 popup 界面语言 + 通知 content script
 */

(function () {
  'use strict';

  // ============================================
  // i18n
  // ============================================
  const I18N = {
    zh: {
      enable_nav: '启用导航栏',
      show_preview: '悬浮预览',
      show_preview_desc: '导航按钮悬停显示消息内容',
      show_outline: '消息大纲',
      show_outline_desc: '侧边栏显示对话索引',
      scroll_mode: '滚动模式',
      smooth: '平滑',
      instant: '瞬移',
      status_active: '导航已启用',
      status_inactive: '导航已停用',
      version: '版本',
      official_doc: '官方文档',
      star_project: '为项目点亮 ⭐'
    },
    en: {
      enable_nav: 'Enable Navigation',
      show_preview: 'Hover Preview',
      show_preview_desc: 'Show message preview on hover',
      show_outline: 'Message Outline',
      show_outline_desc: 'Show conversation index',
      scroll_mode: 'Scroll Mode',
      smooth: 'Smooth',
      instant: 'Instant',
      status_active: 'Navigation enabled',
      status_inactive: 'Navigation disabled',
      version: 'Version',
      official_doc: 'Official Docs',
      star_project: 'Star on GitHub'
    },
    ja: {
      enable_nav: 'ナビを有効化',
      show_preview: 'ホバープレビュー',
      show_preview_desc: 'ホバーでメッセージを表示',
      show_outline: 'アウトライン',
      show_outline_desc: '会話インデックスを表示',
      scroll_mode: 'スクロール',
      smooth: 'スムーズ',
      instant: 'ジャンプ',
      status_active: 'ナビ有効',
      status_inactive: 'ナビ無効',
      version: 'バージョン',
      official_doc: '公式ドキュメント',
      star_project: 'GitHubでスターを ✨'
    },
    ko: {
      enable_nav: '네비 활성화',
      show_preview: '호버 미리보기',
      show_preview_desc: '호버 시 메시지 표시',
      show_outline: '개요',
      show_outline_desc: '대화 색인 표시',
      scroll_mode: '스크롤 모드',
      smooth: '부드럽게',
      instant: '점프',
      status_active: '네비 활성',
      status_inactive: '네비 비활성',
      version: '버전',
      official_doc: '공식 문서',
      star_project: '프로젝트에 별을 ⭐'
    },
  };

  // ============================================
  // 默认设置
  // ============================================
  const DEFAULTS = {
    enabled: true,
    scrollMode: 'smooth',
    language: 'zh',
    showPreview: true,
    showOutline: true,
  };

  // ============================================
  // DOM
  // ============================================
  const $ = (id) => document.getElementById(id);

  const toggleEnabled = $('toggle-enabled');
  const togglePreview = $('toggle-preview');
  const toggleOutline = $('toggle-outline');
  const scrollModeEl  = $('scroll-mode');
  const btnLang       = $('btn-lang');
  const langPopup     = $('lang-popup');
  const statusEl      = $('status');

  let currentLang = 'zh';

  // 自动获取版本号
  const manifestData = chrome.runtime.getManifest();
  const versionNumEl = $('version-num');
  if (versionNumEl && manifestData) {
    versionNumEl.textContent = manifestData.version || '1.0.0';
  }

  // ============================================
  // 加载设置
  // ============================================
  chrome.storage.local.get(DEFAULTS, (data) => {
    applySettings(data);
  });

  function applySettings(data) {
    toggleEnabled.checked = data.enabled;
    togglePreview.checked = data.showPreview;
    toggleOutline.checked = data.showOutline;
    currentLang           = data.language || 'zh';

    scrollModeEl.querySelectorAll('.seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === data.scrollMode);
    });

    updateLangUI(currentLang);
    applyI18n(currentLang);
    updateStatus(data.enabled);
  }

  // ============================================
  // 保存 & 通知 content script
  // ============================================
  function save(changes) {
    chrome.storage.local.set(changes);

    // 通知当前标签页
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'settingsChanged', ...changes }).catch(() => {});
      }
    });
  }

  // ============================================
  // 事件：启用/禁用 — 实际控制侧边栏显示
  // ============================================
  toggleEnabled.addEventListener('change', () => {
    const enabled = toggleEnabled.checked;
    save({ enabled });
    updateStatus(enabled);
  });

  // ============================================
  // 事件：悬浮预览 — 控制 hover tooltip
  // ============================================
  togglePreview.addEventListener('change', () => {
    save({ showPreview: togglePreview.checked });
  });

  // ============================================
  // 事件：大纲 — 控制大纲按钮和面板显示
  // ============================================
  toggleOutline.addEventListener('change', () => {
    save({ showOutline: toggleOutline.checked });
  });

  // ============================================
  // 事件：滚动模式
  // ============================================
  scrollModeEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    scrollModeEl.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    save({ scrollMode: btn.dataset.value });
  });

  // ============================================
  // 事件：语言弹出菜单
  // ============================================
  btnLang.addEventListener('click', (e) => {
    e.stopPropagation();
    const isShown = langPopup.classList.contains('show');
    langPopup.classList.toggle('show', !isShown);
    btnLang.classList.toggle('active', !isShown);
  });

  // 点击语言选项
  langPopup.addEventListener('click', (e) => {
    e.stopPropagation();
    const opt = e.target.closest('.lang-option');
    if (!opt) return;
    const lang = opt.dataset.lang;
    currentLang = lang;
    save({ language: lang });
    updateLangUI(lang);
    applyI18n(lang);
    langPopup.classList.remove('show');
    btnLang.classList.remove('active');
  });

  // 点击外部关闭
  document.addEventListener('click', () => {
    langPopup.classList.remove('show');
    btnLang.classList.remove('active');
  });

  // ============================================
  // UI 更新
  // ============================================
  function updateLangUI(lang) {
    langPopup.querySelectorAll('.lang-option').forEach(opt => {
      const selected = opt.dataset.lang === lang;
      opt.classList.toggle('selected', selected);
      opt.querySelector('.lang-check').textContent = selected ? '✓' : '';
    });
  }

  function applyI18n(lang) {
    const t = I18N[lang] || I18N.zh;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (t[key]) el.textContent = t[key];
    });
    scrollModeEl.querySelectorAll('.seg-btn').forEach(btn => {
      const key = btn.dataset.i18n;
      if (I18N[lang]?.[key]) btn.textContent = I18N[lang][key];
    });
  }

  function updateStatus(enabled) {
    const t = I18N[currentLang] || I18N.zh;
    if (enabled) {
      statusEl.innerHTML = `<span data-i18n="status_active">${t.status_active}</span>`;
      statusEl.className = 'status-bar active';
    } else {
      statusEl.innerHTML = `<span data-i18n="status_inactive">${t.status_inactive}</span>`;
      statusEl.className = 'status-bar inactive';
    }
  }

})();
