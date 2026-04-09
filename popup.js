/**
 * ChatDot — Popup Script
 */

(function () {
  'use strict';

  const popupLogic = globalThis.ChatDotPopupLogic || {};
  const i18nApi = globalThis.ChatDotI18n || {};
  const DEFAULTS = popupLogic.DEFAULTS || {
    enabled: true,
    scrollMode: 'smooth',
    language: 'zh',
    showPreview: true,
    showOutline: true,
    themeMode: 'system',
    trimEnabled: false,
    trimKeepTurns: 10,
    trimAutoApply: false,
  };
  const getStoreReviewUrl = popupLogic.getStoreReviewUrl || (() => 'https://chromewebstore.google.com/');
  const getChangelogEntries = popupLogic.getChangelogEntries || (() => []);
  const resolveTrimSettingsChange = popupLogic.resolveTrimSettingsChange || ((current = {}, changes = {}) => {
    const next = {
      trimEnabled: Boolean(current.trimAutoApply),
      trimKeepTurns: current.trimKeepTurns,
      trimAutoApply: Boolean(current.trimAutoApply),
      ...changes,
    };

    next.trimAutoApply = Boolean(next.trimAutoApply);
    next.trimEnabled = next.trimAutoApply;

    return next;
  });
  const getTrimControlState = popupLogic.getTrimControlState || (stats => {
    const unavailable = !stats || stats.supported === false;
    const canRestore = Boolean(stats?.applied || stats?.hidden > 0);

    return {
      unavailable,
      keepDisabled: false,
      autoDisabled: unavailable,
      applyDisabled: unavailable,
      restoreDisabled: unavailable || !canRestore,
    };
  });
  const isTrimStatsUnavailable = popupLogic.isTrimStatsUnavailable || (stats => !stats || stats.supported === false);
  const GITHUB_REPO_URL = popupLogic.GITHUB_REPO_URL || 'https://github.com/Lcc1ccl/chatdot';

  // ============================================
  // DOM
  // ============================================
  const $ = (id) => document.getElementById(id);

  const toggleEnabled = $('toggle-enabled');
  const togglePreview = $('toggle-preview');
  const toggleOutline = $('toggle-outline');
  const trimGroupEl = $('trim-group');
  const trimKeepTurnsEl = $('trim-keep-turns');
  const trimAutoApplyEl = $('toggle-trim-auto');
  const scrollModeEl  = $('scroll-mode');
  const themeModeEl   = $('theme-mode');
  const btnLang       = $('btn-lang');
  const btnChangelog  = $('btn-changelog');
  const btnTrimApply  = $('btn-trim-apply');
  const btnTrimRestore = $('btn-trim-restore');
  const trimStatsEl   = $('trim-stats');
  const langPopup     = $('lang-popup');
  const statusEl      = $('status');
  const reviewLinkEl  = $('review-link');
  const githubLinkEl  = $('github-link');
  const modalEl       = $('changelog-modal');
  const modalCloseEl  = $('changelog-close');
  const changelogListEl = $('changelog-list');
  const changelogTitleEl = $('changelog-title');

  let currentLang = 'zh';
  let currentTranslations = {};
  let latestTrimStats = null;
  let currentSettings = { ...DEFAULTS };

  // 自动获取版本号
  const manifestData = chrome.runtime.getManifest();
  const versionNumEl = $('version-num');
  if (versionNumEl && manifestData) {
    versionNumEl.textContent = manifestData.version || '1.0.0';
  }

  // ============================================
  // 加载设置
  // ============================================
  chrome.storage.local.get(DEFAULTS, async (data) => {
    await applySettings(data);
  });

  async function applySettings(data) {
    const trimSettings = resolveTrimSettingsChange(currentSettings, {
      trimKeepTurns: normalizeTrimKeepTurns(data.trimKeepTurns),
      trimAutoApply: data.trimAutoApply,
    });

    currentSettings = {
      ...currentSettings,
      ...data,
      ...trimSettings,
    };

    toggleEnabled.checked = data.enabled;
    togglePreview.checked = data.showPreview;
    toggleOutline.checked = data.showOutline;
    trimKeepTurnsEl.value = ensureTrimKeepTurnsOption(currentSettings.trimKeepTurns);
    trimAutoApplyEl.checked = Boolean(currentSettings.trimAutoApply);
    currentLang = data.language || 'zh';

    scrollModeEl.querySelectorAll('.seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === data.scrollMode);
    });

    themeModeEl.querySelectorAll('.seg-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === (data.themeMode || 'system'));
    });

    await setActiveLanguage(currentLang);
    updateStatus(data.enabled);
    syncExternalLinks();
    renderChangelog();
    await refreshTrimStats();
  }

  async function resolveTranslations(lang) {
    if (typeof i18nApi.loadLocaleMessages === 'function') {
      try {
        return await i18nApi.loadLocaleMessages(lang);
      } catch (error) {
        console.warn('[ChatDot Popup]', 'failed to load locale catalog', error);
      }
    }

    if (typeof popupLogic.getTranslations === 'function') {
      return popupLogic.getTranslations(lang);
    }

    return {};
  }

  async function setActiveLanguage(lang) {
    currentLang = lang || 'zh';
    currentTranslations = await resolveTranslations(currentLang);
    document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : currentLang;
    updateLangUI(currentLang);
    applyI18n();
  }

  function translate(key) {
    return currentTranslations[key] || i18nApi.getBrowserMessage?.(key) || '';
  }

  function normalizeTrimKeepTurns(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return DEFAULTS.trimKeepTurns || 10;
    }

    return Math.min(100, Math.max(1, parsed));
  }

  function ensureTrimKeepTurnsOption(value) {
    const normalizedValue = String(normalizeTrimKeepTurns(value));
    if (trimKeepTurnsEl.querySelector(`option[value="${normalizedValue}"]`)) {
      return normalizedValue;
    }

    const option = document.createElement('option');
    option.value = normalizedValue;
    option.textContent = normalizedValue;
    trimKeepTurnsEl.appendChild(option);
    return normalizedValue;
  }

  // ============================================
  // 保存 & 通知 content script
  // ============================================
  function save(changes) {
    chrome.storage.local.set(changes);

    return sendActiveTabMessage({ type: 'settingsChanged', ...changes });
  }

  function getActiveTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0] || null);
      });
    });
  }

  async function sendActiveTabMessage(message) {
    const tab = await getActiveTab();
    if (!tab?.id) {
      return null;
    }

    try {
      return await chrome.tabs.sendMessage(tab.id, message);
    } catch (_) {
      return null;
    }
  }

  function formatTrimStats(stats) {
    if (isTrimStatsUnavailable(stats)) {
      return {
        split: false,
        primary: translate('trim_stats_unsupported'),
        hidden: '',
      };
    }

    if (!Number.isFinite(stats.total) || stats.total <= 0) {
      return {
        split: false,
        primary: translate('trim_stats_inactive'),
        hidden: '',
      };
    }

    const unit = translate('trim_turn_unit');
    return {
      split: true,
      primary: `${translate('trim_stats_total')} ${stats.total}${unit} / ${translate('trim_stats_kept')} ${stats.visible}${unit}`,
      hidden: `${translate('trim_stats_hidden')} ${stats.hidden}${unit}`,
    };
  }

  function updateTrimControls() {
    const state = getTrimControlState(latestTrimStats);
    trimKeepTurnsEl.disabled = state.keepDisabled;
    trimAutoApplyEl.disabled = state.autoDisabled;
    btnTrimApply.disabled = state.applyDisabled;
    btnTrimRestore.disabled = state.restoreDisabled;
    if (trimGroupEl) {
      trimGroupEl.classList.toggle('is-disabled', state.unavailable && state.keepDisabled);
    }
  }

  function renderTrimStats(stats) {
    latestTrimStats = stats;
    const formatted = formatTrimStats(stats);
    trimStatsEl.innerHTML = '';
    if (formatted.split) {
      trimStatsEl.classList.add('trim-stats-split');

      const primaryLine = document.createElement('span');
      primaryLine.className = 'trim-stats-line';
      primaryLine.textContent = formatted.primary;

      const hiddenLine = document.createElement('span');
      hiddenLine.className = 'trim-stats-line trim-stats-hidden';
      hiddenLine.textContent = formatted.hidden;

      trimStatsEl.appendChild(primaryLine);
      trimStatsEl.appendChild(hiddenLine);
    } else {
      trimStatsEl.classList.remove('trim-stats-split');
      trimStatsEl.textContent = formatted.primary;
    }
    updateTrimControls();
  }

  async function refreshTrimStats() {
    renderTrimStats(await sendActiveTabMessage({ type: 'trimGetStats' }));
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

  trimAutoApplyEl.addEventListener('change', async () => {
    const nextTrimSettings = resolveTrimSettingsChange(currentSettings, {
      trimAutoApply: trimAutoApplyEl.checked,
    });
    currentSettings = {
      ...currentSettings,
      ...nextTrimSettings,
    };
    trimAutoApplyEl.checked = Boolean(nextTrimSettings.trimAutoApply);
    await save(nextTrimSettings);
    await refreshTrimStats();
  });

  trimKeepTurnsEl.addEventListener('change', async () => {
    const trimKeepTurns = normalizeTrimKeepTurns(trimKeepTurnsEl.value);
    const nextTrimSettings = resolveTrimSettingsChange(currentSettings, { trimKeepTurns });
    currentSettings = {
      ...currentSettings,
      ...nextTrimSettings,
    };
    trimKeepTurnsEl.value = ensureTrimKeepTurnsOption(nextTrimSettings.trimKeepTurns);
    await save(nextTrimSettings);
    await refreshTrimStats();
  });

  btnTrimApply.addEventListener('click', async () => {
    const trimKeepTurns = normalizeTrimKeepTurns(trimKeepTurnsEl.value);
    const nextTrimSettings = resolveTrimSettingsChange(currentSettings, { trimKeepTurns });
    currentSettings = {
      ...currentSettings,
      ...nextTrimSettings,
    };
    trimKeepTurnsEl.value = ensureTrimKeepTurnsOption(nextTrimSettings.trimKeepTurns);
    await save(nextTrimSettings);
    renderTrimStats(await sendActiveTabMessage({ type: 'trimApply' }));
  });

  btnTrimRestore.addEventListener('click', async () => {
    renderTrimStats(await sendActiveTabMessage({ type: 'trimRestore' }));
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
  // 事件：显示模式
  // ============================================
  themeModeEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    themeModeEl.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    save({ themeMode: btn.dataset.value });
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

  btnChangelog.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleChangelog(true);
  });

  // 点击语言选项
  langPopup.addEventListener('click', async (e) => {
    e.stopPropagation();
    const opt = e.target.closest('.lang-option');
    if (!opt) return;
    const lang = opt.dataset.lang;
    save({ language: lang });
    await setActiveLanguage(lang);
    renderChangelog();
    langPopup.classList.remove('show');
    btnLang.classList.remove('active');
  });

  modalCloseEl.addEventListener('click', () => {
    toggleChangelog(false);
  });

  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) {
      toggleChangelog(false);
    }
  });

  // 点击外部关闭
  document.addEventListener('click', () => {
    langPopup.classList.remove('show');
    btnLang.classList.remove('active');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      toggleChangelog(false);
    }
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

  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const value = translate(key);
      if (value) el.textContent = value;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.dataset.i18nTitle;
      const value = translate(key);
      if (value) el.title = value;
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
      const key = el.dataset.i18nAriaLabel;
      const value = translate(key);
      if (value) el.setAttribute('aria-label', value);
    });
    scrollModeEl.querySelectorAll('.seg-btn').forEach(btn => {
      const key = btn.dataset.i18n;
      const value = translate(key);
      if (value) btn.textContent = value;
    });
    themeModeEl.querySelectorAll('.seg-btn').forEach(btn => {
      const key = btn.dataset.i18n;
      const value = translate(key);
      if (value) btn.textContent = value;
    });
    renderTrimStats(latestTrimStats);
  }

  function updateStatus(enabled) {
    if (enabled) {
      statusEl.innerHTML = `<span data-i18n="status_active">${translate('status_active')}</span>`;
      statusEl.className = 'status-bar active';
    } else {
      statusEl.innerHTML = `<span data-i18n="status_inactive">${translate('status_inactive')}</span>`;
      statusEl.className = 'status-bar inactive';
    }
  }

  function syncExternalLinks() {
    reviewLinkEl.href = getStoreReviewUrl();
    githubLinkEl.href = GITHUB_REPO_URL;
  }

  function renderChangelog() {
    const entries = getChangelogEntries(currentLang);

    changelogTitleEl.textContent = translate('changelog_title');
    changelogListEl.innerHTML = '';

    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'changelog-empty';
      empty.textContent = translate('changelog_empty');
      changelogListEl.appendChild(empty);
      return;
    }

    entries.forEach((entry) => {
      const section = document.createElement('section');
      section.className = 'changelog-entry';

      const header = document.createElement('div');
      header.className = 'changelog-entry-header';

      const version = document.createElement('span');
      version.className = 'changelog-entry-version';
      version.textContent = entry.version;

      const date = document.createElement('span');
      date.className = 'changelog-entry-date';
      date.textContent = entry.date;

      header.appendChild(version);
      header.appendChild(date);

      const list = document.createElement('ul');
      list.className = 'changelog-entry-list';
      entry.items.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
      });

      section.appendChild(header);
      section.appendChild(list);
      changelogListEl.appendChild(section);
    });
  }

  function toggleChangelog(open) {
    modalEl.classList.toggle('show', open);
    document.body.classList.toggle('modal-open', open);
  }

})();
