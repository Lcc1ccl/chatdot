const assert = require('node:assert/strict');

const {
  CHROME_WEBSTORE_EXTENSION_ID,
  getStoreReviewUrl,
  getChangelogEntries,
  getTranslations,
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
  assert.equal(entries[0].version, 'v1.1.0');
  assert.equal(entries[0].items[0], '新增 Gemini / Claude / DeepSeek / 豆包平台支持');
});

run('getTranslations exposes new popup CTA and changelog strings', () => {
  const zh = getTranslations('zh');
  const en = getTranslations('en');

  assert.equal(zh.review_support, '好评支持');
  assert.equal(en.review_support, 'Leave a Review');
  assert.equal(zh.changelog_title, '更新日志');
  assert.equal(en.changelog_empty, 'No updates yet.');
});
