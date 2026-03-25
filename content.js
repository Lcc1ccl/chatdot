/**
 * ChatDot Navigator — Content Script
 * 移植自 Claudian NavigationSidebar 设计
 *
 * 核心功能：
 *  1. 自动检测 ChatGPT 页面对话滚动区域
 *  2. 注入浮动导航侧边栏（4 按钮 + 计数器）
 *  3. 支持：跳到顶部 / 上一条用户消息 / 下一条用户消息 / 跳到底部
 *  4. MutationObserver 动态响应新消息
 *  5. SPA 路由感知，切换对话自动重置
 *  6. 消息预览 tooltip（hover ⬆/⬇ 按钮时向左延展显示消息）
 *  7. 可配置滚动模式（smooth / instant）
 */

(function () {
  'use strict';

  const LOG_PREFIX = '[ChatDot Nav]';

  // ============================================
  // 0. 设置管理
  // ============================================

  const SETTINGS = {
    enabled: true,
    scrollMode: 'smooth',
    showPreview: true,
  };

  // 从 storage 加载设置
  function loadSettings(callback) {
    if (chrome?.storage?.sync) {
      chrome.storage.sync.get(SETTINGS, (data) => {
        Object.assign(SETTINGS, data);
        if (callback) callback();
      });
    }
  }

  // 监听 popup 发来的设置变更
  if (chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'settingsChanged') {
        if (msg.enabled !== undefined) SETTINGS.enabled = msg.enabled;
        if (msg.scrollMode !== undefined) SETTINGS.scrollMode = msg.scrollMode;
        if (msg.showPreview !== undefined) SETTINGS.showPreview = msg.showPreview;

        // 根据 enabled 状态显示/隐藏侧边栏
        if (window.__chatdotNav) {
          if (SETTINGS.enabled) {
            window.__chatdotNav.init();
          } else {
            window.__chatdotNav.destroy();
          }
        }
      }
    });
  }

  // ============================================
  // 1. 选择器配置 — 多层降级策略
  // ============================================

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
      conversationTurn: [
        'article[data-testid^="conversation-turn-"]',
        '[data-message-id]',
      ],
    },
  };

  // ============================================
  // 2. DOM 查找工具
  // ============================================

  function queryAll(selectors, root = document) {
    for (const sel of selectors) {
      try {
        const els = root.querySelectorAll(sel);
        if (els.length > 0) return Array.from(els);
      } catch (_) { /* skip */ }
    }
    return [];
  }

  function findScrollContainer() {
    for (const sel of PLATFORM_SELECTORS.chatgpt.scrollContainer) {
      try {
        const el = document.querySelector(sel);
        if (el && el.scrollHeight > el.clientHeight) return el;
      } catch (_) { /* skip */ }
    }
    const main = document.querySelector('main');
    if (main) {
      const divs = main.querySelectorAll('div');
      for (const el of divs) {
        const s = getComputedStyle(el);
        if (
          (s.overflowY === 'auto' || s.overflowY === 'scroll') &&
          el.scrollHeight > el.clientHeight + 100
        ) {
          return el;
        }
      }
    }
    return null;
  }

  function findUserMessages() {
    return queryAll(PLATFORM_SELECTORS.chatgpt.userMessage);
  }

  /**
   * 提取消息元素的纯文本内容（截断到 maxLen）
   */
  function extractMessageText(msgEl, maxLen = 120) {
    // ChatGPT 消息文本通常在 .whitespace-pre-wrap 或深层的 div/p 中
    const textEl = msgEl.querySelector('.whitespace-pre-wrap')
      || msgEl.querySelector('[data-message-content]')
      || msgEl.querySelector('div > div');
    const raw = (textEl || msgEl).textContent || '';
    const text = raw.replace(/\s+/g, ' ').trim();
    return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
  }

  // ============================================
  // 3. SVG 图标
  // ============================================

  const ICONS = {
    chevronsUp: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>',
    chevronUp: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
    chevronDown: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    chevronsDown: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>',
  };

  // ============================================
  // 4. NavigationSidebar 类
  // ============================================

  class NavigationSidebar {
    constructor() {
      this.container = null;
      this.counterEl = null;
      this.prevPreview = null;
      this.nextPreview = null;
      this.scrollContainer = null;
      this.scrollHandler = null;
      this.observer = null;
      this.retryCount = 0;
      this.maxRetries = 30;
    }

    // ---- 初始化 ----

    init() {
      if (!SETTINGS.enabled) return;

      this.scrollContainer = findScrollContainer();

      if (!this.scrollContainer) {
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          setTimeout(() => this.init(), 1000);
          return;
        }
        console.warn(LOG_PREFIX, '未找到滚动容器，放弃初始化');
        return;
      }

      this.createUI();
      this.bindEvents();
      this.updateVisibility();
      this.updateCounter();
      this.observeDOM();
      console.log(LOG_PREFIX, '导航侧边栏已加载 ✓');
    }

    // ---- UI 构建 ----

    createUI() {
      const existing = document.querySelector('.chatdot-nav-sidebar');
      if (existing) existing.remove();

      this.container = document.createElement('div');
      this.container.className = 'chatdot-nav-sidebar';

      const buttons = [
        { cls: 'chatdot-nav-btn-top', icon: ICONS.chevronsUp, label: '跳到顶部', action: () => this.scrollToTop(), preview: false },
        { cls: 'chatdot-nav-btn-prev', icon: ICONS.chevronUp, label: '上一条用户消息', action: () => this.scrollToMessage('prev'), preview: 'prev' },
        { cls: 'chatdot-nav-btn-next', icon: ICONS.chevronDown, label: '下一条用户消息', action: () => this.scrollToMessage('next'), preview: 'next' },
        { cls: 'chatdot-nav-btn-bottom', icon: ICONS.chevronsDown, label: '跳到底部', action: () => this.scrollToBottom(), preview: false },
      ];

      buttons.forEach(({ cls, icon, label, action, preview }, i) => {
        const btn = document.createElement('button');
        btn.className = `chatdot-nav-btn ${cls}`;
        btn.innerHTML = icon;
        btn.title = label;
        btn.setAttribute('aria-label', label);
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          action();
        });

        // 如果需要消息预览，用 wrapper 包裹
        if (preview) {
          const wrapper = document.createElement('div');
          wrapper.className = 'chatdot-nav-btn-wrapper';

          const previewEl = document.createElement('div');
          previewEl.className = 'chatdot-msg-preview';

          wrapper.appendChild(previewEl);
          wrapper.appendChild(btn);
          this.container.appendChild(wrapper);

          if (preview === 'prev') this.prevPreview = previewEl;
          if (preview === 'next') this.nextPreview = previewEl;

          // Hover 时更新预览内容
          wrapper.addEventListener('mouseenter', () => {
            if (!SETTINGS.showPreview) {
              previewEl.innerHTML = '';
              return;
            }
            this.updatePreview(preview, previewEl);
          });
        } else {
          this.container.appendChild(btn);
        }

        // 计数器：放在 prev 按钮之后
        if (i === 1) {
          this.counterEl = document.createElement('div');
          this.counterEl.className = 'chatdot-nav-counter';
          this.counterEl.textContent = '';
          this.container.appendChild(this.counterEl);
        }
      });

      document.body.appendChild(this.container);
    }

    // ---- 消息预览更新 ----

    updatePreview(direction, previewEl) {
      const messages = findUserMessages();
      if (messages.length === 0) {
        previewEl.innerHTML = '';
        return;
      }

      const scrollTop = this.scrollContainer.scrollTop;
      const containerRect = this.scrollContainer.getBoundingClientRect();
      const threshold = 30;
      let target = null;
      const dirLabel = direction === 'prev' ? '⬆ 上一条' : '⬇ 下一条';

      if (direction === 'prev') {
        for (let i = messages.length - 1; i >= 0; i--) {
          const msgTop = messages[i].getBoundingClientRect().top - containerRect.top + scrollTop;
          if (msgTop < scrollTop - threshold) {
            target = messages[i];
            break;
          }
        }
      } else {
        for (let i = 0; i < messages.length; i++) {
          const msgTop = messages[i].getBoundingClientRect().top - containerRect.top + scrollTop;
          if (msgTop > scrollTop + threshold) {
            target = messages[i];
            break;
          }
        }
      }

      if (target) {
        const text = extractMessageText(target);
        previewEl.innerHTML = `<span class="chatdot-preview-label">${dirLabel}</span><span class="chatdot-preview-text">${this.escapeHtml(text)}</span>`;
      } else {
        previewEl.innerHTML = `<span class="chatdot-preview-label">${dirLabel}</span><span class="chatdot-preview-text" style="color:#6e6e80">${direction === 'prev' ? '已在最顶部' : '已在最底部'}</span>`;
      }
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // ---- 事件绑定 ----

    bindEvents() {
      this.scrollHandler = () => {
        this.updateVisibility();
        this.updateCounter();
      };
      this.scrollContainer.addEventListener('scroll', this.scrollHandler, { passive: true });
    }

    // ---- 可见性 ----

    updateVisibility() {
      if (!this.scrollContainer || !this.container) return;
      const { scrollHeight, clientHeight } = this.scrollContainer;
      const isScrollable = scrollHeight > clientHeight + 50;
      this.container.classList.toggle('visible', isScrollable);
    }

    // ---- 计数器 ----

    updateCounter() {
      if (!this.counterEl) return;
      const messages = findUserMessages();
      const total = messages.length;
      if (total === 0) {
        this.counterEl.textContent = '';
        return;
      }

      const scrollTop = this.scrollContainer.scrollTop;
      const containerRect = this.scrollContainer.getBoundingClientRect();
      let current = 0;

      for (let i = 0; i < messages.length; i++) {
        const msgTop = messages[i].getBoundingClientRect().top - containerRect.top + scrollTop;
        if (msgTop <= scrollTop + 60) {
          current = i + 1;
        }
      }

      this.counterEl.textContent = current > 0 ? `${current}/${total}` : `${total}`;
    }

    // ---- 滚动 ----

    scrollToTop() {
      this.scrollContainer.scrollTo({ top: 0, behavior: SETTINGS.scrollMode });
    }

    scrollToBottom() {
      this.scrollContainer.scrollTo({ top: this.scrollContainer.scrollHeight, behavior: SETTINGS.scrollMode });
    }

    scrollToMessage(direction) {
      const messages = findUserMessages();
      if (messages.length === 0) return;

      const scrollTop = this.scrollContainer.scrollTop;
      const containerRect = this.scrollContainer.getBoundingClientRect();
      const threshold = 30;
      const behavior = SETTINGS.scrollMode;

      if (direction === 'prev') {
        for (let i = messages.length - 1; i >= 0; i--) {
          const msgTop = messages[i].getBoundingClientRect().top - containerRect.top + scrollTop;
          if (msgTop < scrollTop - threshold) {
            this.scrollContainer.scrollTo({ top: msgTop - 10, behavior });
            this.highlightMessage(messages[i]);
            return;
          }
        }
        this.scrollToTop();
      } else {
        for (let i = 0; i < messages.length; i++) {
          const msgTop = messages[i].getBoundingClientRect().top - containerRect.top + scrollTop;
          if (msgTop > scrollTop + threshold) {
            this.scrollContainer.scrollTo({ top: msgTop - 10, behavior });
            this.highlightMessage(messages[i]);
            return;
          }
        }
        this.scrollToBottom();
      }
    }

    // ---- 高亮 ----

    highlightMessage(el) {
      el.classList.remove('chatdot-highlight');
      void el.offsetWidth;
      el.classList.add('chatdot-highlight');
      setTimeout(() => el.classList.remove('chatdot-highlight'), 800);
    }

    // ---- DOM 监听 ----

    observeDOM() {
      const target = this.scrollContainer.parentElement || document.querySelector('main');
      if (!target) return;

      this.observer = new MutationObserver((mutations) => {
        let hasChange = false;
        for (const m of mutations) {
          if (m.type === 'childList' && m.addedNodes.length > 0) {
            hasChange = true;
            break;
          }
        }
        if (hasChange) {
          this.updateVisibility();
          this.updateCounter();
        }
      });

      this.observer.observe(target, { childList: true, subtree: true });
    }

    // ---- SPA 路由 ----

    watchRouteChange() {
      let lastUrl = location.href;
      const self = this;

      const onRouteChange = () => {
        if (location.href !== lastUrl) {
          lastUrl = location.href;
          console.log(LOG_PREFIX, '检测到路由变化，重新初始化…');
          self.reinitialize();
        }
      };

      window.addEventListener('popstate', onRouteChange);

      const origPush = history.pushState;
      const origReplace = history.replaceState;

      history.pushState = function (...args) {
        origPush.apply(this, args);
        setTimeout(onRouteChange, 300);
      };

      history.replaceState = function (...args) {
        origReplace.apply(this, args);
        setTimeout(onRouteChange, 300);
      };
    }

    reinitialize() {
      this.destroy();
      this.retryCount = 0;
      setTimeout(() => this.init(), 500);
    }

    // ---- 清理 ----

    destroy() {
      if (this.scrollHandler && this.scrollContainer) {
        this.scrollContainer.removeEventListener('scroll', this.scrollHandler);
      }
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      if (this.container) {
        this.container.remove();
        this.container = null;
      }
      this.counterEl = null;
      this.prevPreview = null;
      this.nextPreview = null;
      this.scrollContainer = null;
    }
  }

  // ============================================
  // 5. 启动
  // ============================================

  loadSettings(() => {
    const nav = new NavigationSidebar();
    nav.init();
    nav.watchRouteChange();
    window.__chatdotNav = nav;
  });

})();
