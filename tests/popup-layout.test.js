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

function fontLine(fontSize, lineHeight = 1.2) {
  return fontSize * lineHeight;
}

function estimatePopupHeight() {
  const headerHeight = verticalPadding('.header') + Math.max(
    firstPx('.logo', 'width'),
    firstPx('.icon-btn', 'width')
  );

  const titleLine = fontLine(firstPx('.row-title', 'font-size'));
  const descLine = fontLine(firstPx('.row-desc', 'font-size'), 1.4);
  const rowGap = firstPx('.row-info', 'gap');
  const rowPadding = verticalPadding('.row');
  const segmentHeight = verticalPadding('.segment') + verticalPadding('.seg-btn') + fontLine(firstPx('.seg-btn', 'font-size'));

  const switchRowHeight = rowPadding + titleLine;
  const switchRowWithDescHeight = rowPadding + titleLine + rowGap + descLine;
  const displayModeHeight = rowPadding + titleLine + rowGap + descLine + firstPx('.container', 'gap') + segmentHeight;
  const scrollModeHeight = rowPadding + titleLine + firstPx('.container', 'gap') + segmentHeight;

  const groupBorder = 2;
  const containerHeight = verticalPadding('.container')
    + firstPx('.container', 'gap') * 2
    + groupBorder + switchRowHeight + switchRowWithDescHeight * 2
    + groupBorder + displayModeHeight
    + groupBorder + scrollModeHeight;

  const statusHeight = firstPx('.status-bar', 'margin') + verticalPadding('.status-bar') + fontLine(firstPx('.status-bar', 'font-size')) + 2;

  const starTitle = fontLine(firstPx('.star-title', 'font-size'), 1.1);
  const starDescription = fontLine(firstPx('.star-desc', 'font-size'), 1.3) * 2;
  const starHeight = verticalPadding('.star-btn') + starTitle + firstPx('.star-copy', 'gap') + starDescription;
  const footerHeight = firstPx('.footer', 'margin-top')
    + 1
    + verticalPadding('.footer')
    + firstPx('.footer', 'gap')
    + starHeight
    + firstPx('.icon-link', 'height');

  return headerHeight + containerHeight + statusHeight + footerHeight;
}

run('popup default layout stays within a no-scroll Chrome popup budget', () => {
  assert.ok(
    estimatePopupHeight() <= 560,
    `estimated popup height ${Math.ceil(estimatePopupHeight())}px exceeds 560px no-scroll budget`
  );
});
