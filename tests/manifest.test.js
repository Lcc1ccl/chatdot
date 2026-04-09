const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const manifest = require('../manifest.json');
const { getChangelogEntries } = require('../popup-logic.js');

const popupHtml = fs.readFileSync(path.join(__dirname, '..', 'popup.html'), 'utf8');

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

run('manifest injects only the currently supported AI chat hosts', () => {
  const matches = manifest.content_scripts.flatMap((entry) => entry.matches || []);

  assert.deepEqual(matches, [
    'https://chatgpt.com/*',
    'https://chat.openai.com/*',
    'https://gemini.google.com/*',
    'https://claude.ai/*',
    'https://www.doubao.com/*',
  ]);
});

run('manifest uses Chrome i18n placeholders and declares a default locale', () => {
  assert.equal(manifest.default_locale, 'zh_CN');
  assert.equal(manifest.name, '__MSG_extName__');
  assert.equal(manifest.description, '__MSG_extDescription__');
});

run('manifest keeps localized metadata in action as well', () => {
  assert.equal(manifest.action.default_title, '__MSG_extActionTitle__');
});
run('manifest version stays in sync with popup fallback text and latest changelog entry', () => {
  const popupVersion = popupHtml.match(/<span id="version-num">([^<]+)<\/span>/)?.[1];
  const latestChangelogVersion = getChangelogEntries('zh')[0]?.version?.replace(/^v/, '');

  assert.equal(popupVersion, manifest.version);
  assert.equal(latestChangelogVersion, manifest.version);
});
