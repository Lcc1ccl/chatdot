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
 *  8. 大纲面板（点击展开，列出所有用户消息索引）
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
    showOutline: true,
  };

  function loadSettings(callback) {
    if (chrome?.storage?.sync) {
      chrome.storage.sync.get(SETTINGS, (data) => {
        Object.assign(SETTINGS, data);
        if (callback) callback();
      });
    } else {
      if (callback) callback();
    }
  }

  if (chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'settingsChanged') {
        if (msg.enabled !== undefined) SETTINGS.enabled = msg.enabled;
        if (msg.scrollMode !== undefined) SETTINGS.scrollMode = msg.scrollMode;
        if (msg.showPreview !== undefined) SETTINGS.showPreview = msg.showPreview;
        if (msg.showOutline !== undefined) SETTINGS.showOutline = msg.showOutline;

        if (window.__chatdotNav) {
          if (SETTINGS.enabled) {
            window.__chatdotNav.init();
          } else {
            window.__chatdotNav.destroy();
          }
          // 大纲开关立即生效
          if (window.__chatdotNav.outlinePanel) {
            window.__chatdotNav.outlinePanel.style.display =
              SETTINGS.showOutline ? '' : 'none';
            if (window.__chatdotNav.outlineToggleBtn) {
              window.__chatdotNav.outlineToggleBtn.style.display =
                SETTINGS.showOutline ? '' : 'none';
            }
          }
        }
      }
    });
  }

  // ============================================
  // 1. 选择器配置
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
      } catch (_) {}
    }
    return [];
  }

  function findScrollContainer() {
    for (const sel of PLATFORM_SELECTORS.chatgpt.scrollContainer) {
      try {
        const el = document.querySelector(sel);
        if (el && el.scrollHeight > el.clientHeight) return el;
      } catch (_) {}
    }
    const main = document.querySelector('main');
    if (main) {
      const divs = main.querySelectorAll('div');
      for (const el of divs) {
        const s = getComputedStyle(el);
        if (
          (s.overflowY === 'auto' || s.overflowY === 'scroll') &&
          el.scrollHeight > el.clientHeight + 100
        ) return el;
      }
    }
    return null;
  }

  function findUserMessages() {
    return queryAll(PLATFORM_SELECTORS.chatgpt.userMessage);
  }

  function extractMessageText(msgEl, maxLen = 80) {
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
    list: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
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
      this.outlinePanel = null;
      this.outlineList = null;
      this.outlineToggleBtn = null;
      this.outlineOpen = false;
      this.scrollContainer = null;
      this.scrollHandler = null;
      this.observer = null;
      this.retryCount = 0;
      this.maxRetries = 30;
    }

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
      const existingOutline = document.querySelector('.chatdot-outline-panel');
      if (existingOutline) existingOutline.remove();

      this.container = document.createElement('div');
      this.container.className = 'chatdot-nav-sidebar';

      // ---- 大纲按钮（顶部）----
      const outlineBtn = document.createElement('button');
      outlineBtn.className = 'chatdot-nav-btn chatdot-nav-btn-outline';
      outlineBtn.innerHTML = ICONS.list;
      outlineBtn.title = '大纲';
      outlineBtn.setAttribute('aria-label', '大纲');
      outlineBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleOutline();
      });
      this.outlineToggleBtn = outlineBtn;
      if (!SETTINGS.showOutline) outlineBtn.style.display = 'none';
      this.container.appendChild(outlineBtn);

      // ---- 导航按钮 ----
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

          wrapper.addEventListener('mouseenter', () => {
            if (!SETTINGS.showPreview) { previewEl.innerHTML = ''; return; }
            // 抑制浏览器原生 title tooltip
            btn.dataset.originalTitle = btn.title;
            btn.title = '';
            this.updatePreview(preview, previewEl);
          });
          wrapper.addEventListener('mouseleave', () => {
            // 恢复原生 title
            if (btn.dataset.originalTitle) {
              btn.title = btn.dataset.originalTitle;
            }
          });
        } else {
          this.container.appendChild(btn);
        }

        if (i === 1) {
          this.counterEl = document.createElement('div');
          this.counterEl.className = 'chatdot-nav-counter';
          this.counterEl.textContent = '';
          this.container.appendChild(this.counterEl);
        }
      });

      document.body.appendChild(this.container);

      // ---- 大纲面板 ----
      this.createOutlinePanel();
    }

    // ---- 大纲面板 ----

    createOutlinePanel() {
      const panel = document.createElement('div');
      panel.className = 'chatdot-outline-panel';

      const header = document.createElement('div');
      header.className = 'chatdot-outline-header';

      const title = document.createElement('span');
      title.className = 'chatdot-outline-title';
      title.textContent = '大纲';

      const closeBtn = document.createElement('button');
      closeBtn.className = 'chatdot-outline-close';
      closeBtn.innerHTML = '×';
      closeBtn.addEventListener('click', () => this.toggleOutline(false));

      header.appendChild(title);
      header.appendChild(closeBtn);
      panel.appendChild(header);

      const list = document.createElement('div');
      list.className = 'chatdot-outline-list';
      panel.appendChild(list);

      this.outlineList = list;
      this.outlinePanel = panel;

      if (!SETTINGS.showOutline) panel.style.display = 'none';

      document.body.appendChild(panel);
    }

    toggleOutline(forceTo) {
      this.outlineOpen = (forceTo !== undefined) ? forceTo : !this.outlineOpen;
      this.outlinePanel.classList.toggle('open', this.outlineOpen);
      this.outlineToggleBtn.classList.toggle('active', this.outlineOpen);
      if (this.outlineOpen) {
        this.refreshOutline();
      }
    }

    refreshOutline() {
      if (!this.outlineList) return;
      const messages = findUserMessages();
      this.outlineList.innerHTML = '';

      if (messages.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'chatdot-outline-empty';
        empty.textContent = '暂无用户消息';
        this.outlineList.appendChild(empty);
        return;
      }

      // 找当前可见索引
      const scrollTop = this.scrollContainer.scrollTop;
      const containerRect = this.scrollContainer.getBoundingClientRect();
      let activeIdx = 0;
      for (let i = 0; i < messages.length; i++) {
        const msgTop = messages[i].getBoundingClientRect().top - containerRect.top + scrollTop;
        if (msgTop <= scrollTop + 80) activeIdx = i;
      }

      messages.forEach((msg, idx) => {
        const item = document.createElement('div');
        item.className = 'chatdot-outline-item';
        if (idx === activeIdx) item.classList.add('active');

        const num = document.createElement('span');
        num.className = 'chatdot-outline-num';
        num.textContent = idx + 1;

        const text = document.createElement('span');
        text.className = 'chatdot-outline-text';
        text.textContent = extractMessageText(msg, 60);

        item.appendChild(num);
        item.appendChild(text);

        item.addEventListener('click', () => {
          const msgTop = msg.getBoundingClientRect().top - containerRect.top + this.scrollContainer.scrollTop;
          this.scrollContainer.scrollTo({ top: msgTop - 10, behavior: SETTINGS.scrollMode });
          this.highlightMessage(msg);
          // 更新 active 状态
          this.outlineList.querySelectorAll('.chatdot-outline-item').forEach(el =>
            el.classList.remove('active'));
          item.classList.add('active');
        });

        this.outlineList.appendChild(item);
      });
    }

    // ---- 消息预览 ----

    updatePreview(direction, previewEl) {
      const messages = findUserMessages();
      if (messages.length === 0) { previewEl.innerHTML = ''; return; }

      const scrollTop = this.scrollContainer.scrollTop;
      const containerRect = this.scrollContainer.getBoundingClientRect();
      const threshold = 30;
      let target = null;
      const dirLabel = direction === 'prev' ? '⬆ 上一条' : '⬇ 下一条';

      if (direction === 'prev') {
        for (let i = messages.length - 1; i >= 0; i--) {
          const msgTop = messages[i].getBoundingClientRect().top - containerRect.top + scrollTop;
          if (msgTop < scrollTop - threshold) { target = messages[i]; break; }
        }
      } else {
        for (let i = 0; i < messages.length; i++) {
          const msgTop = messages[i].getBoundingClientRect().top - containerRect.top + scrollTop;
          if (msgTop > scrollTop + threshold) { target = messages[i]; break; }
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
        // 如果大纲面板打开，实时更新 active
        if (this.outlineOpen) this.refreshOutline();
      };
      this.scrollContainer.addEventListener('scroll', this.scrollHandler, { passive: true });
    }

    updateVisibility() {
      if (!this.scrollContainer || !this.container) return;
      const { scrollHeight, clientHeight } = this.scrollContainer;
      const isScrollable = scrollHeight > clientHeight + 50;
      this.container.classList.toggle('visible', isScrollable);
    }

    updateCounter() {
      if (!this.counterEl) return;
      const messages = findUserMessages();
      const total = messages.length;
      if (total === 0) { this.counterEl.textContent = ''; return; }

      const scrollTop = this.scrollContainer.scrollTop;
      const containerRect = this.scrollContainer.getBoundingClientRect();
      let current = 0;
      for (let i = 0; i < messages.length; i++) {
        const msgTop = messages[i].getBoundingClientRect().top - containerRect.top + scrollTop;
        if (msgTop <= scrollTop + 60) current = i + 1;
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
          if (m.type === 'childList' && m.addedNodes.length > 0) { hasChange = true; break; }
        }
        if (hasChange) {
          this.updateVisibility();
          this.updateCounter();
          if (this.outlineOpen) this.refreshOutline();
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

    destroy() {
      if (this.scrollHandler && this.scrollContainer) {
        this.scrollContainer.removeEventListener('scroll', this.scrollHandler);
      }
      if (this.observer) { this.observer.disconnect(); this.observer = null; }
      if (this.container) { this.container.remove(); this.container = null; }
      if (this.outlinePanel) { this.outlinePanel.remove(); this.outlinePanel = null; }
      this.counterEl = null;
      this.prevPreview = null;
      this.nextPreview = null;
      this.outlineList = null;
      this.outlineToggleBtn = null;
      this.outlineOpen = false;
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
