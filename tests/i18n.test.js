const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  applyLocalizedControlLabel,
  flattenLocaleMessages,
  getEmbeddedMessages,
  loadLocaleMessages,
} = require('../localization.js');

async function run(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function loadMessages(locale) {
  const filePath = path.join(__dirname, '..', '_locales', locale, 'messages.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const REQUIRED_LOCALES = ['zh_CN', 'en', 'ja', 'ko'];
const REQUIRED_KEYS = [
  'extName',
  'extDescription',
  'extActionTitle',
  'enable_nav',
  'show_preview',
  'show_preview_desc',
  'show_outline',
  'show_outline_desc',
  'trim_history',
  'trim_history_desc',
  'trim_keep_turns',
  'trim_keep_turns_desc',
  'trim_auto_apply',
  'trim_auto_apply_desc',
  'trim_apply',
  'trim_restore',
  'trim_stats_inactive',
  'trim_stats_unsupported',
  'trim_stats_kept',
  'trim_stats_total',
  'trim_stats_hidden',
  'trim_turn_unit',
  'trim_more_settings',
  'trim_more_settings_desc',
  'trim_auto_mode_off',
  'trim_auto_mode_on',
  'display_mode',
  'display_mode_desc',
  'theme_light',
  'theme_dark',
  'theme_system',
  'scroll_mode',
  'smooth',
  'instant',
  'status_active',
  'status_inactive',
  'version',
  'review_support',
  'review_support_desc',
  'github_repo',
  'changelog_title',
  'changelog_empty',
  'changelog_open',
  'changelog_close',
  'language_button',
  'outline_title',
  'outline_pin',
  'outline_close',
  'jump_top',
  'jump_prev_user',
  'jump_next_user',
  'jump_bottom',
  'outline_empty',
  'preview_prev',
  'preview_next',
  'preview_at_top',
  'preview_at_bottom',
];

async function main() {
  await run('all supported locale catalogs exist', () => {
    REQUIRED_LOCALES.forEach((locale) => {
      const filePath = path.join(__dirname, '..', '_locales', locale, 'messages.json');
      assert.equal(fs.existsSync(filePath), true, `${locale} catalog should exist`);
    });
  });

  await run('all supported locale catalogs provide the required message keys', () => {
    REQUIRED_LOCALES.forEach((locale) => {
      const messages = loadMessages(locale);
      REQUIRED_KEYS.forEach((key) => {
        assert.equal(typeof messages[key]?.message, 'string', `${locale}.${key} should be a string message`);
        assert.notEqual(messages[key].message.trim(), '', `${locale}.${key} should not be empty`);
      });
    });
  });

  await run('applyLocalizedControlLabel updates title, aria-label, and cached hover title together', () => {
    const attrs = {};
    const button = {
      title: '上一条用户消息',
      dataset: {
        originalTitle: '上一条用户消息',
      },
      setAttribute(name, value) {
        attrs[name] = value;
      },
    };

    applyLocalizedControlLabel(button, 'Previous user message');

    assert.equal(button.title, 'Previous user message');
    assert.equal(button.dataset.originalTitle, 'Previous user message');
    assert.equal(attrs['aria-label'], 'Previous user message');
  });

  await run('embedded locale catalogs stay in sync with packaged _locales files', () => {
    const localeToLanguage = {
      zh_CN: 'zh',
      en: 'en',
      ja: 'ja',
      ko: 'ko',
    };

    Object.entries(localeToLanguage).forEach(([locale, lang]) => {
      const packagedMessages = flattenLocaleMessages(loadMessages(locale));
      const embeddedMessages = getEmbeddedMessages(lang);
      assert.deepEqual(embeddedMessages, packagedMessages, `${lang} embedded locale should match ${locale}/messages.json`);
    });
  });

  await run('loadLocaleMessages returns embedded translations even when fetch is unavailable', async () => {
    const originalFetch = global.fetch;
    delete global.fetch;

    try {
      const messages = await loadLocaleMessages('en');
      assert.equal(messages.outline_title, 'Outline');
      assert.equal(messages.jump_prev_user, 'Previous user message');
    } finally {
      if (originalFetch) {
        global.fetch = originalFetch;
      }
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
