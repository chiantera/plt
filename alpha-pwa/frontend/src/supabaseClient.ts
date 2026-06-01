import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  document.getElementById('root')!.innerHTML =
    '<div style="min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#0d1117;color:#f87171;font-family:system-ui;text-align:center;padding:24px"><div><strong>Configurazione mancante</strong><br><small style="color:#6b7280">VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY non impostati.<br>Aggiungi le variabili d\'ambiente e rideploya.</small></div></div>';
  throw new Error('Missing Supabase env vars');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
