const assert = require('node:assert/strict');

const {
  CHROME_WEBSTORE_EXTENSION_ID,
  getTrimControlState,
  getStoreReviewUrl,
  getChangelogEntries,
  getTranslations,
  isTrimStatsUnavailable,
  resolveTrimSettingsChange,
} = require('../popup-logic.js');

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

run('getStoreReviewUrl returns the official reviews URL for the published extension', () => {
  assert.equal(CHROME_WEBSTORE_EXTENSION_ID, 'hggdbhpanmlbbomkcjijfjmpbobpabme');
  assert.equal(
    getStoreReviewUrl(),
    'https://chromewebstore.google.com/detail/chatdot/hggdbhpanmlbbomkcjijfjmpbobpabme/reviews'
  );
});

run('getChangelogEntries falls back to English for Japanese and Korean', () => {
  const enEntries = getChangelogEntries('en');
  assert.deepEqual(getChangelogEntries('ja'), enEntries);
  assert.deepEqual(getChangelogEntries('ko'), enEntries);
});

run('getChangelogEntries keeps Chinese copy for Chinese UI', () => {
  const entries = getChangelogEntries('zh');
  assert.equal(entries[0].version, 'v1.2.0');
  assert.match(entries[0].items.join(' '), /精简|保留|大纲/);
});

run('getTranslations exposes new popup CTA and changelog strings', () => {
  const zh = getTranslations('zh');
  const en = getTranslations('en');

  assert.equal(zh.review_support, '好评支持');
  assert.equal(en.review_support, 'Leave a Review');
  assert.equal(zh.changelog_title, '更新日志');
  assert.equal(en.changelog_empty, 'No updates yet.');
});

run('latest changelog entry reflects the conversation trimming release', () => {
  const zhEntry = getChangelogEntries('zh')[0];
  const enEntry = getChangelogEntries('en')[0];

  assert.equal(zhEntry.version, 'v1.2.0');
  assert.match(zhEntry.items.join(' '), /精简|保留/);

  assert.equal(enEntry.version, 'v1.2.0');
  assert.match(enEntry.items.join(' '), /trim/i);
});

run('isTrimStatsUnavailable treats missing stats as unavailable', () => {
  assert.equal(isTrimStatsUnavailable(null), true);
  assert.equal(isTrimStatsUnavailable(undefined), true);
});

run('isTrimStatsUnavailable treats explicit unsupported stats as unavailable', () => {
  assert.equal(isTrimStatsUnavailable({ supported: false }), true);
  assert.equal(isTrimStatsUnavailable({ supported: true, total: 0 }), false);
});

run('getTrimControlState keeps turns-to-keep editable even when trim is unavailable on the current page', () => {
  assert.deepEqual(getTrimControlState(null), {
    unavailable: true,
    keepDisabled: false,
    autoDisabled: true,
    applyDisabled: true,
    restoreDisabled: true,
  });
});

run('getTrimControlState keeps manual trim available whenever the page supports trimming', () => {
  assert.deepEqual(getTrimControlState({
    supported: true,
    applied: false,
    hidden: 0,
  }), {
    unavailable: false,
    keepDisabled: false,
    autoDisabled: false,
    applyDisabled: false,
    restoreDisabled: true,
  });
});

run('getTrimControlState keeps restore available when a trimmed conversation can be restored', () => {
  assert.deepEqual(getTrimControlState({
    supported: true,
    applied: true,
    hidden: 4,
  }), {
    unavailable: false,
    keepDisabled: false,
    autoDisabled: false,
    applyDisabled: false,
    restoreDisabled: false,
  });
});

run('resolveTrimSettingsChange enables trim when auto trim is turned on', () => {
  assert.deepEqual(resolveTrimSettingsChange({
    trimEnabled: false,
    trimKeepTurns: 10,
    trimAutoApply: false,
  }, {
    trimAutoApply: true,
  }), {
    trimEnabled: true,
    trimKeepTurns: 10,
    trimAutoApply: true,
  });
});

run('resolveTrimSettingsChange keeps trim disabled when auto trim is off', () => {
  assert.deepEqual(resolveTrimSettingsChange({
    trimEnabled: true,
    trimKeepTurns: 10,
    trimAutoApply: true,
  }, {
    trimAutoApply: false,
  }), {
    trimEnabled: false,
    trimKeepTurns: 10,
    trimAutoApply: false,
  });
});
