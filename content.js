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
    resolveScrollTarget,
    requiresPostScrollSync,
  } = NAV_LOGIC;

  const SETTINGS = {
    enabled: true,
    scrollMode: 'smooth',
    showPreview: true,
    showOutline: true,
  };

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
    },
  };

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
      chrome.storage.local.get(SETTINGS, (data) => {
        Object.assign(SETTINGS, data);
        if (callback) callback();
      });
      return;
    }

    if (callback) callback();
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
    for (const selector of PLATFORM_SELECTORS.chatgpt.scrollContainer) {
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

  function findUserMessages(root = document) {
    return queryAll(PLATFORM_SELECTORS.chatgpt.userMessage, root);
  }

  function extractMessageText(msgEl, maxLen = 80) {
    const textEl = msgEl.querySelector('.whitespace-pre-wrap')
      || msgEl.querySelector('[data-message-content]')
      || msgEl.querySelector('div > div');
    const raw = (textEl || msgEl).textContent || '';
    const text = raw.replace(/\s+/g, ' ').trim();
    return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
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
      this.lastUrl = location.href;
      this.boundUrl = '';
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
      outlineBtn.title = '大纲';
      outlineBtn.setAttribute('aria-label', '大纲');
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
        { cls: 'chatdot-nav-btn-top', icon: ICONS.chevronsUp, label: '跳到顶部', action: () => this.scrollToTop(), preview: false },
        { cls: 'chatdot-nav-btn-prev', icon: ICONS.chevronUp, label: '上一条用户消息', action: () => this.scrollToMessage('prev'), preview: 'prev' },
        { cls: 'chatdot-nav-btn-next', icon: ICONS.chevronDown, label: '下一条用户消息', action: () => this.scrollToMessage('next'), preview: 'next' },
        { cls: 'chatdot-nav-btn-bottom', icon: ICONS.chevronsDown, label: '跳到底部', action: () => this.scrollToBottom(), preview: false },
      ];

      buttons.forEach(({ cls, icon, label, action, preview }, index) => {
        const button = document.createElement('button');
        button.className = `chatdot-nav-btn ${cls}`;
        button.innerHTML = icon;
        button.title = label;
        button.setAttribute('aria-label', label);
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
      title.textContent = '大纲';

      const actions = document.createElement('div');
      actions.className = 'chatdot-outline-actions';

      const pinBtn = document.createElement('button');
      pinBtn.className = 'chatdot-outline-pin';
      pinBtn.innerHTML = ICONS.pin;
      pinBtn.title = '固定大纲';
      pinBtn.setAttribute('aria-label', '固定大纲');
      pinBtn.addEventListener('click', () => {
        this.isPinned = !this.isPinned;
        pinBtn.classList.toggle('active', this.isPinned);
      });

      const closeBtn = document.createElement('button');
      closeBtn.className = 'chatdot-outline-close';
      closeBtn.innerHTML = '&times;';
      closeBtn.setAttribute('aria-label', '关闭大纲');
      closeBtn.addEventListener('click', () => this.toggleOutline(false));

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

            if (this.scrollContainer && (node === this.scrollContainer || node.contains(this.scrollContainer))) {
              shouldSync = true;
              break;
            }

            if (node.matches('main') || node.querySelector('main')) {
              shouldSync = true;
              break;
            }

            if (
              nodeMatchesAnySelector(node, PLATFORM_SELECTORS.chatgpt.scrollContainer)
              || nodeMatchesAnySelector(node, PLATFORM_SELECTORS.chatgpt.userMessage)
            ) {
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

            if (nodeMatchesAnySelector(node, PLATFORM_SELECTORS.chatgpt.userMessage)) {
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

      if (containerChanged) {
        this.attachScrollContainer(scrollContainer);
        this.boundUrl = location.href;
      }

      this.clearRetry();

      const scopedMessages = messages.length > 0 ? messages : this.getMessagesInContainer(scrollContainer);
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

    refreshCurrentConversation() {
      if (!this.scrollContainer || !this.scrollContainer.isConnected) {
        this.scheduleConversationSync(true, 0);
        return;
      }

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

      const anchorTops = this.snapshot.map((item) => item.top);
      this.activeIndex = resolveActiveIndex(anchorTops, {
        scrollTop: this.scrollContainer.scrollTop,
        maxScrollTop: this.getMaxScrollTop(),
        safeOffset: this.safeOffset,
        bottomEpsilon: this.bottomEpsilon,
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
        empty.textContent = '暂无用户消息';
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
        previewEl.innerHTML = `<span class="chatdot-preview-label">${direction === 'prev' ? '↑ 上一条' : '↓ 下一条'}</span><span class="chatdot-preview-text" style="color:#6e6e80">${direction === 'prev' ? '已在最顶部' : '已在最底部'}</span>`;
        return;
      }

      const targetIndex = resolveAdjacentIndex(this.activeIndex, direction, this.snapshot.length);
      const target = this.snapshot[targetIndex];

      if (!target) {
        previewEl.innerHTML = '';
        return;
      }

      const label = direction === 'prev' ? '↑ 上一条' : '↓ 下一条';
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
      this.scrollContainer.scrollTo({ top, behavior: SETTINGS.scrollMode });
      this.syncAfterProgrammaticScroll();
      this.highlightMessage(target.el);
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
    }
  }

  if (chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type !== 'settingsChanged') {
        return;
      }

      if (msg.enabled !== undefined) SETTINGS.enabled = msg.enabled;
      if (msg.scrollMode !== undefined) SETTINGS.scrollMode = msg.scrollMode;
      if (msg.showPreview !== undefined) SETTINGS.showPreview = msg.showPreview;
      if (msg.showOutline !== undefined) SETTINGS.showOutline = msg.showOutline;

      const nav = window.__chatdotNav;
      if (!nav) {
        return;
      }

      if (msg.enabled !== undefined) {
        if (SETTINGS.enabled) {
          nav.init();
        } else {
          nav.destroy();
        }
        return;
      }

      if (!nav.container) {
        return;
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

      nav.scheduleConversationSync(false, 0);
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
