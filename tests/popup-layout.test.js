const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'popup.html'), 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] || '';

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function block(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`))?.[1] || '';
}

function declaration(selector, property) {
  return block(selector).match(new RegExp(`${property}\\s*:\\s*([^;]+);`))?.[1] || '';
}

function firstPx(selector, property) {
  const value = declaration(selector, property);
  const match = value.match(/(-?\d+(?:\.\d+)?)px/);
  assert.ok(match, `${selector} must declare ${property} in px`);
  return Number(match[1]);
}

function verticalPadding(selector) {
  const value = declaration(selector, 'padding');
  const parts = value.match(/-?\d+(?:\.\d+)?px/g);
  assert.ok(parts, `${selector} must declare padding in px`);

  const nums = parts.map((part) => Number(part.replace('px', '')));
  if (nums.length === 1) return nums[0] * 2;
  if (nums.length === 2) return nums[0] * 2;
  return nums[0] + nums[2];
}

function findMatchingDivClose(startIndex) {
  assert.notEqual(startIndex, -1, 'container must exist');

  const tokenPattern = /<div\b[^>]*>|<\/div>/g;
  tokenPattern.lastIndex = startIndex;

  let depth = 0;
  let match;
  while ((match = tokenPattern.exec(html))) {
    if (match[0] === '</div>') {
      depth -= 1;
      if (depth === 0) return match.index;
      continue;
    }

    depth += 1;
  }

  throw new Error('container closing div not found');
}

run('popup keeps a bounded body and delegates scrolling to the settings container', () => {
  assert.equal(declaration('body', 'display'), 'flex');
  assert.equal(declaration('body', 'flex-direction'), 'column');
  assert.equal(firstPx('body', 'max-height'), 650);
  assert.equal(declaration('body', 'overflow-y'), 'hidden');

  assert.equal(declaration('.container', 'overflow-y'), 'auto');
  assert.equal(declaration('.container', 'min-height'), '0');
  assert.equal(declaration('.container', 'scrollbar-width'), 'none');
});

run('popup exposes compact history trimming controls', () => {
  assert.doesNotMatch(html, /<details class="trim-details"/);
  assert.match(html, /<select class="select-input" id="trim-keep-turns">/);
  assert.match(html, /<input type="checkbox" id="toggle-trim-auto">/);
  assert.match(html, /id="btn-trim-apply"/);
  assert.match(html, /id="btn-trim-restore"/);
  assert.match(html, /id="trim-stats"/);
});

run('popup no longer exposes a redundant master trim toggle', () => {
  assert.doesNotMatch(html, /id="toggle-trim-enabled"/);
});

run('popup widens the panel slightly for the denser trim layout', () => {
  assert.ok(firstPx('body', 'width') > 320);
});

run('popup keeps status and footer outside the settings scroll container', () => {
  assert.equal(declaration('html', 'overflow'), 'hidden');
  assert.equal(declaration('body', 'overflow-y'), 'hidden');

  const containerOpen = html.indexOf('<div class="container">');
  const containerClose = findMatchingDivClose(containerOpen);
  const statusIndex = html.indexOf('<div id="status" class="status-bar active">');
  const footerIndex = html.indexOf('<div class="footer">');

  assert.ok(statusIndex > containerClose, 'status must live outside the settings scroll container');
  assert.ok(footerIndex > containerClose, 'footer must live outside the settings scroll container');
  assert.match(html, /id="review-link"/);
  assert.match(html, /id="version-num"/);
  assert.match(html, /id="github-link"/);
});
