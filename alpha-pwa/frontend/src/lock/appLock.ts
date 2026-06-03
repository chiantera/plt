/**
 * appLock — a LOCAL app-lock on top of the persistent Supabase session.
 *
 * It is a UI gate, not at-rest encryption: it prevents the app shell from
 * rendering until the user enters their 4-digit PIN. The PIN is stored only as
 * a PBKDF2 hash (+ random salt) in localStorage, keyed by account id — never in
 * clear text, never sent to the server. The case data in IndexedDB is NOT
 * encrypted with the PIN (that would conflict with re-login PIN recovery and
 * risk the local-only data); the lock only gates the UI.
 *
 * Recovery: "PIN dimenticato?" removes the whole local config and signs out;
 * after re-login the setup prompt reappears. The Supabase password is the root
 * credential.
 *
 * Pure config + crypto live here and are testable without React; the lock-state
 * machine is a tiny pub/sub store consumed via useSyncExternalStore.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';

export interface LockConfig {
  enabled: boolean;
  pinHash: string;   // base64 PBKDF2 output ('' when no PIN set)
  pinSalt: string;   // base64 salt
  biometric: { credId: string } | null;  // Phase 2 (WebAuthn); unused in Phase 1
  idleTimeoutMin: number;
}

const NS = 'plt:applock';
const LAST_ACTIVE_KEY = `${NS}:lastActive`;
const PBKDF2_ITERS = 100_000;
const COOLDOWN_AFTER = 5;      // wrong attempts before cooldown kicks in
const COOLDOWN_BASE_MS = 30_000;

const cfgKey = (userId: string) => `${NS}:${userId}`;
const DEFAULT_IDLE_MIN = 5;

// ── config CRUD ──────────────────────────────────────────────────────────────
export function loadConfig(userId: string): LockConfig | null {
  try {
    const raw = localStorage.getItem(cfgKey(userId));
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<LockConfig>;
    if (typeof c.enabled !== 'boolean') return null;
    const defaults: LockConfig = { enabled: false, pinHash: '', pinSalt: '', biometric: null, idleTimeoutMin: DEFAULT_IDLE_MIN };
    return { ...defaults, ...c };
  } catch { return null; }
}

function saveConfig(userId: string, c: LockConfig) {
  try { localStorage.setItem(cfgKey(userId), JSON.stringify(c)); } catch { /* ignore */ }
  bumpConfig();
}

/** True only when a PIN is actually set and protection is on. */
export function isLockEnabled(userId: string): boolean {
  const c = loadConfig(userId);
  return !!(c && c.enabled && c.pinHash);
}

// ── crypto (Web Crypto PBKDF2-SHA256) ────────────────────────────────────────
function toB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

async function hashPin(pin: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    keyMaterial, 256,
  );
  return toB64(bits);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Set/replace the PIN and turn protection on. Preserves biometric + idle settings. */
export async function setPin(userId: string, pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const pinHash = await hashPin(pin, salt);
  const prev = loadConfig(userId);
  saveConfig(userId, {
    enabled: true,
    pinHash,
    pinSalt: toB64(salt.buffer),
    biometric: prev?.biometric ?? null,
    idleTimeoutMin: prev?.idleTimeoutMin ?? DEFAULT_IDLE_MIN,
  });
}

export async function verifyPin(userId: string, pin: string): Promise<boolean> {
  const c = loadConfig(userId);
  if (!c || !c.pinHash) return false;
  const h = await hashPin(pin, fromB64(c.pinSalt));
  return constantTimeEqual(h, c.pinHash);
}

/** "Più tardi" / toggle-off: keep a record (so we don't re-prompt every launch)
 *  but drop the PIN and protection. */
export function dismissSetup(userId: string) {
  saveConfig(userId, { enabled: false, pinHash: '', pinSalt: '', biometric: null, idleTimeoutMin: DEFAULT_IDLE_MIN });
}

/** Recovery only: remove the whole config so loadConfig() returns null and the
 *  setup prompt reappears after re-login. */
export function clearLock(userId: string) {
  try { localStorage.removeItem(cfgKey(userId)); } catch { /* ignore */ }
  bumpConfig();
}

export function setIdleTimeout(userId: string, minutes: number) {
  const c = loadConfig(userId);
  if (!c) return;
  saveConfig(userId, { ...c, idleTimeoutMin: minutes });
}

