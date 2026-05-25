import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

const ruleBody = selector => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, 's').exec(css)?.groups?.body ?? '';
};

const hasRule = (selector, declarationPattern) => declarationPattern.test(ruleBody(selector));

const hexToRgb = hex => {
  const clean = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(clean.slice(i, i + 2), 16) / 255);
};
const linear = c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const luminance = hex => {
  const [r, g, b] = hexToRgb(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (fg, bg) => {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
const backgroundHex = selector => /background\s*:\s*(#[0-9a-fA-F]{6})\s*;/.exec(ruleBody(selector))?.[1];

const failures = [];

const flexTextTargets = [
  '.editable-row-head h3',
  '.editable-row-head strong',
  '.charge-card-content',
  '.charge-name',
  '.element-body',
  '.strategy-content',
  '.strategy-title',
  '.issue-type',
  '.witness-header > div:first-child',
];

for (const selector of flexTextTargets) {
  if (!hasRule(selector, /min-width\s*:\s*0\s*;/)) {
    failures.push(`${selector} must set min-width: 0 so adjacent buttons/selects cannot force editable text into last-letter wrapping`);
  }
}

for (const selector of ['.editable-row-head h3', '.editable-row-head strong', '.charge-card-content', '.element-body', '.strategy-content', '.issue-type', '.witness-header > div:first-child']) {
  if (!hasRule(selector, /flex\s*:\s*1\s+1\s+(?:auto|0|0%)\s*;/)) {
    failures.push(`${selector} must flex to fill available row width`);
  }
}

if (!hasRule('.editable', /overflow-wrap\s*:\s*anywhere\s*;/)) {
  failures.push('editable text should only break inside long tokens when necessary, via overflow-wrap: anywhere');
}

if (!hasRule('.editable', /word-break\s*:\s*normal\s*;/)) {
  failures.push('editable text should not use word-break: break-word because it can split the last letter onto a new line');
}

if (!hasRule('.editable-select.status-chip', /color\s*:\s*#(?:fff|ffffff)\s*;/i)) {
  failures.push('deadline status selects must explicitly use white text with status-chip specificity');
}

for (const selector of ['.status-chip.confirmed', '.status-chip.candidate', '.status-chip.needs_review']) {
  const bg = backgroundHex(selector);
  if (!bg) {
    failures.push(`${selector} must use an opaque dark hex background, not a pale or inherited background`);
    continue;
  }
  const ratio = contrast('#ffffff', bg);
  if (ratio < 4.5) {
    failures.push(`${selector} contrast with white text is ${ratio.toFixed(2)}:1; expected at least 4.5:1`);
  }
}

if (failures.length) {
  console.error(failures.map(f => `- ${f}`).join('\n'));
  process.exit(1);
}

console.log('layout and contrast CSS regression checks passed');
