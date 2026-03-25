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
 */

(function () {
  'use strict';

  const LOG_PREFIX = '[ChatDot Nav]';

  // ============================================
  // 1. 选择器配置 — 多层降级策略
  // ============================================

  const PLATFORM_SELECTORS = {
    chatgpt: {
      scrollContainer: [
        // 2026-03 版本的主要选择器
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

  function queryFirst(selectors, root = document) {
    for (const sel of selectors) {
      try {
        const el = root.querySelector(sel);
        if (el) return el;
      } catch (_) { /* 选择器不合法则跳过 */ }
    }
    return null;
  }

  function queryAll(selectors, root = document) {
    for (const sel of selectors) {
      try {
        const els = root.querySelectorAll(sel);
        if (els.length > 0) return Array.from(els);
      } catch (_) { /* skip */ }
    }
    return [];
  }

  /**
   * 智能查找滚动容器：精确选择器 → main 区域动态检测
   */
  function findScrollContainer() {
    // 策略 1：精确选择器
    for (const sel of PLATFORM_SELECTORS.chatgpt.scrollContainer) {
      try {
        const el = document.querySelector(sel);
        if (el && el.scrollHeight > el.clientHeight) return el;
      } catch (_) { /* skip */ }
    }

    // 策略 2：在 main 内查找可滚动元素
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

  // ============================================
  // 3. SVG 图标（内联，Lucide 风格）
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
      this.scrollContainer = null;
      this.scrollHandler = null;
      this.observer = null;
      this.retryCount = 0;
      this.maxRetries = 30;
      this.currentIndex = -1;
    }

    // ---- 初始化 ----

    init() {
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
      this.observeDOM();
      console.log(LOG_PREFIX, '导航侧边栏已加载 ✓');
    }

    // ---- UI 构建 ----

    createUI() {
      // 防止重复
      const existing = document.querySelector('.chatdot-nav-sidebar');
      if (existing) existing.remove();

      this.container = document.createElement('div');
      this.container.className = 'chatdot-nav-sidebar';

      const buttons = [
        { cls: 'chatdot-nav-btn-top', icon: ICONS.chevronsUp, label: '跳到顶部', action: () => this.scrollToTop() },
        { cls: 'chatdot-nav-btn-prev', icon: ICONS.chevronUp, label: '上一条用户消息', action: () => this.scrollToMessage('prev') },
        { cls: 'chatdot-nav-btn-next', icon: ICONS.chevronDown, label: '下一条用户消息', action: () => this.scrollToMessage('next') },
        { cls: 'chatdot-nav-btn-bottom', icon: ICONS.chevronsDown, label: '跳到底部', action: () => this.scrollToBottom() },
      ];

      buttons.forEach(({ cls, icon, label, action }, i) => {
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
        this.container.appendChild(btn);

        // 在上/下按钮之间插入计数器
        if (i === 1) {
          this.counterEl = document.createElement('div');
          this.counterEl.className = 'chatdot-nav-counter';
          this.counterEl.textContent = '';
          this.container.appendChild(this.counterEl);
        }
      });

      document.body.appendChild(this.container);
    }

    // ---- 事件绑定 ----

    bindEvents() {
      this.scrollHandler = () => {
        this.updateVisibility();
        this.updateCounter();
      };
      this.scrollContainer.addEventListener('scroll', this.scrollHandler, { passive: true });
    }

    // ---- 可见性 ——移植自 Claudian ----

    updateVisibility() {
      if (!this.scrollContainer || !this.container) return;
      const { scrollHeight, clientHeight } = this.scrollContainer;
      const isScrollable = scrollHeight > clientHeight + 50;
      this.container.classList.toggle('visible', isScrollable);
    }

    // ---- 计数器更新 ----

    updateCounter() {
      if (!this.counterEl) return;
      const messages = findUserMessages();
      const total = messages.length;
      if (total === 0) {
        this.counterEl.textContent = '';
        return;
      }

      // 找到当前最近可见的用户消息索引
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

    // ---- 滚动操作 ----

    scrollToTop() {
      this.scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }

    scrollToBottom() {
      this.scrollContainer.scrollTo({ top: this.scrollContainer.scrollHeight, behavior: 'smooth' });
    }

    /**
     * 跳转到上/下一条用户消息
     * 核心算法移植自 Claudian NavigationSidebar.scrollToMessage()
     *
     * 差异：使用 getBoundingClientRect() 代替 offsetTop
     *       以兼容嵌套滚动容器场景
     */
    scrollToMessage(direction) {
      const messages = findUserMessages();
      if (messages.length === 0) return;

      const scrollTop = this.scrollContainer.scrollTop;
      const containerRect = this.scrollContainer.getBoundingClientRect();
      const threshold = 30;

      if (direction === 'prev') {
        for (let i = messages.length - 1; i >= 0; i--) {
          const msgTop = messages[i].getBoundingClientRect().top - containerRect.top + scrollTop;
          if (msgTop < scrollTop - threshold) {
            this.scrollContainer.scrollTo({ top: msgTop - 10, behavior: 'smooth' });
            this.highlightMessage(messages[i]);
            return;
          }
        }
        this.scrollToTop();
      } else {
        for (let i = 0; i < messages.length; i++) {
          const msgTop = messages[i].getBoundingClientRect().top - containerRect.top + scrollTop;
          if (msgTop > scrollTop + threshold) {
            this.scrollContainer.scrollTo({ top: msgTop - 10, behavior: 'smooth' });
            this.highlightMessage(messages[i]);
            return;
          }
        }
        this.scrollToBottom();
      }
    }

    // ---- 跳转高亮反馈 ----

    highlightMessage(el) {
      el.classList.remove('chatdot-highlight');
      void el.offsetWidth; // 触发 reflow 重播动画
      el.classList.add('chatdot-highlight');
      setTimeout(() => el.classList.remove('chatdot-highlight'), 800);
    }

    // ---- DOM 变更监听 ----

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

    // ---- SPA 路由感知 ----

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

      // Hook pushState / replaceState
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
      this.scrollContainer = null;
    }
  }

  // ============================================
  // 5. 启动
  // ============================================

  const nav = new NavigationSidebar();
  nav.init();
  nav.watchRouteChange();

})();
