import React, { useEffect, useState } from 'react';
import { type Session } from '@supabase/supabase-js';
import { Fingerprint, LogOut, ShieldCheck, ShieldOff, User, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import type { UserProfile } from '../domain/types';
import { useLockConfig, setPin, dismissSetup, isBiometricSupported, hasBiometric, registerBiometric, disableBiometric } from '../lock/appLock';
import { PinSetForm } from '../lock/LockSetup';

/** Profilo panel: enable / change / disable the PIN app-lock. */
function LockManager({ userId }: { userId: string }) {
  const cfg = useLockConfig(userId);
  const enabled = !!(cfg && cfg.enabled && cfg.pinHash);
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="lock-manage">
        <div className="lock-manage-title"><ShieldCheck size={15} /> {enabled ? 'Cambia PIN' : 'Imposta un PIN'}</div>
        <PinSetForm
          submitLabel={enabled ? 'Aggiorna PIN' : 'Attiva il blocco'}
          onCancel={() => setEditing(false)}
          onSubmit={async (pin) => { await setPin(userId, pin); setEditing(false); }}
        />
      </div>
    );
  }

  return (
    <div className="lock-manage">
      <div className="lock-manage-row">
        <div>
          <div className="lock-manage-title">
            {enabled ? <ShieldCheck size={15} /> : <ShieldOff size={15} />} Blocco con PIN
          </div>
          <div className="lock-manage-sub">{enabled ? 'Attivo — richiesto all’apertura e dopo inattività.' : 'Disattivato.'}</div>
        </div>
      </div>
      <div className="lock-manage-actions">
        {enabled ? (
          <>
            <button type="button" className="lock-manage-btn" onClick={() => setEditing(true)}>Cambia PIN</button>
            <button type="button" className="lock-manage-btn lock-manage-btn--danger"
              onClick={() => { if (confirm('Disattivare il blocco con PIN? Chiunque apra l’app potrà accedere ai dati su questo dispositivo.')) dismissSetup(userId); }}>
              Disattiva
            </button>
          </>
        ) : (
          <button type="button" className="lock-manage-btn" onClick={() => setEditing(true)}>Attiva</button>
        )}
      </div>
      {enabled && isBiometricSupported() && (
        <div className="lock-manage-row" style={{ marginTop: 4 }}>
          <div className="lock-manage-title" style={{ fontWeight: 600 }}><Fingerprint size={15} /> Sblocco biometrico</div>
          {hasBiometric(userId)
            ? <button type="button" className="lock-manage-btn lock-manage-btn--danger" onClick={() => disableBiometric(userId)}>Disattiva</button>
            : <button type="button" className="lock-manage-btn" onClick={async () => { const ok = await registerBiometric(userId, userId); if (!ok) alert('Attivazione biometria non riuscita su questo dispositivo.'); }}>Attiva</button>}
        </div>
      )}
    </div>
  );
}

function ProfileDrawer({ session, onClose }: { session: Session; onClose: () => void }) {
  const [profile, setProfile] = useState<Omit<UserProfile, 'id'>>({ full_name: null, studio: null, phone: null });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('full_name,studio,phone').eq('id', session.user.id).single()
      .then(({ data }) => { if (data) setProfile(data); });
  }, [session.user.id]);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('profiles').upsert({ id: session.user.id, ...profile });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="profile-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="profile-drawer" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <div className="profile-header">
          <div id="profile-title" className="profile-title">Profilo</div>
          <button type="button" className="profile-close" title="Chiudi profilo" aria-label="Chiudi profilo" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="profile-email">{session.user.email}</div>
        {[
          { label: 'Nome completo', key: 'full_name' as const, placeholder: 'Avv. Mario Rossi' },
          { label: 'Studio legale', key: 'studio' as const, placeholder: 'Studio Rossi & Associati' },
          { label: 'Telefono', key: 'phone' as const, placeholder: '+39 02 1234567' },
        ].map(({ label, key, placeholder }) => (
          <div key={key} className="profile-field">
            <label className="profile-label">{label}</label>
            <input className="profile-input" aria-label={label} value={profile[key] ?? ''} onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} />
          </div>
        ))}
        <button type="button" title="Salva modifiche profilo" className={`profile-save${saved ? ' profile-save--saved' : ''}`} onClick={handleSave} disabled={saving}>
          {saving ? 'Salvataggio…' : saved ? 'Salvato ✓' : 'Salva profilo'}
        </button>
        <LockManager userId={session.user.id} />
        <button type="button" className="profile-logout" title="Disconnettiti dall'applicazione" onClick={() => requestLogout()}>
          <LogOut size={15} /> Esci dall'account
        </button>
      </div>
    </div>
  );
}

function requestLogout() {
  if (confirm("Vuoi davvero uscire dall'account?")) supabase.auth.signOut();
}

export default function AccountControls({ session }: { session: Session }) {
  const [showProfile, setShowProfile] = useState(false);
  return (
    <>
      <div className="account-controls">
        <button type="button" onClick={() => setShowProfile(true)} className="profile-btn" title="Profilo" aria-label="Profilo"><User size={16} /></button>
        <button type="button" onClick={requestLogout} className="profile-btn" title="Esci dall'account" aria-label="Esci dall'account"><LogOut size={16} /></button>
      </div>
      {showProfile && <ProfileDrawer session={session} onClose={() => setShowProfile(false)} />}
    </>
  );
}
