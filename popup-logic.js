(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.ChatDotPopupLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const GITHUB_REPO_URL = 'https://github.com/Lcc1ccl/chatdot';
  const CHROME_WEBSTORE_EXTENSION_ID = 'hggdbhpanmlbbomkcjijfjmpbobpabme';
  const CHROME_WEBSTORE_ITEM_URL = `https://chromewebstore.google.com/detail/chatdot/${CHROME_WEBSTORE_EXTENSION_ID}`;

  const DEFAULTS = {
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

  const CHANGELOG = {
    zh: [
      {
        version: 'v1.2.0',
        date: '2026-04-08',
        items: [
          'ChatGPT 长对话现在支持一键精简，只保留最近 N 轮，浏览更顺畅。',
          '新增自动精简、手动精简和恢复显示，保留需要的上下文，同时减少页面负担。',
          '大纲、计数和上下跳转会自动跟随当前可见内容，定位更直观。',
        ],
      },
      {
        version: 'v1.1.0',
        date: '2026-04-07',
        items: [
          'ChatDot 现已支持 Gemini、Claude 和豆包，常用 AI 对话平台可以统一导航。',
          '新增浅色、深色和跟随系统主题，侧栏在不同页面里更协调。',
          '弹窗设置更清晰，并加入版本内更新日志入口。',
        ],
      },
      {
        version: 'v1.0.1',
        date: '2026-04-02',
        items: [
          '导航定位和高亮反馈更稳定，快速跳转时更容易确认当前位置。',
          '会话切换和语言设置的同步更稳，减少重新初始化时的闪动与错位。',
        ],
      },
      {
        version: 'v1.0.0',
        date: '2026-03-30',
        items: [
          'ChatDot 首次发布，为 AI 对话页带来右侧快捷导航。',
          '支持顶部、底部、上一条、下一条跳转，以及悬浮预览和消息大纲。',
        ],
      },
    ],
    en: [
      {
        version: 'v1.2.0',
        date: '2026-04-08',
        items: [
          'ChatGPT conversations can now be trimmed down to the latest N turns for a smoother long-chat experience.',
          'Added Auto Trim, Manual Trim, and Restore so you can reduce page weight without losing the context you need.',
          'Outline, counters, and previous or next navigation now stay aligned with whatever is currently visible.',
        ],
      },
      {
        version: 'v1.1.0',
        date: '2026-04-07',
        items: [
          'ChatDot now supports Gemini, Claude, and Doubao, bringing the same navigation workflow to more AI chat platforms.',
          'Added Light, Dark, and System theme modes so the sidebar feels more at home on different sites.',
          'The popup was reorganized for clearer settings, with an in-popup changelog entry for release updates.',
        ],
      },
      {
        version: 'v1.0.1',
        date: '2026-04-02',
        items: [
          'Scroll targeting and active highlight feedback were tightened up to make jumps easier to follow.',
          'Language settings and SPA reinitialization became more stable during conversation switches.',
        ],
      },
      {
        version: 'v1.0.0',
        date: '2026-03-30',
        items: [
          'First public release of ChatDot, adding a compact right-side navigator to AI chat pages.',
          'Included top, bottom, previous, next navigation, hover previews, and a message outline.',
        ],
      },
    ],
  };

  function getTranslations(lang) {
    const i18nApi = (typeof globalThis !== 'undefined' ? globalThis.ChatDotI18n : null)
      || (typeof require === 'function' ? require('./localization.js') : null);

    if (!i18nApi || typeof i18nApi.readLocaleMessages !== 'function') {
      return {};
    }

    return i18nApi.readLocaleMessages(lang, typeof __dirname === 'string' ? __dirname : undefined);
  }

  function getStoreReviewUrl() {
    return `${CHROME_WEBSTORE_ITEM_URL}/reviews`;
  }

  function getChangelogEntries(lang) {
    return CHANGELOG[lang] || CHANGELOG.en;
  }

  function isTrimStatsUnavailable(stats) {
    return !stats || stats.supported === false;
  }

  function resolveTrimSettingsChange(current = {}, changes = {}) {
    const next = {
      trimEnabled: Boolean(current.trimAutoApply),
      trimKeepTurns: current.trimKeepTurns,
      trimAutoApply: Boolean(current.trimAutoApply),
      ...changes,
    };

    next.trimAutoApply = Boolean(next.trimAutoApply);
    next.trimEnabled = next.trimAutoApply;

    return next;
  }

  function getTrimControlState(stats) {
    const unavailable = isTrimStatsUnavailable(stats);
    const canRestore = Boolean(stats?.applied || stats?.hidden > 0);

    return {
      unavailable,
      keepDisabled: false,
      autoDisabled: unavailable,
      applyDisabled: unavailable,
      restoreDisabled: unavailable || !canRestore,
    };
  }

  return {
    DEFAULTS,
    CHANGELOG,
    GITHUB_REPO_URL,
    CHROME_WEBSTORE_EXTENSION_ID,
    CHROME_WEBSTORE_ITEM_URL,
    getTranslations,
    getStoreReviewUrl,
    getChangelogEntries,
    getTrimControlState,
    resolveTrimSettingsChange,
    isTrimStatsUnavailable,
  };
});
