/**
 * LockGate — wraps the authenticated app shell. Decides what to render:
 *   - no config yet            → first-run setup prompt (LockSetup)
 *   - protection on + locked    → LockScreen
 *   - otherwise                 → the app (children)
 *
 * Owns the lock triggers: lock on cold start, and lock when returning from
 * background / after idle beyond idleTimeoutMin. Recovery ("PIN dimenticato?")
 * clears the local config and signs out (Supabase password is the root).
 */
import { useEffect } from 'react';
import { type Session } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import {
  isLockEnabled, lock, unlock, clearLock, markActivity, idleExceeded,
  useLockConfig, useLockState,
} from './appLock';
import LockScreen from './LockScreen';
import LockSetup from './LockSetup';

export default function LockGate({ session, children }: { session: Session; children: React.ReactNode }) {
  const userId = session.user.id;
  const cfg = useLockConfig(userId);
  const { locked } = useLockState();

  // Cold start: lock once on app load if protection is on.
  useEffect(() => {
    if (isLockEnabled(userId)) lock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Idle / background triggers (only while protection is on).
  useEffect(() => {
    if (!cfg?.enabled || !cfg.pinHash) return;
    const idleMin = cfg.idleTimeoutMin;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const resetTimer = () => {
      markActivity();
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => lock(), idleMin * 60_000);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') markActivity();
      else if (idleExceeded(idleMin)) lock();
      else resetTimer();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pointerdown', resetTimer);
    window.addEventListener('keydown', resetTimer);
    resetTimer();
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointerdown', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      if (timer) clearTimeout(timer);
    };
  }, [cfg?.enabled, cfg?.pinHash, cfg?.idleTimeoutMin]);

  const handleForgot = () => {
    if (!confirm('Reimpostare il PIN? Dovrai rientrare con email e password, poi potrai creare un nuovo PIN. I tuoi dati restano salvati su questo dispositivo.')) return;
    clearLock(userId);
    unlock();
    void supabase.auth.signOut();
  };

  if (cfg === null) return <LockSetup userId={userId} onDone={() => { /* config tick re-renders */ }} />;
  if (cfg.enabled && cfg.pinHash && locked) return <LockScreen userId={userId} onForgot={handleForgot} />;
  return <>{children}</>;
}
