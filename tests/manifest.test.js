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

run('manifest title and description stay concise for store listing', () => {
  assert.equal(manifest.name, 'ChatDot - AI 对话导航');
  assert.equal(manifest.description, '为 ChatGPT、Gemini、Claude 和豆包添加右侧导航栏与消息大纲，快速定位历史提问并预览上下文。');
  assert.ok(manifest.name.length <= 45);
  assert.ok(manifest.description.length <= 132);
  assert.equal(manifest.description.includes('更多平台逐步接入中'), false);
});

run('manifest description no longer advertises DeepSeek support', () => {
  assert.equal(manifest.description.includes('DeepSeek'), false);
});
