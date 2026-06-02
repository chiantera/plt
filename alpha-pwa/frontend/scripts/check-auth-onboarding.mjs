import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'src', 'main.tsx'), 'utf8');
const styles = readFileSync(join(__dirname, '..', 'src', 'styles.css'), 'utf8');
const caseDetail = readFileSync(join(__dirname, '..', 'src', 'screens', 'CaseDetailView.tsx'), 'utf8');
const readOptional = (path) => existsSync(path) ? readFileSync(path, 'utf8') : '';
const accountControls = readOptional(join(__dirname, '..', 'src', 'components', 'AccountControls.tsx'));
const supabaseClient = readOptional(join(__dirname, '..', 'src', 'supabaseClient.ts'));

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
  {
    name: 'auth form gates login behind the disclaimer checkbox',
    pass: src.includes('const [accepted, setAccepted] = useState(false)') &&
      src.includes('if (!accepted) return') &&
      src.includes('disabled={loading || !accepted}') &&
      src.includes('auth-accept-hint'),
  },
  {
    name: 'auth layout puts disclaimer/auth controls before the intro column',
    pass: src.indexOf('className="auth-col"') !== -1 &&
      src.indexOf('className="auth-col"') < src.indexOf('className="auth-intro"'),
  },
  {
    name: 'auth columns are top-aligned and collapse under 880px',
    pass: /\.auth-shell\s*\{[\s\S]*align-items:\s*start/.test(styles) &&
      /@media \(max-width:\s*880px\)[\s\S]*\.auth-shell\s*\{[\s\S]*grid-template-columns:\s*1fr/.test(styles),
  },
  {
    name: 'dev bypass auth listens for SIGNED_OUT and clears the fake session',
    pass: /DEV_BYPASS_AUTH[\s\S]*onAuthStateChange[\s\S]*SIGNED_OUT[\s\S]*setSession\(null\)/.test(src),
  },
  {
    name: 'supabase client is shared outside main',
    pass: supabaseClient.includes('createClient') &&
      src.includes("from './supabaseClient'") &&
      accountControls.includes("from '../supabaseClient'") &&
      !src.includes("createClient, type Session"),
  },
  {
    name: 'account controls expose profile and confirmed quick logout',
    pass: accountControls.includes('function ProfileDrawer') &&
      accountControls.includes("Vuoi davvero uscire dall'account?") &&
      accountControls.includes('supabase.auth.signOut()') &&
      accountControls.includes('LogOut') &&
      accountControls.includes('Profilo') &&
      accountControls.includes('Esci') &&
      (accountControls.match(/type="button"/g) ?? []).length >= 5 &&
      accountControls.includes('aria-label={label}'),
  },
  {
    name: 'account controls render on home and case detail screens',
    pass: src.includes('<AccountControls session={session} />') &&
      caseDetail.includes('<AccountControls session={session} />') &&
      caseDetail.includes('className="case-topbar"') &&
      styles.includes('.account-controls') &&
      styles.includes('.case-topbar'),
  },
  {
    name: 'reanalyze is routed through the pre-flight modal as a full, non-destructive analysis',
    pass: caseDetail.includes('requestReanalyze') &&
      /handleAnalyze\('flash',\s*instr,\s*\{ full: true \}\)/.test(caseDetail) &&
      !caseDetail.includes('const reset: CaseAnalysis'),
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
