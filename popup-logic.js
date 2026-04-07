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
  };

  const CHANGELOG = {
    zh: [
      {
        version: 'v1.1.0',
        date: '2026-04-07',
        items: [
          '新增 Gemini / Claude / 豆包平台支持，更多平台逐步接入中',
          '新增浅色 / 深色 / 跟随系统主题模式',
          '优化 Popup 结构，补充版本内更新日志入口',
        ],
      },
      {
        version: 'v1.0.1',
        date: '2026-04-02',
        items: [
          '优化导航滚动定位与高亮反馈',
          '增强多语言设置与会话切换时的重初始化稳定性',
        ],
      },
      {
        version: 'v1.0.0',
        date: '2026-03-30',
        items: [
          '首次发布 ChatDot',
          '提供顶部 / 底部 / 上一条 / 下一条导航与悬浮预览',
        ],
      },
    ],
    en: [
      {
        version: 'v1.1.0',
        date: '2026-04-07',
        items: [
          'Added support for Gemini, Claude, and Doubao, with more platforms being added over time.',
          'Added Light, Dark, and System theme modes.',
          'Refined the popup layout and added an in-popup changelog entry.',
        ],
      },
      {
        version: 'v1.0.1',
        date: '2026-04-02',
        items: [
          'Improved navigation scroll targeting and highlight feedback.',
          'Stabilized language settings and SPA reinitialization behavior.',
        ],
      },
      {
        version: 'v1.0.0',
        date: '2026-03-30',
        items: [
          'Initial ChatDot release.',
          'Included top, bottom, previous, next navigation and hover previews.',
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

  return {
    DEFAULTS,
    CHANGELOG,
    GITHUB_REPO_URL,
    CHROME_WEBSTORE_EXTENSION_ID,
    CHROME_WEBSTORE_ITEM_URL,
    getTranslations,
    getStoreReviewUrl,
    getChangelogEntries,
  };
});