// ── biometric unlock (WebAuthn, optional, Phase 2) ───────────────────────────
// A *local* gate, not a server-verified auth: we create a platform credential
// at enable time and treat a successful get() (device biometric / device PIN)
// as an unlock. No assertion is verified server-side. Degrades to PIN-only
// wherever WebAuthn or a platform authenticator is unavailable.
const RP_NAME = 'Pocket Legal Triage';

export function isBiometricSupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials?.create;
}

/** True if the device has a usable platform authenticator (Face ID / fingerprint / Hello). */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  try {
    return isBiometricSupported() && await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

export function hasBiometric(userId: string): boolean {
  return !!loadConfig(userId)?.biometric;
}

export async function registerBiometric(userId: string, label: string): Promise<boolean> {
  if (!isBiometricSupported()) return false;
  const cfg = loadConfig(userId);
  if (!cfg || !cfg.enabled || !cfg.pinHash) return false; // PIN must exist first
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userIdBytes = new TextEncoder().encode(userId).slice(0, 64);
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: RP_NAME },           // rp.id defaults to the current domain
        user: { id: userIdBytes, name: label || userId, displayName: label || userId },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        timeout: 60_000,
        attestation: 'none',
      },
    }) as PublicKeyCredential | null;
    if (!cred) return false;
    saveConfig(userId, { ...cfg, biometric: { credId: toB64(cred.rawId) } });
    return true;
  } catch { return false; }
}

export async function unlockWithBiometric(userId: string): Promise<boolean> {
  const cfg = loadConfig(userId);
  if (!cfg?.biometric || !isBiometricSupported()) return false;
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ type: 'public-key', id: fromB64(cfg.biometric.credId) }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    if (!assertion) return false;
    unlock();
    return true;
  } catch { return false; }
}

export function disableBiometric(userId: string) {
  const c = loadConfig(userId);
  if (!c) return;
  saveConfig(userId, { ...c, biometric: null });
}

// ── idle bookkeeping ─────────────────────────────────────────────────────────
export function markActivity() {
  try { localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now())); } catch { /* ignore */ }
}
export function idleExceeded(idleTimeoutMin: number): boolean {
  try {
    const last = Number(localStorage.getItem(LAST_ACTIVE_KEY) || Date.now());
    return Date.now() - last > idleTimeoutMin * 60_000;
  } catch { return false; }
}

// ── lock-state store (pub/sub) ───────────────────────────────────────────────
export interface LockState { locked: boolean; attempts: number; cooldownUntil: number | null }

let state: LockState = { locked: false, attempts: 0, cooldownUntil: null };
let configTick = 0;
const listeners = new Set<() => void>();
function emit() { listeners.forEach(l => { try { l(); } catch { /* ignore */ } }); }
function bumpConfig() { configTick++; emit(); }

export function lock() {
  if (!state.locked) { state = { ...state, locked: true }; emit(); }
}
export function unlock() {
  state = { locked: false, attempts: 0, cooldownUntil: null };
  markActivity();
  emit();
}
/** Record a wrong PIN; after COOLDOWN_AFTER misses, start an escalating cooldown. */
export function registerWrongAttempt(): LockState {
  const attempts = state.attempts + 1;
  const over = attempts - COOLDOWN_AFTER + 1;
  const cooldownUntil = over > 0 ? Date.now() + COOLDOWN_BASE_MS * over : null;
  state = { ...state, attempts, cooldownUntil };
  emit();
  return state;
}

export function getLockState(): LockState { return state; }
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useLockState(): LockState {
  return useSyncExternalStore(subscribe, getLockState);
}
/** Re-read config on any config change (setPin, dismiss, clear, idle change). */
export function useLockConfig(userId: string): LockConfig | null {
  useSyncExternalStore(subscribe, () => configTick);
  return loadConfig(userId);
}

/** Resolves to true only once a usable platform authenticator (Face ID /
 *  fingerprint / Hello) is confirmed available — false until then. Use this to
 *  gate biometric UI so it never appears on desktops without a reader. */
export function usePlatformAuthenticator(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let mounted = true;
    isPlatformAuthenticatorAvailable().then(v => { if (mounted) setOk(v); });
    return () => { mounted = false; };
  }, []);
  return ok;
}
