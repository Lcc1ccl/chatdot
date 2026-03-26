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

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function resolveActiveIndex(anchorTops, options = {}) {
    if (!Array.isArray(anchorTops) || anchorTops.length === 0) {
      return -1;
    }

    const safeOffset = options.safeOffset ?? DEFAULT_SAFE_OFFSET;
    const bottomEpsilon = options.bottomEpsilon ?? DEFAULT_BOTTOM_EPSILON;
    const maxScrollTop = Math.max(0, options.maxScrollTop ?? 0);
    const scrollTop = Math.max(0, options.scrollTop ?? 0);

    if (scrollTop >= maxScrollTop - bottomEpsilon) {
      return anchorTops.length - 1;
    }

    const threshold = scrollTop + safeOffset;
    let current = 0;

    for (let i = 0; i < anchorTops.length; i++) {
      if (anchorTops[i] <= threshold) {
        current = i;
      } else {
        break;
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

  function requiresPostScrollSync(scrollMode) {
    return scrollMode === 'instant';
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
    clamp,
    pickBestBindingCandidate,
    resolveActiveIndex,
    resolveAdjacentIndex,
    resolveScrollTarget,
    requiresPostScrollSync,
    scoreBindingCandidate,
  };
});
