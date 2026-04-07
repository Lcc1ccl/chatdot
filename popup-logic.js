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

  const I18N = {
    zh: {
      enable_nav: '启用导航栏',
      show_preview: '悬浮预览',
      show_preview_desc: '导航按钮悬停显示消息内容',
      show_outline: '消息大纲',
      show_outline_desc: '侧边栏显示对话索引',
      display_mode: '显示模式',
      display_mode_desc: '控制导航栏的配色主题',
      theme_light: '浅色',
      theme_dark: '深色',
      theme_system: '跟随系统',
      scroll_mode: '滚动模式',
      smooth: '平滑',
      instant: '瞬移',
      status_active: '导航已启用',
      status_inactive: '导航已停用',
      version: '版本',
      review_support: '好评支持',
      review_support_desc: '前往 Chrome 商店评分，帮助更多用户发现 ChatDot',
      github_repo: 'GitHub 仓库',
      changelog_title: '更新日志',
      changelog_empty: '暂无更新记录。',
      changelog_open: '查看更新日志',
      changelog_close: '关闭',
    },
    en: {
      enable_nav: 'Enable Navigation',
      show_preview: 'Hover Preview',
      show_preview_desc: 'Show message preview on hover',
      show_outline: 'Message Outline',
      show_outline_desc: 'Show conversation index',
      display_mode: 'Display Mode',
      display_mode_desc: 'Control sidebar color theme',
      theme_light: 'Light',
      theme_dark: 'Dark',
      theme_system: 'System',
      scroll_mode: 'Scroll Mode',
      smooth: 'Smooth',
      instant: 'Instant',
      status_active: 'Navigation enabled',
      status_inactive: 'Navigation disabled',
      version: 'Version',
      review_support: 'Leave a Review',
      review_support_desc: 'Open the Chrome Web Store review page to support ChatDot',
      github_repo: 'GitHub repository',
      changelog_title: 'Changelog',
      changelog_empty: 'No updates yet.',
      changelog_open: 'View changelog',
      changelog_close: 'Close',
    },
    ja: {
      enable_nav: 'ナビを有効化',
      show_preview: 'ホバープレビュー',
      show_preview_desc: 'ホバーでメッセージを表示',
      show_outline: 'アウトライン',
      show_outline_desc: '会話インデックスを表示',
      display_mode: '表示モード',
      display_mode_desc: 'サイドバーの配色テーマ',
      theme_light: 'ライト',
      theme_dark: 'ダーク',
      theme_system: 'システム',
      scroll_mode: 'スクロール',
      smooth: 'スムーズ',
      instant: 'ジャンプ',
      status_active: 'ナビ有効',
      status_inactive: 'ナビ無効',
      version: 'バージョン',
      review_support: 'レビューで応援',
      review_support_desc: 'Chrome ウェブストアのレビュー画面を開きます',
      github_repo: 'GitHub リポジトリ',
      changelog_title: '更新履歴',
      changelog_empty: '更新履歴はまだありません。',
      changelog_open: '更新履歴を見る',
      changelog_close: '閉じる',
    },
    ko: {
      enable_nav: '네비 활성화',
      show_preview: '호버 미리보기',
      show_preview_desc: '호버 시 메시지 표시',
      show_outline: '개요',
      show_outline_desc: '대화 색인 표시',
      display_mode: '표시 모드',
      display_mode_desc: '사이드바 색상 테마',
      theme_light: '라이트',
      theme_dark: '다크',
      theme_system: '시스템',
      scroll_mode: '스크롤 모드',
      smooth: '부드럽게',
      instant: '점프',
      status_active: '네비 활성',
      status_inactive: '네비 비활성',
      version: '버전',
      review_support: '리뷰로 응원하기',
      review_support_desc: 'Chrome 웹 스토어 리뷰 페이지를 엽니다',
      github_repo: 'GitHub 저장소',
      changelog_title: '업데이트 로그',
      changelog_empty: '업데이트 내역이 없습니다.',
      changelog_open: '업데이트 로그 보기',
      changelog_close: '닫기',
    },
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
    return I18N[lang] || I18N.zh;
  }

  function getStoreReviewUrl() {
    return `${CHROME_WEBSTORE_ITEM_URL}/reviews`;
  }

  function getChangelogEntries(lang) {
    return CHANGELOG[lang] || CHANGELOG.en;
  }

  return {
    DEFAULTS,
    I18N,
    CHANGELOG,
    GITHUB_REPO_URL,
    CHROME_WEBSTORE_EXTENSION_ID,
    CHROME_WEBSTORE_ITEM_URL,
    getTranslations,
    getStoreReviewUrl,
    getChangelogEntries,
  };
});
