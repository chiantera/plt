/**
 * LockScreen — 4-digit PIN entry shown when the app is locked. Verifies against
 * the local PBKDF2 hash; escalating cooldown after repeated wrong attempts.
 * Never destroys data. "PIN dimenticato?" delegates to the host (re-login flow).
 */
import { useEffect, useState } from 'react';
import { Delete, Fingerprint, Lock } from 'lucide-react';
import { verifyPin, unlock, registerWrongAttempt, useLockState, hasBiometric, isBiometricSupported, unlockWithBiometric } from './appLock';

const PIN_LEN = 4;

export default function LockScreen({ userId, onForgot }: { userId: string; onForgot: () => void }) {
  const [entry, setEntry] = useState('');
  const [shake, setShake] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [bioError, setBioError] = useState(false);
  const { attempts, cooldownUntil } = useLockState();
  const [bioAvailable] = useState(() => hasBiometric(userId) && isBiometricSupported());

  const cooling = cooldownUntil != null && cooldownUntil > now;
  const secondsLeft = cooling ? Math.ceil((cooldownUntil! - now) / 1000) : 0;

  // Tick once a second while cooling down so the countdown updates.
  useEffect(() => {
    if (!cooling) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [cooling]);

  const submit = async (pin: string) => {
    const ok = await verifyPin(userId, pin);
    if (ok) { unlock(); return; }
    registerWrongAttempt();
    setEntry('');
    setShake(true);
    setTimeout(() => setShake(false), 420);
  };

  const press = (d: string) => {
    if (cooling || entry.length >= PIN_LEN) return;
    const next = entry + d;
    setEntry(next);
    if (next.length === PIN_LEN) void submit(next);
  };
  const back = () => { if (!cooling) setEntry(e => e.slice(0, -1)); };

  const tryBiometric = async () => {
    setBioError(false);
    const ok = await unlockWithBiometric(userId);
    if (!ok) setBioError(true);
  };

  return (
    <div className="lock-screen" role="dialog" aria-modal="true" aria-label="App bloccata">
      <div className="lock-card">
        <div className="lock-icon"><Lock size={22} /></div>
        <h1 className="lock-title">App bloccata</h1>
        <p className="lock-sub">Inserisci il PIN per continuare</p>

        <div className={`lock-dots${shake ? ' lock-dots--shake' : ''}`} aria-hidden="true">
          {Array.from({ length: PIN_LEN }).map((_, i) => (
            <span key={i} className={`lock-dot${i < entry.length ? ' lock-dot--on' : ''}`} />
          ))}
        </div>

        {cooling
          ? <p className="lock-error" role="alert">Troppi tentativi. Riprova tra {secondsLeft}s.</p>
          : attempts > 0
            ? <p className="lock-error" role="alert">PIN errato. Riprova.</p>
            : <p className="lock-error lock-error--placeholder">&nbsp;</p>}

        <div className="lock-keypad">
          {['1','2','3','4','5','6','7','8','9'].map(d => (
            <button key={d} type="button" className="lock-key" onClick={() => press(d)} disabled={cooling}>{d}</button>
          ))}
          <span />
          <button type="button" className="lock-key" onClick={() => press('0')} disabled={cooling}>0</button>
          <button type="button" className="lock-key lock-key--util" onClick={back} disabled={cooling} aria-label="Cancella"><Delete size={20} /></button>
        </div>

        {bioAvailable && (
          <button type="button" className="lock-bio" onClick={() => void tryBiometric()}>
            <Fingerprint size={18} /> Sblocca con biometria
          </button>
        )}
        {bioError && <p className="lock-error" role="alert">Sblocco biometrico non riuscito. Usa il PIN.</p>}

        <button type="button" className="lock-forgot" onClick={onForgot}>PIN dimenticato?</button>
      </div>
    </div>
  );
}
