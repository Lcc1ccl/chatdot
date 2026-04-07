(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.ChatDotI18n = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_LANGUAGE = 'zh';
  const LANGUAGE_TO_LOCALE = {
    zh: 'zh_CN',
    en: 'en',
    ja: 'ja',
    ko: 'ko',
  };
  const localeCache = {};
  const EMBEDDED_LOCALE_MESSAGES = {
    zh: {
      extName: 'ChatDot - AI 对话导航',
      extDescription: '为 ChatGPT、Gemini、Claude 和豆包添加右侧导航栏与消息大纲，快速定位历史提问并预览上下文。',
      extActionTitle: '打开 ChatDot 设置',
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
      language_button: '切换语言',
      outline_title: '大纲',
      outline_pin: '固定大纲',
      outline_close: '关闭大纲',
      jump_top: '跳到顶部',
      jump_prev_user: '上一条用户消息',
      jump_next_user: '下一条用户消息',
      jump_bottom: '跳到底部',
      outline_empty: '暂无用户消息',
      preview_prev: '↑ 上一条',
      preview_next: '↓ 下一条',
      preview_at_top: '已在最顶部',
      preview_at_bottom: '已在最底部',
    },
    en: {
      extName: 'ChatDot - AI Chat Navigator',
      extDescription: 'Add a right-side navigator and message outline to ChatGPT, Gemini, Claude, and Doubao for faster jumps and context previews.',
      extActionTitle: 'Open ChatDot settings',
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
      language_button: 'Switch language',
      outline_title: 'Outline',
      outline_pin: 'Pin outline',
      outline_close: 'Close outline',
      jump_top: 'Jump to top',
      jump_prev_user: 'Previous user message',
      jump_next_user: 'Next user message',
      jump_bottom: 'Jump to bottom',
      outline_empty: 'No user messages yet',
      preview_prev: '↑ Previous',
      preview_next: '↓ Next',
      preview_at_top: 'Already at the top',
      preview_at_bottom: 'Already at the bottom',
    },
    ja: {
      extName: 'ChatDot - AI チャットナビ',
      extDescription: 'ChatGPT、Gemini、Claude、豆包に右側ナビゲーターとメッセージ一覧を追加し、履歴移動と文脈確認を高速化します。',
      extActionTitle: 'ChatDot の設定を開く',
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
      language_button: '言語を切り替え',
      outline_title: 'アウトライン',
      outline_pin: 'アウトラインを固定',
      outline_close: 'アウトラインを閉じる',
      jump_top: '先頭へ移動',
      jump_prev_user: '前のユーザーメッセージ',
      jump_next_user: '次のユーザーメッセージ',
      jump_bottom: '末尾へ移動',
      outline_empty: 'ユーザーメッセージはまだありません',
      preview_prev: '↑ 前へ',
      preview_next: '↓ 次へ',
      preview_at_top: 'すでに先頭です',
      preview_at_bottom: 'すでに末尾です',
    },
    ko: {
      extName: 'ChatDot - AI 채팅 내비게이터',
      extDescription: 'ChatGPT, Gemini, Claude, 두바오에 우측 내비게이터와 메시지 개요를 추가해 빠른 이동과 문맥 미리보기를 제공합니다.',
      extActionTitle: 'ChatDot 설정 열기',
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
      language_button: '언어 전환',
      outline_title: '개요',
      outline_pin: '개요 고정',
      outline_close: '개요 닫기',
      jump_top: '맨 위로 이동',
      jump_prev_user: '이전 사용자 메시지',
      jump_next_user: '다음 사용자 메시지',
      jump_bottom: '맨 아래로 이동',
      outline_empty: '사용자 메시지가 아직 없습니다',
      preview_prev: '↑ 이전',
      preview_next: '↓ 다음',
      preview_at_top: '이미 맨 위입니다',
      preview_at_bottom: '이미 맨 아래입니다',
    },
  };

  function normalizeLanguage(lang) {
    return LANGUAGE_TO_LOCALE[lang] ? lang : DEFAULT_LANGUAGE;
  }

  function getLocaleDirectory(lang) {
    return LANGUAGE_TO_LOCALE[normalizeLanguage(lang)];
  }

  function flattenLocaleMessages(messages) {
    return Object.entries(messages || {}).reduce((acc, [key, value]) => {
      if (value && typeof value.message === 'string') {
        acc[key] = value.message;
      }
      return acc;
    }, {});
  }

  async function loadLocaleMessages(lang) {
    const normalized = normalizeLanguage(lang);
    if (localeCache[normalized]) {
      return localeCache[normalized];
    }

    if (EMBEDDED_LOCALE_MESSAGES[normalized]) {
      localeCache[normalized] = { ...EMBEDDED_LOCALE_MESSAGES[normalized] };
      return localeCache[normalized];
    }

    if (typeof fetch !== 'function' || !globalThis.chrome?.runtime?.getURL) {
      localeCache[normalized] = {};
      return localeCache[normalized];
    }

    const localeDir = getLocaleDirectory(normalized);
    const resourceUrl = chrome.runtime.getURL(`_locales/${localeDir}/messages.json`);
    const response = await fetch(resourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to load locale catalog: ${localeDir}`);
    }

    const catalog = flattenLocaleMessages(await response.json());
    localeCache[normalized] = catalog;
    return catalog;
  }

  function readLocaleMessages(lang, baseDir) {
    if (typeof require !== 'function') {
      return {};
    }

    const fs = require('node:fs');
    const path = require('node:path');
    const localeDir = getLocaleDirectory(lang);
    const rootDir = baseDir || __dirname;
    const filePath = path.join(rootDir, '_locales', localeDir, 'messages.json');
    return flattenLocaleMessages(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  }

  function getCachedMessages(lang) {
    return localeCache[normalizeLanguage(lang)] || null;
  }

  function getEmbeddedMessages(lang) {
    const normalized = normalizeLanguage(lang);
    if (!EMBEDDED_LOCALE_MESSAGES[normalized]) {
      return {};
    }

    return { ...EMBEDDED_LOCALE_MESSAGES[normalized] };
  }

  function getBrowserMessage(key, substitutions) {
    if (!globalThis.chrome?.i18n?.getMessage) {
      return '';
    }

    return chrome.i18n.getMessage(key, substitutions) || '';
  }

  function applyLocalizedControlLabel(control, label) {
    if (!control || typeof label !== 'string') {
      return;
    }

    control.title = label;

    if (typeof control.setAttribute === 'function') {
      control.setAttribute('aria-label', label);
    }

    if (control.dataset && Object.prototype.hasOwnProperty.call(control.dataset, 'originalTitle')) {
      control.dataset.originalTitle = label;
    }
  }

  return {
    DEFAULT_LANGUAGE,
    LANGUAGE_TO_LOCALE,
    applyLocalizedControlLabel,
    normalizeLanguage,
    getLocaleDirectory,
    flattenLocaleMessages,
    loadLocaleMessages,
    readLocaleMessages,
    getCachedMessages,
    getEmbeddedMessages,
    getBrowserMessage,
  };
});
