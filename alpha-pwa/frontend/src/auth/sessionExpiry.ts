// Hard session lifetime: l'avvocato deve ri-accettare il riquadro di avviso
// (e rifare il login) almeno ogni 72 ore. La sessione Supabase di per sé non
// scade, quindi forziamo noi un logout quando l'ultima accettazione è troppo
// vecchia. La spunta «Ho letto e compreso» è obbligatoria al login, quindi
// registrare il momento del login = registrare l'accettazione.

export const SESSION_TTL_MS = 72 * 60 * 60 * 1000; // 72h

const KEY = 'plt:session-accepted-ts';

/** Chiamato a login/signup riusciti: l'utente ha appena accettato l'avviso. */
export function recordAcceptance(now: number = Date.now()): void {
  try { localStorage.setItem(KEY, String(now)); } catch { /* noop */ }
}

function readTs(): number | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}

/** Esiste già una sessione ma manca il timestamp (sessione precedente alla
 *  feature): la "innestiamo" da adesso così non sloggiamo subito gli utenti. */
export function ensureAcceptanceTs(now: number = Date.now()): void {
  if (readTs() === null) recordAcceptance(now);
}

/** True se l'ultima accettazione è più vecchia del TTL. Se manca il ts → false
 *  (la innesta `ensureAcceptanceTs`); così non si slogga mai a sorpresa. */
export function isSessionExpired(now: number = Date.now()): boolean {
  const ts = readTs();
  if (ts === null) return false;
  return now - ts > SESSION_TTL_MS;
}

/** Pulisce il timestamp (al logout), così il prossimo login ne scrive uno nuovo. */
export function clearAcceptance(): void {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}
