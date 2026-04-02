const assert = require('node:assert/strict');

const {
  pickBestBindingCandidate,
  resolveActiveIndex,
  resolveAdjacentIndex,
  resolveScrollTarget,
  requiresPostScrollSync,
} = require('../navigation-logic.js');

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

run('resolveActiveIndex returns last item at page bottom', () => {
  const index = resolveActiveIndex([120, 560, 1040], {
    scrollTop: 1600,
    maxScrollTop: 1600,
    safeOffset: 88,
    bottomEpsilon: 24,
  });

  assert.equal(index, 2);
});

run('resolveActiveIndex tolerates minor scroll rounding after landing on a target message', () => {
  const index = resolveActiveIndex([120, 560, 1040], {
    scrollTop: 471,
    maxScrollTop: 1600,
    safeOffset: 88,
    bottomEpsilon: 24,
  });

  assert.equal(index, 1);
});

run('resolveAdjacentIndex moves to previous item from the last active message', () => {
  const index = resolveAdjacentIndex(2, 'prev', 3);
  assert.equal(index, 1);
});

run('resolveAdjacentIndex falls back to the list edge when active index is unknown', () => {
  assert.equal(resolveAdjacentIndex(-1, 'prev', 3), 2);
  assert.equal(resolveAdjacentIndex(-1, 'next', 3), 0);
});

run('resolveScrollTarget keeps a safe distance from the top edge', () => {
  const target = resolveScrollTarget(560, {
    safeOffset: 88,
    maxScrollTop: 1200,
  });

  assert.equal(target, 472);
});

run('requiresPostScrollSync adds a follow-up sync for instant jumps only', () => {
  assert.equal(requiresPostScrollSync('instant'), true);
  assert.equal(requiresPostScrollSync('smooth'), false);
});

run('pickBestBindingCandidate prefers the visible in-viewport container', () => {
  const hidden = { id: 'hidden', isConnected: true, isVisible: false, isInViewport: false, visibleArea: 0, messageCount: 40, scrollDistance: 3200 };
  const visible = { id: 'visible', isConnected: true, isVisible: true, isInViewport: true, visibleArea: 280000, messageCount: 12, scrollDistance: 2200 };

  const result = pickBestBindingCandidate([hidden, visible]);

  assert.equal(result, visible);
});
