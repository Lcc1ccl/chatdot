(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.ChatDotNavLogic = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_SAFE_OFFSET = 88;
  const DEFAULT_BOTTOM_EPSILON = 24;
  const DEFAULT_ACTIVE_EPSILON = 8;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function resolveActiveIndex(anchorTops, options = {}) {
    if (!Array.isArray(anchorTops) || anchorTops.length === 0) {
      return -1;
    }

    const safeOffset = options.safeOffset ?? DEFAULT_SAFE_OFFSET;
    const activeEpsilon = Math.max(0, options.activeEpsilon ?? DEFAULT_ACTIVE_EPSILON);
    const bottomEpsilon = options.bottomEpsilon ?? DEFAULT_BOTTOM_EPSILON;
    const maxScrollTop = Math.max(0, options.maxScrollTop ?? 0);
    const scrollTop = Math.max(0, options.scrollTop ?? 0);

    if (scrollTop >= maxScrollTop - bottomEpsilon) {
      return anchorTops.length - 1;
    }

    const threshold = scrollTop + safeOffset;
    let current = -1;

    for (let i = 0; i < anchorTops.length; i++) {
      if (anchorTops[i] <= threshold) {
        current = i;
      } else {
        break;
      }
    }

    if (current === -1) {
      return 0;
    }

    // Programmatic smooth scroll can land a few pixels short of the safe line.
    const nextTop = anchorTops[current + 1];
    if (typeof nextTop === 'number') {
      const nextDistance = nextTop - threshold;
      if (nextDistance > 0 && nextDistance <= activeEpsilon) {
        return current + 1;
      }
    }

    return current;
  }

  function resolveAdjacentIndex(currentIndex, direction, total) {
    if (!Number.isInteger(total) || total <= 0) {
      return -1;
    }

    const fallback = direction === 'prev' ? total - 1 : 0;
    if (!Number.isInteger(currentIndex) || currentIndex < 0) {
      return fallback;
    }

    const baseIndex = clamp(currentIndex, 0, total - 1);

    if (direction === 'prev') {
      return clamp(baseIndex - 1, 0, total - 1);
    }

    if (direction === 'next') {
      return clamp(baseIndex + 1, 0, total - 1);
    }

    return baseIndex;
  }

  function resolveScrollTarget(anchorTop, options = {}) {
    const safeOffset = options.safeOffset ?? DEFAULT_SAFE_OFFSET;
    const maxScrollTop = Math.max(0, options.maxScrollTop ?? 0);
    return clamp(Math.max(0, anchorTop - safeOffset), 0, maxScrollTop);
  }

  function resolveTrimWindow(total, keep) {
    const normalizedTotal = Math.max(0, Number.isFinite(total) ? Math.floor(total) : 0);
    const normalizedKeep = Math.max(1, Number.isFinite(keep) ? Math.floor(keep) : 1);
    const visible = normalizedTotal === 0 ? 0 : Math.min(normalizedTotal, normalizedKeep);
    const start = Math.max(0, normalizedTotal - visible);

    return {
      total: normalizedTotal,
      keep: normalizedKeep,
      start,
      visible,
      hidden: normalizedTotal - visible,
    };
  }

  function normalizeTrimKeepTurns(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return 1;
    }

    return Math.max(1, Math.floor(parsed));
  }

  function resolveTrimSignature(settings = {}) {
    return [
      Boolean(settings.trimEnabled) ? 1 : 0,
      Boolean(settings.trimAutoApply) ? 1 : 0,
      normalizeTrimKeepTurns(settings.trimKeepTurns),
    ].join(':');
  }

  function shouldApplyTrim(options = {}) {
    const forceApply = Boolean(options.forceApply);
    const trimSuppressed = Boolean(options.trimSuppressed);
    const autoApply = Boolean(options.autoApply);
    const previousTotal = Math.max(0, options.previousTotal ?? 0);
    const currentTotal = Math.max(0, options.currentTotal ?? 0);
    const applied = Boolean(options.applied);
    const hasNewTurns = currentTotal > previousTotal;

    if (forceApply) {
      return true;
    }

    if (trimSuppressed && !hasNewTurns) {
      return false;
    }

    if (autoApply && hasNewTurns) {
      return true;
    }

    if (!applied && !trimSuppressed) {
      return true;
    }

    return false;
  }

  function shouldForceTrimOnSettingsChange(options = {}) {
    return Boolean(options.trimEnabledChanged) && Boolean(options.trimEnabled);
  }

  function requiresPostScrollSync(scrollMode) {
    return scrollMode === 'instant';
  }

  function resolveScrollStrategy(platform) {
    return platform === 'doubao' ? 'element' : 'container';
  }

  function resolveVisualActiveIndex(anchorRects, options = {}) {
    if (!Array.isArray(anchorRects) || anchorRects.length === 0) {
      return -1;
    }

    const safeOffset = options.safeOffset ?? DEFAULT_SAFE_OFFSET;
    const containerTop = options.containerTop ?? 0;
    const containerBottom = options.containerBottom ?? Infinity;
    const threshold = containerTop + safeOffset;
    let bestIndex = -1;
    let bestDistance = Infinity;

    for (let i = 0; i < anchorRects.length; i++) {
      const rect = anchorRects[i] || {};
      const top = Number(rect.top);
      const bottom = Number(rect.bottom);

      if (!Number.isFinite(top) || !Number.isFinite(bottom)) {
        continue;
      }

      if (bottom < containerTop || top > containerBottom) {
        continue;
      }

      const distance = Math.abs(top - threshold);
      if (distance < bestDistance) {
        bestIndex = i;
        bestDistance = distance;
      }
    }

    if (bestIndex >= 0) {
      return bestIndex;
    }

    const currentIndex = options.currentIndex;
    if (Number.isInteger(currentIndex) && currentIndex >= 0 && currentIndex < anchorRects.length) {
      return currentIndex;
    }

    return 0;
  }

  function scoreBindingCandidate(candidate = {}) {
    const isConnected = candidate.isConnected !== false;
    const isVisible = Boolean(candidate.isVisible);
    const isInViewport = Boolean(candidate.isInViewport);
    const visibleArea = Math.max(0, candidate.visibleArea ?? 0);
    const messageCount = Math.max(0, candidate.messageCount ?? 0);
    const scrollDistance = Math.max(0, candidate.scrollDistance ?? 0);

    return (isConnected ? 1_000_000_000_000 : 0)
      + (isVisible ? 100_000_000_000 : 0)
      + (isInViewport ? 10_000_000_000 : 0)
      + (messageCount * 1_000_000)
      + (visibleArea * 10)
      + scrollDistance;
  }

  function pickBestBindingCandidate(candidates) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return null;
    }

    let bestCandidate = null;
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }

      const score = scoreBindingCandidate(candidate);
      if (score > bestScore) {
        bestCandidate = candidate;
        bestScore = score;
      }
    }

    return bestCandidate;
  }

  return {
    DEFAULT_SAFE_OFFSET,
    DEFAULT_BOTTOM_EPSILON,
    DEFAULT_ACTIVE_EPSILON,
    clamp,
    pickBestBindingCandidate,
    resolveActiveIndex,
    resolveAdjacentIndex,
    resolveTrimWindow,
    resolveTrimSignature,
    shouldForceTrimOnSettingsChange,
    shouldApplyTrim,
    resolveScrollStrategy,
    resolveScrollTarget,
    resolveVisualActiveIndex,
    requiresPostScrollSync,
    scoreBindingCandidate,
  };
});
