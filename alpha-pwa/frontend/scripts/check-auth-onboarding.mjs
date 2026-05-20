import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'src', 'main.tsx'), 'utf8');

const checks = [
  {
    name: 'auth screen contains the product orientation copy before login',
    pass: src.includes('Trasforma atti, scansioni e note in fascicoli verificabili'),
  },
  {
    name: 'auth screen says outputs are drafts/checklists under lawyer control',
    pass: src.includes('Bozze e checklist, non decisioni'),
  },
  {
    name: 'post-login app does not block users with an onboarding gate',
    pass: !src.includes('if (!onboarded) return'),
  },
  {
    name: 'app no longer persists a required plt_onboarded flag',
    pass: !src.includes('plt_onboarded'),
  },
];

const failed = checks.filter(check => !check.pass);
for (const check of checks) {
  console.log(`${check.pass ? '✓' : '✗'} ${check.name}`);
}

if (failed.length) {
  console.error(`\n${failed.length} auth/onboarding check(s) failed.`);
  process.exit(1);
}
