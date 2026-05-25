import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const pltExport = readFileSync(new URL('../src/pltExport.ts', import.meta.url), 'utf8');
const appSource = `${main}\n${pltExport}`;

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

for (const selector of [
  '.charge-code .editable-empty',
  '.charge-name .editable-empty',
  '.strategy-type-badge .editable-empty',
  '.issue-law .editable-empty',
  '.issue-remedy .editable-empty',
]) {
  if (!hasRule(selector, /white-space\s*:\s*nowrap\s*;/)) {
    failures.push(`${selector} must keep short placeholder labels on one line`);
  }
}

for (const selector of [
  '.charge-code .editable',
  '.strategy-type-badge .editable',
]) {
  if (!hasRule(selector, /white-space\s*:\s*nowrap\s*;/)) {
    failures.push(`${selector} must keep entered compact legal labels on one line after editing`);
  }
}

for (const selector of ['.charge-code .editable-input', '.strategy-type-badge .editable-input']) {
  if (!hasRule(selector, /width\s*:\s*\d+ch\s*;/)) {
    failures.push(`${selector} must have a compact explicit edit width so the browser does not squeeze typed text into two lines`);
  }
}

for (const selector of ['.issue-law em', '.issue-remedy span']) {
  if (!hasRule(selector, /flex\s*:\s*1\s+1\s+(?:auto|0|0%)\s*;/)) {
    failures.push(`${selector} must flex to give typed legal text real horizontal space while editing`);
  }
}

for (const selector of ['.charge-card-title-row', '.strategy-title-row']) {
  if (!hasRule(selector, /flex-wrap\s*:\s*nowrap\s*;/)) {
    failures.push(`${selector} must avoid wrapping short legal-analysis header placeholders across lines`);
  }
}

if (!main.includes('placeholder="art."')) {
  failures.push('charge code placeholder must be exactly "art."');
}
if (main.includes('placeholder="art. …"') || main.includes('placeholder="art. ..."')) {
  failures.push('charge code placeholder must not include ellipsis');
}
if (!main.includes('placeholder="Nome Reato"')) {
  failures.push('charge name placeholder must be "Nome Reato"');
}
if (!main.includes('Stima token richiesti')) {
  failures.push('Promemoria usage eyebrow must say "Stima token richiesti"');
}
if (main.includes('Stima processamento')) {
  failures.push('Promemoria usage eyebrow must not say "Stima processamento"');
}
if (/usage_estimate\.model_route/.test(main)) {
  failures.push('Promemoria usage estimate must not render provider/model route names');
}

if (/value=\{issue\.legal_basis\}[^>]*placeholder="Base legale…"[^>]*multiline/s.test(main)) {
  failures.push('Base legale compact field must use a single-line input, not multiline textarea');
}
if (/value=\{issue\.remedy\}[^>]*placeholder="Rimedio…"[^>]*multiline/s.test(main)) {
  failures.push('Rimedio compact field must use a single-line input, not multiline textarea');
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

for (const text of [
  'Anonimizza',
  'Proteggi con password — consigliato',
  'PLT non salva il file e non conosce la password',
  'Chi riceve il file potrà aprirlo su un altro dispositivo, ma solo con questa password',
  'Prima di inviare un .plt non protetto, usa “Anonimizza”',
  'Fascicolo protetto',
  'Password errata o file danneggiato.',
]) {
  if (!appSource.includes(text)) failures.push(`app source must include export/privacy copy: ${text}`);
}

if (!main.includes('anonymize-action-btn')) failures.push('Anonimizza toolbar button must use the dedicated prominent anonymize-action-btn class');
if (!hasRule('.anonymize-action-btn', /linear-gradient\s*\(/)) failures.push('Anonimizza button must use a visible multi-color gradient accent');
if (!hasRule('.anonymize-action-btn', /color\s*:\s*#ffffff\s*;/i)) failures.push('Anonimizza button must use explicit high-contrast white text');
if (!hasRule('.anonymize-action-btn:focus-visible', /outline\s*:/)) failures.push('Anonimizza button needs a keyboard-visible focus outline');

if (failures.length) {
  console.error(failures.map(f => `- ${f}`).join('\n'));
  process.exit(1);
}

console.log('layout and contrast CSS regression checks passed');
