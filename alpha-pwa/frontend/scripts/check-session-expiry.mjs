// Runtime test del TTL di sessione (72h). Esegui con:
//   node --experimental-strip-types scripts/check-session-expiry.mjs
// Shim minimale di localStorage perché il modulo gira fuori dal browser.

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => store.clear(),
};

const {
  SESSION_TTL_MS, recordAcceptance, ensureAcceptanceTs, isSessionExpired, clearAcceptance,
} = await import('../src/auth/sessionExpiry.ts');

let failed = 0;
const ok = (name, cond) => { console.log(`${cond ? '✓' : '✗'} ${name}`); if (!cond) failed++; };

ok('TTL è 72 ore', SESSION_TTL_MS === 72 * 60 * 60 * 1000);

store.clear();
ok('senza ts → non scaduta', isSessionExpired() === false);

const now = 1_000_000_000_000;
recordAcceptance(now);
ok('appena accettato → non scaduta', isSessionExpired(now) === false);
ok('a 71h → non scaduta', isSessionExpired(now + 71 * 3600 * 1000) === false);
ok('a 73h → scaduta', isSessionExpired(now + 73 * 3600 * 1000) === true);

store.clear();
ensureAcceptanceTs(now);
ok('ensure innesta ts quando manca', isSessionExpired(now) === false && localStorage.getItem('plt:session-accepted-ts') === String(now));
ensureAcceptanceTs(now + 80 * 3600 * 1000);
ok('ensure non sovrascrive un ts esistente', localStorage.getItem('plt:session-accepted-ts') === String(now));

clearAcceptance();
ok('clear rimuove il ts', localStorage.getItem('plt:session-accepted-ts') === null);

if (failed) { console.error(`\n${failed} session-expiry check(s) failed.`); process.exit(1); }
console.log('\nsession-expiry OK');
