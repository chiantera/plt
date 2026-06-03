/**
 * LockSetup — first-run prompt to protect the app with a PIN, plus a reusable
 * PinSetForm (enter + confirm) used here and by the Profilo management panel.
 */
import { useRef, useState } from 'react';
import { Fingerprint, ShieldCheck } from 'lucide-react';
import { setPin, dismissSetup, isBiometricSupported, registerBiometric } from './appLock';

const PIN_LEN = 4;

/** Enter a 4-digit PIN twice; calls onSubmit(pin) when both match. */
export function PinSetForm({ onSubmit, submitLabel, onCancel }: {
  onSubmit: (pin: string) => void | Promise<void>;
  submitLabel: string;
  onCancel?: () => void;
}) {
  const [pin, setPinVal] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const confirmRef = useRef<HTMLInputElement>(null);

  const digits = (s: string) => s.replace(/\D/g, '').slice(0, PIN_LEN);

  const proceed = async () => {
    if (pin.length !== PIN_LEN) { setError('Il PIN deve essere di 4 cifre.'); return; }
    if (pin !== confirm) { setError('I due PIN non coincidono.'); return; }
    setBusy(true);
    try { await onSubmit(pin); } finally { setBusy(false); }
  };

  return (
    <div className="lock-form">
      <label className="lock-field-label">PIN (4 cifre)</label>
      <input
        className="lock-input" inputMode="numeric" type="password" autoComplete="off"
        value={pin} autoFocus
        onChange={e => { setPinVal(digits(e.target.value)); setError(null); }}
        onKeyDown={e => { if (e.key === 'Enter' && pin.length === PIN_LEN) confirmRef.current?.focus(); }}
      />
      <label className="lock-field-label">Conferma PIN</label>
      <input
        ref={confirmRef}
        className="lock-input" inputMode="numeric" type="password" autoComplete="off"
        value={confirm}
        onChange={e => { setConfirm(digits(e.target.value)); setError(null); }}
        onKeyDown={e => { if (e.key === 'Enter') void proceed(); }}
      />
      {error && <p className="lock-error" role="alert">{error}</p>}
      <div className="lock-form-actions">
        {onCancel && <button type="button" className="ghost-button" onClick={onCancel}>Annulla</button>}
        <button type="button" className="primary-button" onClick={() => void proceed()} disabled={busy || pin.length !== PIN_LEN || confirm.length !== PIN_LEN}>
          {busy ? 'Salvataggio…' : submitLabel}
        </button>
      </div>
    </div>
  );
}

export default function LockSetup({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [step, setStep] = useState<'intro' | 'set' | 'bio'>('intro');

  if (step === 'bio') {
    return (
      <div className="lock-screen">
        <div className="lock-card">
          <div className="lock-icon"><Fingerprint size={22} /></div>
          <h1 className="lock-title">Sblocco biometrico</h1>
          <p className="lock-sub">Vuoi sbloccare anche con Face ID / impronta? Il PIN resta come alternativa.</p>
          <div className="lock-form-actions lock-form-actions--stack">
            <button type="button" className="primary-button" onClick={async () => { await registerBiometric(userId, userId); onDone(); }}>Attiva biometria</button>
            <button type="button" className="ghost-button" onClick={onDone}>Solo PIN</button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'set') {
    return (
      <div className="lock-screen">
        <div className="lock-card">
          <div className="lock-icon"><ShieldCheck size={22} /></div>
          <h1 className="lock-title">Imposta un PIN</h1>
          <p className="lock-sub">Ti verrà chiesto all'apertura dell'app e dopo qualche minuto di inattività.</p>
          <PinSetForm
            submitLabel="Attiva il blocco"
            onCancel={() => setStep('intro')}
            onSubmit={async (pin) => { await setPin(userId, pin); if (isBiometricSupported()) setStep('bio'); else onDone(); }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="lock-screen">
      <div className="lock-card">
        <div className="lock-icon"><ShieldCheck size={22} /></div>
        <h1 className="lock-title">Proteggi l'app con un PIN</h1>
        <p className="lock-sub">
          I dati dei fascicoli restano solo su questo dispositivo. Un PIN impedisce a chiunque
          prenda in mano il telefono di aprirli. Potrai cambiarlo o disattivarlo da <strong>Profilo</strong>.
        </p>
        <div className="lock-form-actions lock-form-actions--stack">
          <button type="button" className="primary-button" onClick={() => setStep('set')}>Imposta PIN</button>
          <button type="button" className="ghost-button" onClick={() => { dismissSetup(userId); onDone(); }}>Più tardi</button>
        </div>
      </div>
    </div>
  );
}
