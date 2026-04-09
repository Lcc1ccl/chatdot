/**
 * ChatDot content script
 * - Bind to the active ChatGPT conversation scroll container
 * - Cache user message anchors and derive active index from scroll state
 * - Keep counter / outline / jump actions in sync during SPA navigation
 */

(function () {
  'use strict';

  const LOG_PREFIX = '[ChatDot Nav]';
  const NAV_LOGIC = globalThis.ChatDotNavLogic;
  const I18N = globalThis.ChatDotI18n;

  if (!NAV_LOGIC) {
    console.warn(LOG_PREFIX, 'navigation logic is missing');
    return;
  }

  const {
    DEFAULT_SAFE_OFFSET,
    DEFAULT_BOTTOM_EPSILON,
    pickBestBindingCandidate,
    resolveActiveIndex,
    resolveAdjacentIndex,
    resolveTrimWindow,
    resolveTrimSignature,
    shouldApplyTrim,
    resolveScrollStrategy,
    resolveScrollTarget,
    resolveVisualActiveIndex,
    requiresPostScrollSync,
  } = NAV_LOGIC;

  const SETTINGS = {
    enabled: true,
    scrollMode: 'smooth',
    showPreview: true,
    showOutline: true,
    language: 'zh',
    themeMode: 'system',
    trimEnabled: false,
    trimKeepTurns: 10,
    trimAutoApply: false,
  };
  let messages = {};
  const TRIMMED_CLASS = 'chatdot-trimmed';
  const CHATGPT_TURN_SELECTORS = [
    'article[data-testid^="conversation-turn-"]',
    'article',
  ];

  const PLATFORM_SELECTORS = {
    chatgpt: {
      scrollContainer: [
        'div[class*="group/scroll-root"]',
        'main div[class*="overflow-y-auto"]',
        'main div[class*="react-scroll-to-bottom"]',
      ],
      userMessage: [
        'article[data-testid^="conversation-turn-"][data-message-author-role="user"]',
        '[data-message-author-role="user"]',
        'div[data-message-author-role="user"]',
      ],
      textExtract: ['.whitespace-pre-wrap', '[data-message-content]', 'div > div'],
    },
    gemini: {
      scrollContainer: [
        'infinite-scroller.chat-history',
        'infinite-scroller[scrollable]',
        '.chat-history',
      ],
      userMessage: [
        '.user-query-container',
        'div[class*="query-container"]',
      ],
      textExtract: ['.query-text', 'div[class*="query-text"]', 'p'],
    },
    claude: {
      scrollContainer: [
        'div[class*="flex-1"][class*="overflow-y"]',
        'main div[class*="overflow-y-auto"]',
        'div[class*="conversation-content"]',
      ],
      userMessage: [
        '[data-testid="user-message"]',
        '.font-user-message',
        'div[class*="user-message"]',
        'div[data-is-user="true"]',
      ],
      textExtract: ['p', 'div[class*="whitespace"]', 'span'],
    },
    doubao: {
      scrollContainer: [
        '[data-testid="message-list"]',
        'div[class*="message-list"]',
      ],
      userMessage: [
        '[data-testid="send_message"]',
        'div[class*="send_message"]',
      ],
      textExtract: ['[data-testid="message_text_content"]', 'div[class*="text_content"]', 'span'],
    },
  };

  function detectPlatform() {
    const host = location.hostname;
    if (host.includes('chatgpt.com') || host.includes('chat.openai.com')) return 'chatgpt';
    if (host.includes('gemini.google.com')) return 'gemini';
    if (host.includes('claude.ai')) return 'claude';
    if (host.includes('doubao.com')) return 'doubao';
    return 'chatgpt';
  }

  const currentPlatform = detectPlatform();
  const CURRENT_SELECTORS = PLATFORM_SELECTORS[currentPlatform] || PLATFORM_SELECTORS.chatgpt;
  const scrollStrategy = resolveScrollStrategy(currentPlatform);

  function t(key, fallback = '') {
    if (messages[key]) {
      return messages[key];
    }

    const browserMessage = I18N?.getBrowserMessage?.(key);
    if (browserMessage) {
      return browserMessage;
    }

    return fallback || key;
  }

  async function syncMessages(lang) {
    if (!I18N?.loadLocaleMessages) {
      messages = {};
      return;
    }

    try {
      messages = await I18N.loadLocaleMessages(lang);
    } catch (error) {
      console.warn(LOG_PREFIX, 'failed to load locale catalog', error);
      messages = await I18N.loadLocaleMessages('zh').catch(() => ({}));
    }
  }

  function applyControlLabel(control, label) {
    if (!control) {
      return;
    }

    if (typeof I18N?.applyLocalizedControlLabel === 'function') {
      I18N.applyLocalizedControlLabel(control, label);
      return;
    }

    control.title = label;
    control.setAttribute('aria-label', label);
    if (control.dataset && Object.prototype.hasOwnProperty.call(control.dataset, 'originalTitle')) {
      control.dataset.originalTitle = label;
    }
  }

  function applyThemeMode(mode) {
    if (!mode || mode === 'system') {
      document.documentElement.removeAttribute('data-chatdot-theme');
    } else {
      document.documentElement.setAttribute('data-chatdot-theme', mode);
    }
  }

  const ICONS = {
    chevronsUp: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>',
    chevronUp: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
    chevronDown: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    chevronsDown: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>',
    list: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    pin: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66z"></path><line x1="9" y1="9" x2="2" y2="2"></line></svg>',
  };

  function loadSettings(callback) {
    if (chrome?.storage?.local) {
      chrome.storage.local.get(SETTINGS, async (data) => {
        Object.assign(SETTINGS, data);
        SETTINGS.trimEnabled = Boolean(SETTINGS.trimAutoApply);
        applyThemeMode(SETTINGS.themeMode);
        await syncMessages(SETTINGS.language);
        if (callback) callback();
      });
      return;
    }

    syncMessages(SETTINGS.language).finally(() => {
      if (callback) callback();
    });
  }

  function queryAll(selectors, root = document) {
    for (const selector of selectors) {
      try {
        const nodes = root.querySelectorAll(selector);
        if (nodes.length > 0) {
          return Array.from(nodes);
        }
      } catch (_) {}
    }
    return [];
  }

  function isScrollableElement(el) {
    if (!el || !(el instanceof HTMLElement)) {
      return false;
    }

    const style = getComputedStyle(el);
    const overflowY = style.overflowY;
    return (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 40;
  }

  function findScrollableAncestor(el) {
    let current = el;
    while (current && current !== document.body) {
      if (isScrollableElement(current)) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  function findScrollContainerFallback() {
    for (const selector of CURRENT_SELECTORS.scrollContainer) {
      try {
        const el = document.querySelector(selector);
        if (isScrollableElement(el)) {
          return el;
        }
      } catch (_) {}
    }

    const main = document.querySelector('main');
    if (!main) {
      return null;
    }

    const divs = main.querySelectorAll('div');
    for (const el of divs) {
      if (isScrollableElement(el)) {
        return el;
      }
    }

    return null;
  }

  function findUserMessages(root = document, options = {}) {
    const nodes = queryAll(CURRENT_SELECTORS.userMessage, root);
    if (options.includeTrimmed) {
      return nodes;
    }

    return nodes.filter((node) => !node.closest(`.${TRIMMED_CLASS}`));
  }

  function extractMessageText(msgEl, maxLen = 80) {
    let textEl = null;
    const extractSelectors = CURRENT_SELECTORS.textExtract || ['.whitespace-pre-wrap', '[data-message-content]', 'div > div'];
    for (const sel of extractSelectors) {
      textEl = msgEl.querySelector(sel);
      if (textEl) break;
    }
    const raw = (textEl || msgEl).textContent || '';
    const text = raw.replace(/\s+/g, ' ').trim();
    return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
  }

  function getConversationTurnElement(messageEl) {
    if (!(messageEl instanceof Element) || currentPlatform !== 'chatgpt') {
      return messageEl;
    }

    for (const selector of CHATGPT_TURN_SELECTORS) {
      const turnEl = messageEl.closest(selector);
      if (turnEl) {
        return turnEl;
      }
    }

    return messageEl;
  }

  function findConversationTurns(root = document) {
    if (currentPlatform !== 'chatgpt') {
      return [];
    }

    return queryAll(CHATGPT_TURN_SELECTORS, root);
  }

  function isPluginElement(node) {
    if (!(node instanceof HTMLElement)) {
      return false;
    }

    return typeof node.className === 'string' && node.className.includes('chatdot-');
  }

  function nodeMatchesAnySelector(node, selectors) {
    if (!(node instanceof Element)) {
      return false;
    }

    for (const selector of selectors) {
      try {
        if (node.matches(selector) || node.querySelector(selector)) {
          return true;
        }
      } catch (_) {}
    }

    return false;
  }

  function getViewportVisibleArea(el) {
    const rect = el.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
    const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));

    return {
      rect,
      visibleArea: visibleWidth * visibleHeight,
      rectArea: Math.max(0, rect.width * rect.height),
    };
  }

  function buildBindingCandidate(container, messages) {
    const style = getComputedStyle(container);
    const { rect, visibleArea, rectArea } = getViewportVisibleArea(container);
    const visibleRatio = rectArea > 0 ? visibleArea / rectArea : 0;
    const isVisible = container.isConnected
      && style.display !== 'none'
      && style.visibility !== 'hidden'
      && rect.width > 0
      && rect.height > 0
      && visibleArea > 0;

    return {
      container,
      messages,
      isConnected: container.isConnected,
      isVisible,
      isInViewport: isVisible && (visibleRatio >= 0.2 || visibleArea >= 20000),
      visibleArea,
      messageCount: messages.length,
      scrollDistance: Math.max(0, container.scrollHeight - container.clientHeight),
    };
  }

  function findConversationBinding() {
    const messages = findUserMessages();
    const containerMap = new Map();

    for (const message of messages) {
      const container = findScrollableAncestor(message);
      if (!container) {
        continue;
      }

      if (!containerMap.has(container)) {
        containerMap.set(container, []);
      }
      containerMap.get(container).push(message);
    }

    const candidates = [];
    for (const [container, scopedMessages] of containerMap.entries()) {
      candidates.push(buildBindingCandidate(container, scopedMessages));
    }

    const bestCandidate = pickBestBindingCandidate(candidates);
    const scrollContainer = bestCandidate?.container || findScrollContainerFallback();
    const scopedMessages = bestCandidate?.messages
      || (scrollContainer ? findUserMessages(scrollContainer) : messages);

    return { scrollContainer, messages: scopedMessages };
  }

  function installHistoryHooks() {
    if (window.__chatdotHistoryHooksInstalled) {
      return;
    }

    const emitRouteChange = () => {
      window.dispatchEvent(new Event('chatdot:routechange'));
    };

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      setTimeout(emitRouteChange, 0);
      return result;
    };

    history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      setTimeout(emitRouteChange, 0);
      return result;
    };

    window.__chatdotHistoryHooksInstalled = true;
  }

  class NavigationSidebar {
    constructor() {
      this.container = null;
      this.counterEl = null;
      this.prevPreview = null;
      this.nextPreview = null;
      this.outlinePanel = null;
      this.outlineList = null;
      this.outlineToggleBtn = null;
      this.outlineOpen = false;
      this.outlineItems = [];
      this.isPinned = false;
      this.navButtons = {};
      this.outlineTitleEl = null;
      this.outlinePinBtn = null;
      this.outlineCloseBtn = null;

      this.scrollContainer = null;
      this.scrollHandler = null;
      this.docClickHandler = null;
      this.routeHandler = null;
      this.resizeHandler = null;
      this.bodyObserver = null;
      this.containerObserver = null;

      this.syncTimer = null;
      this.retryTimer = null;
      this.pendingForceRebind = false;
      this.scrollTicking = false;
      this.localRefreshScheduled = false;
      this.retryCount = 0;
      this.maxRetries = 24;
      this.initialized = false;

      this.snapshot = [];
      this.activeIndex = -1;
      this.safeOffset = DEFAULT_SAFE_OFFSET;
      this.bottomEpsilon = DEFAULT_BOTTOM_EPSILON;
      this.scrollStrategy = scrollStrategy;
      this.lastUrl = location.href;
      this.boundUrl = '';
      this.trimStats = {
        supported: currentPlatform === 'chatgpt',
        enabled: SETTINGS.trimEnabled,
        keep: Math.max(1, Number.parseInt(SETTINGS.trimKeepTurns, 10) || 10),
        total: 0,
        visible: 0,
        hidden: 0,
        applied: false,
      };
      this.manualTrimApplied = false;
      this.trimSuppressed = false;
      this.trimAppliedSignature = resolveTrimSignature(SETTINGS);
    }

    init() {
      if (!SETTINGS.enabled) {
        return;
      }

      if (this.initialized) {
        this.scheduleConversationSync(true, 0);
        return;
      }

      this.createUI();
      this.bindGlobalEvents();
      this.observeDocument();
      this.initialized = true;
      this.scheduleConversationSync(true, 0);
    }

    createUI() {
      const existingSidebar = document.querySelector('.chatdot-nav-sidebar');
      if (existingSidebar) {
        existingSidebar.remove();
      }

      const existingOutline = document.querySelector('.chatdot-outline-panel');
      if (existingOutline) {
        existingOutline.remove();
      }

      this.container = document.createElement('div');
      this.container.className = 'chatdot-nav-sidebar';

      const outlineBtn = document.createElement('button');
      outlineBtn.className = 'chatdot-nav-btn chatdot-nav-btn-outline';
      outlineBtn.innerHTML = ICONS.list;
      applyControlLabel(outlineBtn, t('outline_title', '大纲'));
      outlineBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.toggleOutline();
      });
      this.outlineToggleBtn = outlineBtn;
      if (!SETTINGS.showOutline) {
        outlineBtn.style.display = 'none';
      }
      this.container.appendChild(outlineBtn);

      const buttons = [
        { cls: 'chatdot-nav-btn-top', icon: ICONS.chevronsUp, labelKey: 'jump_top', fallback: '跳到顶部', action: () => this.scrollToTop(), preview: false },
        { cls: 'chatdot-nav-btn-prev', icon: ICONS.chevronUp, labelKey: 'jump_prev_user', fallback: '上一条用户消息', action: () => this.scrollToMessage('prev'), preview: 'prev' },
        { cls: 'chatdot-nav-btn-next', icon: ICONS.chevronDown, labelKey: 'jump_next_user', fallback: '下一条用户消息', action: () => this.scrollToMessage('next'), preview: 'next' },
        { cls: 'chatdot-nav-btn-bottom', icon: ICONS.chevronsDown, labelKey: 'jump_bottom', fallback: '跳到底部', action: () => this.scrollToBottom(), preview: false },
      ];

      buttons.forEach(({ cls, icon, labelKey, fallback, action, preview }, index) => {
        const button = document.createElement('button');
        button.className = `chatdot-nav-btn ${cls}`;
        button.innerHTML = icon;
        const label = t(labelKey, fallback);
        button.dataset.i18nKey = labelKey;
        button.dataset.i18nFallback = fallback;
        applyControlLabel(button, label);
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          action();
          if (this.outlineOpen && !this.isPinned) {
            this.toggleOutline(false);
          }
        });

        if (preview) {
          const wrapper = document.createElement('div');
          wrapper.className = 'chatdot-nav-btn-wrapper';
          const previewEl = document.createElement('div');
          previewEl.className = 'chatdot-msg-preview';
          wrapper.appendChild(previewEl);
          wrapper.appendChild(button);
          this.container.appendChild(wrapper);

          if (preview === 'prev') {
            this.prevPreview = previewEl;
          } else {
            this.nextPreview = previewEl;
          }

          wrapper.addEventListener('mouseenter', () => {
            if (!SETTINGS.showPreview) {
              previewEl.innerHTML = '';
              return;
            }

            button.dataset.originalTitle = button.title;
            button.title = '';
            this.updatePreview(preview, previewEl);
          });

          wrapper.addEventListener('mouseleave', () => {
            if (button.dataset.originalTitle) {
              button.title = button.dataset.originalTitle;
            }
          });
        } else {
          this.container.appendChild(button);
        }

        this.navButtons[labelKey] = button;

        if (index === 1) {
          this.counterEl = document.createElement('div');
          this.counterEl.className = 'chatdot-nav-counter';
          this.counterEl.textContent = '';
          this.container.appendChild(this.counterEl);
        }
      });

      document.body.appendChild(this.container);
      this.createOutlinePanel();
    }

    createOutlinePanel() {
      const panel = document.createElement('div');
      panel.className = 'chatdot-outline-panel';

      const header = document.createElement('div');
      header.className = 'chatdot-outline-header';

      const title = document.createElement('span');
      title.className = 'chatdot-outline-title';
      title.textContent = t('outline_title', '大纲');
      this.outlineTitleEl = title;

      const actions = document.createElement('div');
      actions.className = 'chatdot-outline-actions';

      const pinBtn = document.createElement('button');
      pinBtn.className = 'chatdot-outline-pin';
      pinBtn.innerHTML = ICONS.pin;
      applyControlLabel(pinBtn, t('outline_pin', '固定大纲'));
      pinBtn.addEventListener('click', () => {
        this.isPinned = !this.isPinned;
        pinBtn.classList.toggle('active', this.isPinned);
      });
      this.outlinePinBtn = pinBtn;

      const closeBtn = document.createElement('button');
      closeBtn.className = 'chatdot-outline-close';
      closeBtn.innerHTML = '&times;';
      applyControlLabel(closeBtn, t('outline_close', '关闭大纲'));
      closeBtn.addEventListener('click', () => this.toggleOutline(false));
      this.outlineCloseBtn = closeBtn;

      actions.appendChild(pinBtn);
      actions.appendChild(closeBtn);
      header.appendChild(title);
      header.appendChild(actions);
      panel.appendChild(header);

      const list = document.createElement('div');
      list.className = 'chatdot-outline-list';
      panel.appendChild(list);

      this.outlinePanel = panel;
      this.outlineList = list;
      this.outlineItems = [];

      if (!SETTINGS.showOutline) {
        panel.style.display = 'none';
      }

      document.body.appendChild(panel);
    }

    applyLocalizedText() {
      if (this.outlineToggleBtn) {
        applyControlLabel(this.outlineToggleBtn, t('outline_title', '大纲'));
      }

      Object.entries(this.navButtons).forEach(([key, button]) => {
        if (!button) {
          return;
        }

        const label = t(key, button.dataset.i18nFallback || '');
        applyControlLabel(button, label);
      });

      if (this.outlineTitleEl) {
        this.outlineTitleEl.textContent = t('outline_title', '大纲');
      }

      if (this.outlinePinBtn) {
        applyControlLabel(this.outlinePinBtn, t('outline_pin', '固定大纲'));
      }

      if (this.outlineCloseBtn) {
        applyControlLabel(this.outlineCloseBtn, t('outline_close', '关闭大纲'));
      }

      if (SETTINGS.showPreview) {
        if (this.prevPreview && this.prevPreview.innerHTML.trim()) {
          this.updatePreview('prev', this.prevPreview);
        }
        if (this.nextPreview && this.nextPreview.innerHTML.trim()) {
          this.updatePreview('next', this.nextPreview);
        }
      }

      if (this.outlineOpen) {
        this.renderOutline();
      }
    }

    bindGlobalEvents() {
      this.docClickHandler = (event) => {
        if (!this.outlineOpen || this.isPinned) {
          return;
        }
        if (this.outlineToggleBtn && this.outlineToggleBtn.contains(event.target)) {
          return;
        }
        if (this.outlinePanel && !this.outlinePanel.contains(event.target)) {
          this.toggleOutline(false);
        }
      };
      document.addEventListener('click', this.docClickHandler);

      this.routeHandler = () => {
        this.lastUrl = location.href;
        this.scheduleConversationSync(true, 0);
      };
      window.addEventListener('chatdot:routechange', this.routeHandler);
      window.addEventListener('popstate', this.routeHandler);

      this.resizeHandler = () => {
        this.scheduleConversationSync(false, 60);
      };
      window.addEventListener('resize', this.resizeHandler, { passive: true });
    }

    observeDocument() {
      if (this.bodyObserver) {
        this.bodyObserver.disconnect();
      }

      this.bodyObserver = new MutationObserver((mutations) => {
        if (this.scrollContainer && !this.scrollContainer.isConnected) {
          this.scheduleConversationSync(true, 0);
          return;
        }

        let shouldSync = false;

        for (const mutation of mutations) {
          if (mutation.type !== 'childList') {
            continue;
          }

          if (
            this.scrollContainer
            && mutation.target instanceof Node
            && (mutation.target === this.scrollContainer || this.scrollContainer.contains(mutation.target))
          ) {
            continue;
          }

          const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
          for (const node of changedNodes) {
            if (isPluginElement(node)) {
              continue;
            }

            if (!(node instanceof Element)) {
              continue;
            }

            if (
              nodeMatchesAnySelector(node, CURRENT_SELECTORS.scrollContainer)
              || nodeMatchesAnySelector(node, CURRENT_SELECTORS.userMessage)
            ) {
              shouldSync = true;
              break;
            }

            if (this.scrollContainer && (node === this.scrollContainer || node.contains(this.scrollContainer))) {
              shouldSync = true;
              break;
            }

            if (node.matches('main') || node.querySelector('main')) {
              shouldSync = true;
              break;
            }


          }

          if (shouldSync) {
            break;
          }
        }

        if (shouldSync) {
          this.scheduleConversationSync(true, 120);
        }
      });

      this.bodyObserver.observe(document.body, { childList: true, subtree: true });
    }

    observeScrollContainer() {
      if (this.containerObserver) {
        this.containerObserver.disconnect();
      }

      if (!this.scrollContainer) {
        return;
      }

      this.containerObserver = new MutationObserver((mutations) => {
        let snapshotChanged = false;
        let layoutChanged = false;

        for (const mutation of mutations) {
          if (mutation.type !== 'childList') {
            continue;
          }

          const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
          for (const node of changedNodes) {
            if (isPluginElement(node)) {
              continue;
            }

            layoutChanged = true;

            if (nodeMatchesAnySelector(node, CURRENT_SELECTORS.userMessage)) {
              snapshotChanged = true;
              break;
            }
          }

          if (snapshotChanged) {
            break;
          }
        }

        if (snapshotChanged) {
          this.refreshCurrentConversation();
          return;
        }

        if (layoutChanged) {
          this.scheduleLocalRefresh();
        }
      });

      this.containerObserver.observe(this.scrollContainer, { childList: true, subtree: true });
    }

    attachScrollContainer(scrollContainer) {
      if (this.scrollContainer === scrollContainer) {
        return;
      }

      this.detachScrollContainer();
      this.scrollContainer = scrollContainer;
      if (!this.scrollContainer) {
        return;
      }

      this.scrollHandler = () => {
        if (this.scrollTicking) {
          return;
        }

        this.scrollTicking = true;
        requestAnimationFrame(() => {
          this.scrollTicking = false;
          this.handleScroll();
        });
      };

      this.scrollContainer.addEventListener('scroll', this.scrollHandler, { passive: true });
      this.observeScrollContainer();
    }

    detachScrollContainer() {
      if (this.scrollContainer && this.scrollHandler) {
        this.scrollContainer.removeEventListener('scroll', this.scrollHandler);
      }

      if (this.containerObserver) {
        this.containerObserver.disconnect();
        this.containerObserver = null;
      }

      this.scrollContainer = null;
      this.scrollHandler = null;
      this.scrollTicking = false;
      this.localRefreshScheduled = false;
    }

    scheduleConversationSync(forceRebind = false, delay = 120) {
      if (!SETTINGS.enabled) {
        return;
      }

      if (forceRebind) {
        this.pendingForceRebind = true;
      }

      if (this.syncTimer) {
        clearTimeout(this.syncTimer);
      }

      this.syncTimer = setTimeout(() => {
        const shouldForceRebind = this.pendingForceRebind;
        this.pendingForceRebind = false;
        this.syncConversation(shouldForceRebind);
      }, delay);
    }

    syncConversation(forceRebind = false) {
      if (!SETTINGS.enabled || !this.container) {
        return;
      }

      const urlChanged = location.href !== this.lastUrl;
      if (urlChanged) {
        this.lastUrl = location.href;
        forceRebind = true;
      }

      const { scrollContainer, messages } = findConversationBinding();

      if (!scrollContainer) {
        this.detachScrollContainer();
        this.boundUrl = '';
        this.clearSnapshot();
        this.updateVisibility();
        this.scheduleRetry();
        return;
      }

      const containerChanged = forceRebind
        || !this.scrollContainer
        || !this.scrollContainer.isConnected
        || this.scrollContainer !== scrollContainer
        || this.boundUrl !== location.href;
      const conversationChanged = Boolean(this.boundUrl) && this.boundUrl !== location.href;

      if (containerChanged) {
        if (conversationChanged) {
          this.manualTrimApplied = false;
          this.trimSuppressed = false;
          this.trimAppliedSignature = resolveTrimSignature(SETTINGS);
        }
        this.attachScrollContainer(scrollContainer);
        this.boundUrl = location.href;
      }

      this.clearRetry();
      this.syncTrimState();

      const scopedMessages = this.getMessagesInContainer(scrollContainer);
      const snapshotChanged = containerChanged || this.hasSnapshotChanged(scopedMessages);

      if (snapshotChanged) {
        this.rebuildSnapshot(scopedMessages);
      } else {
        this.refreshMeasurements();
        this.updateActiveIndex();
        this.updateVisibility();
        this.syncCounter();
        this.syncOutlineActiveState();
      }
    }

    scheduleRetry() {
      if (this.retryCount >= this.maxRetries) {
        return;
      }

      this.retryCount += 1;
      if (this.retryTimer) {
        clearTimeout(this.retryTimer);
      }

      this.retryTimer = setTimeout(() => {
        this.scheduleConversationSync(true, 0);
      }, 250);
    }

    clearRetry() {
      this.retryCount = 0;
      if (this.retryTimer) {
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
      }
    }

    hasSnapshotChanged(messages) {
      if (messages.length !== this.snapshot.length) {
        return true;
      }

      for (let i = 0; i < messages.length; i++) {
        if (messages[i] !== this.snapshot[i]?.el) {
          return true;
        }
      }

      return false;
    }

    getMessagesInContainer(scrollContainer = this.scrollContainer) {
      if (!scrollContainer) {
        return [];
      }

      return findUserMessages(scrollContainer);
    }

    getTrimRoot() {
      if (this.scrollContainer && this.scrollContainer.isConnected) {
        return this.scrollContainer;
      }

      return document;
    }

    isTrimSupported() {
      return currentPlatform === 'chatgpt';
    }

    setTrimmedState(el, shouldHide) {
      if (!(el instanceof HTMLElement)) {
        return;
      }

      el.classList.toggle(TRIMMED_CLASS, shouldHide);
      if (shouldHide) {
        el.setAttribute('data-chatdot-trimmed', 'true');
      } else {
        el.removeAttribute('data-chatdot-trimmed');
      }
    }

    restoreTrimmedConversation(options = {}) {
      const suppress = Boolean(options.suppress);
      document.querySelectorAll(`.${TRIMMED_CLASS}`).forEach((el) => {
        this.setTrimmedState(el, false);
      });
      this.manualTrimApplied = false;
      this.trimSuppressed = suppress;
      this.trimAppliedSignature = resolveTrimSignature(SETTINGS);

      return this.updateTrimStats();
    }

    updateTrimStats() {
      const root = this.getTrimRoot();
      const totalMessages = findUserMessages(root, { includeTrimmed: true });
      const visibleMessages = findUserMessages(root);
      const keepWindow = resolveTrimWindow(totalMessages.length, SETTINGS.trimKeepTurns);

      this.trimStats = {
        supported: this.isTrimSupported(),
        enabled: SETTINGS.trimEnabled || this.manualTrimApplied,
        keep: keepWindow.keep,
        total: keepWindow.total,
        visible: visibleMessages.length,
        hidden: keepWindow.total - visibleMessages.length,
        applied: keepWindow.total - visibleMessages.length > 0,
      };

      return { ...this.trimStats };
    }

    applyTrim(options = {}) {
      if (!this.isTrimSupported()) {
        return this.updateTrimStats();
      }

      this.manualTrimApplied = Boolean(options.manual) && !SETTINGS.trimEnabled;
      this.trimSuppressed = false;
      const root = this.getTrimRoot();
      const allMessages = findUserMessages(root, { includeTrimmed: true });
      const keepWindow = resolveTrimWindow(allMessages.length, SETTINGS.trimKeepTurns);
      const turns = findConversationTurns(root);

      if (keepWindow.hidden <= 0 || !allMessages[keepWindow.start]) {
        return this.restoreTrimmedConversation();
      }

      const cutoffTurn = getConversationTurnElement(allMessages[keepWindow.start]);
      if (!cutoffTurn) {
        return this.updateTrimStats();
      }

      if (turns.length > 0) {
        turns.forEach((turn) => {
          const shouldHide = turn !== cutoffTurn
            && Boolean(turn.compareDocumentPosition(cutoffTurn) & Node.DOCUMENT_POSITION_FOLLOWING);
          this.setTrimmedState(turn, shouldHide);
        });
      } else {
        allMessages.forEach((message, index) => {
          this.setTrimmedState(message, index < keepWindow.start);
        });
      }

      this.trimAppliedSignature = resolveTrimSignature(SETTINGS);

      return this.updateTrimStats();
    }

    syncTrimState(options = {}) {
      const forceApply = Boolean(options.forceApply);
      const previousTotal = this.trimStats?.total || 0;
      const currentSignature = resolveTrimSignature(SETTINGS);

      if (!this.isTrimSupported()) {
        return this.restoreTrimmedConversation({ suppress: false });
      }

      if (!SETTINGS.trimEnabled && !this.manualTrimApplied) {
        return this.restoreTrimmedConversation({ suppress: false });
      }

      const currentStats = this.updateTrimStats();
      if (this.manualTrimApplied) {
        if (this.trimAppliedSignature !== currentSignature) {
          return this.applyTrim({ manual: true });
        }
        if (!currentStats.applied) {
          return this.applyTrim({ manual: true });
        }
        return currentStats;
      }

      if (this.trimAppliedSignature !== currentSignature && !this.trimSuppressed) {
        return this.applyTrim();
      }

      if (shouldApplyTrim({
        forceApply,
        trimSuppressed: this.trimSuppressed,
        autoApply: SETTINGS.trimAutoApply,
        previousTotal,
        currentTotal: currentStats.total,
        applied: currentStats.applied,
      })) {
        return this.applyTrim();
      }

      return currentStats;
    }

    getTrimStats() {
      return this.updateTrimStats();
    }

    refreshCurrentConversation() {
      if (!this.scrollContainer || !this.scrollContainer.isConnected) {
        this.scheduleConversationSync(true, 0);
        return;
      }

      this.syncTrimState();

      const scopedMessages = this.getMessagesInContainer(this.scrollContainer);
      if (this.hasSnapshotChanged(scopedMessages)) {
        this.rebuildSnapshot(scopedMessages);
        return;
      }

      this.scheduleLocalRefresh();
    }

    scheduleLocalRefresh() {
      if (this.localRefreshScheduled) {
        return;
      }

      this.localRefreshScheduled = true;
      requestAnimationFrame(() => {
        this.localRefreshScheduled = false;

        if (!this.scrollContainer || !this.scrollContainer.isConnected) {
          this.scheduleConversationSync(true, 0);
          return;
        }

        this.refreshMeasurements();
        this.updateActiveIndex();
        this.updateVisibility();
        this.syncCounter();
        this.syncOutlineActiveState();
      });
    }

    syncAfterProgrammaticScroll() {
      if (!requiresPostScrollSync(SETTINGS.scrollMode)) {
        return;
      }

      this.scheduleLocalRefresh();
    }

    rebuildSnapshot(messages) {
      this.snapshot = messages.map((message, index) => ({
        index,
        el: message,
        text: extractMessageText(message, 60),
        previewText: extractMessageText(message, 80),
        top: 0,
      }));

      this.refreshMeasurements();
      this.updateActiveIndex();
      this.updateVisibility();
      this.syncCounter();

      if (this.outlineOpen) {
        this.renderOutline();
      } else {
        this.clearOutlineIfEmpty();
      }
    }

    clearSnapshot() {
      this.snapshot = [];
      this.activeIndex = -1;
      this.syncCounter();
      this.clearOutlineIfEmpty();
    }

    clearOutlineIfEmpty() {
      if (this.outlineOpen) {
        this.renderOutline();
      } else if (this.outlineList) {
        this.outlineList.innerHTML = '';
        this.outlineItems = [];
      }
    }

    refreshMeasurements() {
      if (!this.scrollContainer) {
        return;
      }

      this.snapshot = this.snapshot.filter((item) => item.el.isConnected && this.scrollContainer.contains(item.el));
      this.snapshot.forEach((item, index) => {
        item.index = index;
        item.top = this.getOffsetTop(item.el);
      });
    }

    getOffsetTop(el) {
      if (!this.scrollContainer) {
        return 0;
      }

      const containerRect = this.scrollContainer.getBoundingClientRect();
      const elementRect = el.getBoundingClientRect();
      return elementRect.top - containerRect.top + this.scrollContainer.scrollTop;
    }

    getMaxScrollTop() {
      if (!this.scrollContainer) {
        return 0;
      }

      return Math.max(0, this.scrollContainer.scrollHeight - this.scrollContainer.clientHeight);
    }

    updateActiveIndex() {
      if (!this.scrollContainer || this.snapshot.length === 0) {
        this.activeIndex = -1;
        return;
      }

      if (this.scrollStrategy === 'element') {
        this.updateVisualActiveIndex();
        return;
      }

      const anchorTops = this.snapshot.map((item) => item.top);
      this.activeIndex = resolveActiveIndex(anchorTops, {
        scrollTop: this.scrollContainer.scrollTop,
        maxScrollTop: this.getMaxScrollTop(),
        safeOffset: this.safeOffset,
        bottomEpsilon: this.bottomEpsilon,
      });
    }

    updateVisualActiveIndex() {
      const containerRect = this.scrollContainer.getBoundingClientRect();
      const anchorRects = this.snapshot.map((item) => {
        const rect = item.el.getBoundingClientRect();
        return {
          top: rect.top,
          bottom: rect.bottom,
        };
      });

      this.activeIndex = resolveVisualActiveIndex(anchorRects, {
        containerTop: containerRect.top,
        containerBottom: containerRect.bottom,
        safeOffset: this.safeOffset,
        currentIndex: this.activeIndex,
      });
    }

    handleScroll() {
      if (!this.scrollContainer) {
        return;
      }

      this.updateActiveIndex();
      this.updateVisibility();
      this.syncCounter();
      this.syncOutlineActiveState();
    }

    updateVisibility() {
      if (!this.container || !this.scrollContainer) {
        if (this.container) {
          this.container.classList.remove('visible');
        }
        return;
      }

      const isScrollable = this.scrollContainer.scrollHeight > this.scrollContainer.clientHeight + 50;
      this.container.classList.toggle('visible', isScrollable);
    }

    syncCounter() {
      if (!this.counterEl) {
        return;
      }

      if (this.snapshot.length === 0) {
        this.counterEl.textContent = '';
        return;
      }

      const displayIndex = this.activeIndex >= 0 ? this.activeIndex + 1 : 1;
      this.counterEl.textContent = `${displayIndex}/${this.snapshot.length}`;
    }

    toggleOutline(forceTo) {
      if (!this.outlinePanel || !this.outlineToggleBtn) {
        return;
      }

      if (!SETTINGS.showOutline && forceTo !== false) {
        return;
      }

      this.outlineOpen = forceTo !== undefined ? forceTo : !this.outlineOpen;
      this.outlinePanel.classList.toggle('open', this.outlineOpen);
      this.outlineToggleBtn.classList.toggle('active', this.outlineOpen);

      if (this.outlineOpen) {
        this.renderOutline();
        return;
      }

      this.isPinned = false;
      const pinEl = this.outlinePanel.querySelector('.chatdot-outline-pin');
      if (pinEl) {
        pinEl.classList.remove('active');
      }
    }

    renderOutline() {
      if (!this.outlineList) {
        return;
      }

      this.outlineList.innerHTML = '';
      this.outlineItems = [];

      if (this.snapshot.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'chatdot-outline-empty';
        empty.textContent = t('outline_empty', '暂无用户消息');
        this.outlineList.appendChild(empty);
        return;
      }

      this.snapshot.forEach((item, index) => {
        const outlineItem = document.createElement('div');
        outlineItem.className = 'chatdot-outline-item';
        outlineItem.dataset.index = String(index);

        const num = document.createElement('span');
        num.className = 'chatdot-outline-num';
        num.textContent = String(index + 1);

        const text = document.createElement('span');
        text.className = 'chatdot-outline-text';
        text.textContent = item.text;

        outlineItem.appendChild(num);
        outlineItem.appendChild(text);
        outlineItem.addEventListener('click', () => {
          this.scrollToIndex(index);
        });

        this.outlineList.appendChild(outlineItem);
        this.outlineItems.push(outlineItem);
      });

      this.syncOutlineActiveState();
    }

    syncOutlineActiveState() {
      if (!this.outlineOpen || this.outlineItems.length === 0) {
        return;
      }

      this.outlineItems.forEach((item, index) => {
        item.classList.toggle('active', index === this.activeIndex);
      });

      const activeItem = this.outlineItems[this.activeIndex];
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest' });
      }
    }

    updatePreview(direction, previewEl) {
      if (this.snapshot.length === 0) {
        previewEl.innerHTML = '';
        return;
      }

      this.refreshMeasurements();
      this.updateActiveIndex();

      const lastIndex = this.snapshot.length - 1;
      const atBoundary = direction === 'prev'
        ? this.activeIndex === 0
        : this.activeIndex === lastIndex;

      if (atBoundary) {
        previewEl.innerHTML = `<span class="chatdot-preview-label">${direction === 'prev' ? t('preview_prev', '↑ 上一条') : t('preview_next', '↓ 下一条')}</span><span class="chatdot-preview-text" style="color:#6e6e80">${direction === 'prev' ? t('preview_at_top', '已在最顶部') : t('preview_at_bottom', '已在最底部')}</span>`;
        return;
      }

      const targetIndex = resolveAdjacentIndex(this.activeIndex, direction, this.snapshot.length);
      const target = this.snapshot[targetIndex];

      if (!target) {
        previewEl.innerHTML = '';
        return;
      }

      const label = direction === 'prev' ? t('preview_prev', '↑ 上一条') : t('preview_next', '↓ 下一条');
      previewEl.innerHTML = `<span class="chatdot-preview-label">${label}</span><span class="chatdot-preview-text">${this.escapeHtml(target.previewText)}</span>`;
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    scrollToTop() {
      if (!this.scrollContainer) {
        return;
      }

      if (this.scrollStrategy === 'element' && this.snapshot.length > 0) {
        this.scrollToIndex(0);
        return;
      }

      this.activeIndex = this.snapshot.length > 0 ? 0 : -1;
      this.syncCounter();
      this.syncOutlineActiveState();
      this.scrollContainer.scrollTo({ top: 0, behavior: SETTINGS.scrollMode });
      this.syncAfterProgrammaticScroll();
    }

    scrollToBottom() {
      if (!this.scrollContainer) {
        return;
      }

      if (this.scrollStrategy === 'element' && this.snapshot.length > 0) {
        this.scrollToIndex(this.snapshot.length - 1);
        return;
      }

      this.activeIndex = this.snapshot.length > 0 ? this.snapshot.length - 1 : -1;
      this.syncCounter();
      this.syncOutlineActiveState();
      this.scrollContainer.scrollTo({ top: this.getMaxScrollTop(), behavior: SETTINGS.scrollMode });
      this.syncAfterProgrammaticScroll();
    }

    scrollToMessage(direction) {
      if (this.snapshot.length === 0) {
        return;
      }

      this.refreshMeasurements();
      this.updateActiveIndex();

      const lastIndex = this.snapshot.length - 1;

      if (direction === 'prev' && this.activeIndex === 0) {
        this.scrollToTop();
        return;
      }

      if (direction === 'next' && this.activeIndex === lastIndex) {
        this.scrollToBottom();
        return;
      }

      const targetIndex = resolveAdjacentIndex(this.activeIndex, direction, this.snapshot.length);
      this.scrollToIndex(targetIndex);
    }

    scrollToIndex(index) {
      if (!this.scrollContainer || index < 0 || index >= this.snapshot.length) {
        return;
      }

      this.refreshMeasurements();
      this.updateActiveIndex();
      const target = this.snapshot[index];
      if (!target) {
        return;
      }

      const top = resolveScrollTarget(target.top, {
        safeOffset: this.safeOffset,
        maxScrollTop: this.getMaxScrollTop(),
      });

      this.activeIndex = index;
      this.syncCounter();
      this.syncOutlineActiveState();
      if (this.scrollStrategy === 'element') {
        this.scrollElementIntoView(target.el);
      } else {
        this.scrollContainer.scrollTo({ top, behavior: SETTINGS.scrollMode });
      }
      this.syncAfterProgrammaticScroll();
      this.highlightMessage(target.el);
    }

    scrollElementIntoView(el) {
      if (!el || typeof el.scrollIntoView !== 'function') {
        return;
      }

      const previousScrollMarginTop = el.style.scrollMarginTop;
      el.style.scrollMarginTop = `${this.safeOffset}px`;
      el.scrollIntoView({
        block: 'start',
        inline: 'nearest',
        behavior: SETTINGS.scrollMode,
      });

      window.setTimeout(() => {
        if (!el.isConnected) {
          return;
        }

        if (previousScrollMarginTop) {
          el.style.scrollMarginTop = previousScrollMarginTop;
        } else {
          el.style.removeProperty('scroll-margin-top');
        }
      }, SETTINGS.scrollMode === 'smooth' ? 700 : 0);
    }

    highlightMessage(el) {
      el.classList.remove('chatdot-highlight');
      void el.offsetWidth;
      el.classList.add('chatdot-highlight');
      setTimeout(() => el.classList.remove('chatdot-highlight'), 800);
    }

    destroy() {
      if (this.syncTimer) {
        clearTimeout(this.syncTimer);
        this.syncTimer = null;
      }

      this.clearRetry();
      this.detachScrollContainer();
      this.restoreTrimmedConversation();

      if (this.bodyObserver) {
        this.bodyObserver.disconnect();
        this.bodyObserver = null;
      }

      if (this.containerObserver) {
        this.containerObserver.disconnect();
        this.containerObserver = null;
      }

      if (this.docClickHandler) {
        document.removeEventListener('click', this.docClickHandler);
        this.docClickHandler = null;
      }

      if (this.routeHandler) {
        window.removeEventListener('chatdot:routechange', this.routeHandler);
        window.removeEventListener('popstate', this.routeHandler);
        this.routeHandler = null;
      }

      if (this.resizeHandler) {
        window.removeEventListener('resize', this.resizeHandler);
        this.resizeHandler = null;
      }

      if (this.container) {
        this.container.remove();
        this.container = null;
      }

      if (this.outlinePanel) {
        this.outlinePanel.remove();
        this.outlinePanel = null;
      }

      this.counterEl = null;
      this.prevPreview = null;
      this.nextPreview = null;
      this.outlineList = null;
      this.outlineToggleBtn = null;
      this.outlineItems = [];
      this.outlineOpen = false;
      this.isPinned = false;
      this.snapshot = [];
      this.activeIndex = -1;
      this.boundUrl = '';
      this.initialized = false;
      this.localRefreshScheduled = false;
      this.trimStats = {
        supported: currentPlatform === 'chatgpt',
        enabled: SETTINGS.trimEnabled,
        keep: Math.max(1, Number.parseInt(SETTINGS.trimKeepTurns, 10) || 10),
        total: 0,
        visible: 0,
        hidden: 0,
        applied: false,
      };
      this.manualTrimApplied = false;
      this.trimSuppressed = false;
      this.trimAppliedSignature = resolveTrimSignature(SETTINGS);
    }
  }

  if (chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg?.type) {
        return undefined;
      }

      if (msg.type === 'settingsChanged') {
        Promise.resolve().then(async () => {
          if (msg.enabled !== undefined) SETTINGS.enabled = msg.enabled;
          if (msg.scrollMode !== undefined) SETTINGS.scrollMode = msg.scrollMode;
          if (msg.showPreview !== undefined) SETTINGS.showPreview = msg.showPreview;
          if (msg.showOutline !== undefined) SETTINGS.showOutline = msg.showOutline;
          if (msg.trimKeepTurns !== undefined) SETTINGS.trimKeepTurns = Math.max(1, Number.parseInt(msg.trimKeepTurns, 10) || 1);
          if (msg.trimAutoApply !== undefined) SETTINGS.trimAutoApply = msg.trimAutoApply;
          SETTINGS.trimEnabled = Boolean(SETTINGS.trimAutoApply);
          if (msg.language !== undefined) {
            SETTINGS.language = msg.language;
            await syncMessages(msg.language);
          }
          if (msg.themeMode !== undefined) {
            SETTINGS.themeMode = msg.themeMode;
            applyThemeMode(msg.themeMode);
          }

          const nav = window.__chatdotNav;
          if (!nav) {
            return null;
          }

          if (msg.enabled !== undefined) {
            if (SETTINGS.enabled) {
              nav.init();
            } else {
              nav.destroy();
            }
            return nav.getTrimStats();
          }

          if (!nav.container) {
            return nav.getTrimStats();
          }

          if (msg.language !== undefined) {
            nav.applyLocalizedText();
          }

          if (msg.showOutline !== undefined) {
            if (nav.outlineToggleBtn) {
              nav.outlineToggleBtn.style.display = SETTINGS.showOutline ? '' : 'none';
            }

            if (nav.outlinePanel) {
              if (!SETTINGS.showOutline) {
                nav.toggleOutline(false);
              }
              nav.outlinePanel.style.display = SETTINGS.showOutline ? '' : 'none';
            }
          }

          if (msg.trimKeepTurns !== undefined || msg.trimAutoApply !== undefined || msg.trimEnabled !== undefined) {
            nav.syncTrimState();
          }

          nav.scheduleConversationSync(false, 0);
          return nav.getTrimStats();
        }).then((response) => {
          sendResponse(response);
        }).catch(() => {
          sendResponse(null);
        });

        return true;
      }

      if (msg.type === 'trimApply' || msg.type === 'trimRestore' || msg.type === 'trimGetStats') {
        Promise.resolve().then(() => {
          const nav = window.__chatdotNav;
          if (!nav) {
            return null;
          }

          if (msg.type === 'trimApply') {
            nav.applyTrim({ manual: true });
            nav.scheduleConversationSync(false, 0);
          } else if (msg.type === 'trimRestore') {
            nav.restoreTrimmedConversation({ suppress: true });
            nav.scheduleConversationSync(false, 0);
          }

          return nav.getTrimStats();
        }).then((response) => {
          sendResponse(response);
        }).catch(() => {
          sendResponse(null);
        });

        return true;
      }

      return undefined;
    });
  }

  loadSettings(() => {
    installHistoryHooks();
    const nav = new NavigationSidebar();
    nav.init();
    window.__chatdotNav = nav;
    console.log(LOG_PREFIX, 'loaded');
  });
})();
