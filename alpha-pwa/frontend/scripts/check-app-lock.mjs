import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ── localStorage shim (Node has crypto.subtle + btoa/atob globally) ──────────
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const {
  loadConfig, isLockEnabled, setPin, verifyPin, dismissSetup, clearLock,
  markActivity, idleExceeded,
  isBiometricSupported, isPlatformAuthenticatorAvailable, hasBiometric, registerBiometric, unlockWithBiometric,
} = await import('../src/lock/appLock.ts');

const UID = 'user-123';

// fresh: no config
assert.equal(loadConfig(UID), null, 'no config initially');
assert.equal(isLockEnabled(UID), false);

// set a PIN
await setPin(UID, '1234');
assert.equal(isLockEnabled(UID), true, 'lock enabled after setPin');
assert.equal(await verifyPin(UID, '1234'), true, 'correct PIN verifies');
assert.equal(await verifyPin(UID, '0000'), false, 'wrong PIN rejected');
assert.equal(await verifyPin(UID, '12345'), false, 'overlong PIN rejected');

// PIN is never stored in clear text
const raw = store.get('plt:applock:' + UID);
assert.ok(!raw.includes('1234'), 'PIN plaintext must not be in storage');
const cfg = loadConfig(UID);
assert.ok(cfg.pinHash && cfg.pinHash !== '1234', 'pinHash is a hash, not the PIN');
assert.ok(cfg.pinSalt && cfg.pinSalt.length > 0, 'salt present');
// two PINs hashed with random salts differ
const h1 = cfg.pinHash;
await setPin(UID, '1234');
assert.notEqual(loadConfig(UID).pinHash, h1, 'random salt → different hash for same PIN');

// "Più tardi" / toggle off keeps a record but disables protection
dismissSetup(UID);
assert.notEqual(loadConfig(UID), null, 'dismiss keeps a record (no re-prompt)');
assert.equal(isLockEnabled(UID), false, 'protection off after dismiss');

// recovery removes the whole config so the setup prompt returns
await setPin(UID, '4321');
clearLock(UID);
assert.equal(loadConfig(UID), null, 'clearLock removes the config entirely');

// idle helpers
markActivity();
assert.equal(idleExceeded(5), false, 'just-active is not idle');
store.set('plt:applock:lastActive', String(Date.now() - 6 * 60_000));
assert.equal(idleExceeded(5), true, '6 min ago exceeds a 5-min timeout');

// biometric degrades gracefully where WebAuthn is unavailable (e.g. Node)
assert.equal(isBiometricSupported(), false, 'no WebAuthn in Node → unsupported');
assert.equal(await isPlatformAuthenticatorAvailable(), false, 'no platform authenticator in Node');
await setPin(UID, '1111');
assert.equal(hasBiometric(UID), false, 'no biometric set initially');
assert.equal(await registerBiometric(UID, 'x'), false, 'register no-ops without WebAuthn');
assert.equal(await unlockWithBiometric(UID), false, 'unlock no-ops without WebAuthn');
clearLock(UID);

// ── static wiring checks ─────────────────────────────────────────────────────
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const gate = readFileSync(new URL('../src/lock/LockGate.tsx', import.meta.url), 'utf8');
const screen = readFileSync(new URL('../src/lock/LockScreen.tsx', import.meta.url), 'utf8');
const lockMod = readFileSync(new URL('../src/lock/appLock.ts', import.meta.url), 'utf8');
const account = readFileSync(new URL('../src/components/AccountControls.tsx', import.meta.url), 'utf8');

assert.match(main, /<LockGate session=\{session\}>/, 'app shell wrapped in LockGate');
assert.match(main, /fetch\(`\$\{API\}\/api\/health`\)\.catch/, 'warm-up ping still fires on App mount');
assert.match(lockMod, /PBKDF2/, 'PBKDF2 used');
assert.match(lockMod, /SHA-256/, 'SHA-256 used');
assert.match(gate, /visibilitychange/, 'idle/background trigger wired');
assert.match(gate, /clearLock\(userId\)/, 'recovery clears local config');
assert.match(gate, /signOut\(\)/, 'recovery signs out');
assert.match(screen, /verifyPin/, 'lock screen verifies the PIN');
assert.match(screen, /PIN_LEN = 4/, '4-digit PIN');
assert.match(screen, /unlockWithBiometric/, 'lock screen offers biometric unlock');
assert.match(lockMod, /navigator\.credentials\.create/, 'WebAuthn register');
assert.match(lockMod, /navigator\.credentials\.get/, 'WebAuthn unlock');
assert.match(account, /LockManager/, 'Profilo exposes lock management');
assert.match(account, /registerBiometric/, 'Profilo can enable biometric');
// biometric UI is gated on a real platform authenticator (hidden on desktops w/o reader)
const setup = readFileSync(new URL('../src/lock/LockSetup.tsx', import.meta.url), 'utf8');
assert.match(account, /usePlatformAuthenticator/, 'Profilo gates biometric on platform authenticator');
assert.match(setup, /isPlatformAuthenticatorAvailable/, 'setup offers biometric only if a platform authenticator exists');

console.log('app-lock checks passed');
