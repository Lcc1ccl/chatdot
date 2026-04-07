const assert = require('node:assert/strict');
const manifest = require('../manifest.json');

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
