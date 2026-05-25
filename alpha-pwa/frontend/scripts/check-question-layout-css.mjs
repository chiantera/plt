import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

const hasRule = (selector, declarationPattern) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, 's').exec(css)?.groups?.body ?? '';
  return declarationPattern.test(rule);
};

const failures = [];

if (!hasRule('.editable-row-head h3', /min-width\s*:\s*0\s*;/)) {
  failures.push('editable row headings must set min-width: 0 so the delete button does not force title text into a one-letter wrap');
}

if (!hasRule('.editable-row-head h3', /flex\s*:\s*1\s+1\s+(?:auto|0|0%)\s*;/)) {
  failures.push('editable row headings must flex to fill the remaining row width');
}

if (!hasRule('.editable', /overflow-wrap\s*:\s*anywhere\s*;/)) {
  failures.push('editable text should only break inside long tokens when necessary, via overflow-wrap: anywhere');
}

if (!hasRule('.editable', /word-break\s*:\s*normal\s*;/)) {
  failures.push('editable text should not use word-break: break-word because it can split the last letter onto a new line');
}

if (failures.length) {
  console.error(failures.map(f => `- ${f}`).join('\n'));
  process.exit(1);
}

console.log('question layout CSS regression checks passed');
