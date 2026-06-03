# App-lock (PIN + biometria opzionale) — design

_Data: 2026-06-03 · Vale per **entrambe** le app: PLT (`/home/deckard/projects/plt/alpha-pwa/frontend`) e SchedaPRO (`/home/deckard/projects/schedapro/frontend`). Design identico, chiavi e copy namespaced._

## Problema

Oggi, dopo un login, la sessione Supabase è persistente all'infinito (`persistSession: true`, `autoRefreshToken: true`, default del client). I dati dei fascicoli/clienti vivono **solo in IndexedDB sul dispositivo** (local-first, nessuna copia server). Quindi:

- un device perso / rubato / condiviso dà accesso completo ai dati sensibili;
- il logout azzera solo la sessione, **non** cancella IndexedDB — e non deve, perché cancellare = perdita totale del lavoro non esportato.

Serve proteggere l'accesso senza mai rischiare i dati local-only.

## Decisioni (concordate)

| Tema | Scelta |
|---|---|
| Metodo sblocco | **PIN a 4 cifre** + **biometria opzionale** (WebAuthn) dove supportata |
| Cosa protegge | **Cancello UI** (Approccio A): blocca il render dell'app; i dati NON sono cifrati col PIN |
| Recupero | **Re-login email+password** resetta il PIN (la password Supabase resta la radice) |
| Quando blocca | **Avvio freddo** + **ritorno dal background/inattività oltre N minuti** (default 5) |
| Attivazione | **Proposto al 1° login** (skippabile), gestibile da Profilo |
| Biometria | **Fast-follow**: il PIN è pienamente funzionante da solo; la biometria si aggiunge e degrada con grazia |

### Perché il cancello UI e non la cifratura at-rest

La cifratura dei dati con chiave derivata dal PIN sarebbe sicura anche contro la forensica, ma **rompe il recupero scelto**: se il re-login resetta il PIN, i dati cifrati con il vecchio PIN diventerebbero illeggibili → perdita dati. Inoltre richiederebbe cifra/decifra su ogni lettura/scrittura IndexedDB. Il cancello UI è coerente con "re-login resetta il PIN", protegge dalla minaccia reale (accesso casuale a un device perso/sbloccato) e non mette mai a rischio i dati. _Limite noto e accettato per l'alpha:_ un attaccante tecnico con il device può leggere IndexedDB via DevTools bypassando la UI. La cifratura at-rest resta un'opzione futura; l'export `.plt`/`.spr` già copre la condivisione cifrata.

## Architettura

Catena di render nell'`App`:

```
session ? (lockEnabled && locked ? <LockScreen/> : <app shell>) : <AuthScreen/>
```

Lo stato di lock è **locale**, indipendente dalla sessione Supabase e posto sopra l'app shell, sotto la guardia di sessione.

### Unità

- **`src/lock/appLock.ts`** — gestione stato + persistenza + crypto. Stesso pattern pub/sub di `analysis/analysisManager.ts` (`useSyncExternalStore`). Nessuna dipendenza da React nelle parti pure (hash/verify/state) così sono testabili da solo.
- **`src/lock/LockGate.tsx`** — wrapper: legge config+stato; se `enabled && locked` rende `<LockScreen/>`, altrimenti `children`.
- **`src/lock/LockScreen.tsx`** — UI di sblocco (tastierino 4 cifre, bottone biometria, "PIN dimenticato?").
- **`src/lock/LockSetup.tsx`** — flusso di creazione/gestione PIN (prompt 1° login + pannello in Profilo).
- **CSS**: `src/lock/lock.css` (pattern già usato da `analysis/`).

### Interfaccia di `appLock.ts` (bozza)

```ts
interface LockConfig { enabled: boolean; pinHash: string; pinSalt: string; biometric: { credId: string } | null; idleTimeoutMin: number; }
type LockState = { locked: boolean; attempts: number; cooldownUntil: number | null };

loadConfig(userId): LockConfig | null
setPin(userId, pin): Promise<void>            // PBKDF2 → salva hash+salt, enabled=true
verifyPin(userId, pin): Promise<boolean>      // hash input, confronto
clearLock(userId): void                       // recovery: rimuove l'INTERA config (chiave localStorage) → loadConfig torna null
isLockEnabled(userId): boolean
lock() / unlock() / noteActivity()
registerBiometric(userId): Promise<boolean>   // WebAuthn create
unlockWithBiometric(userId): Promise<boolean> // WebAuthn get
useLockState(): LockState                      // useSyncExternalStore
useLockConfig(userId): LockConfig | null
```

## Storage (locale, mai sul server)

`localStorage`, chiave per-account: `plt:applock:<userId>` / `spr:applock:<userId>`:

```json
{ "enabled": true, "pinHash": "<base64>", "pinSalt": "<base64>", "biometric": { "credId": "<base64>" }, "idleTimeoutMin": 5 }
```

- PIN (4 cifre) hashato con **Web Crypto PBKDF2-SHA256**, ~100k iterazioni, salt random a 16 byte. Mai in chiaro, mai trasmesso.
- Legato allo `userId` (da `session.user.id`) così cambiare account non eredita il lock.
- `lastActiveAt` (timestamp) in `localStorage` (`plt:applock:lastActive`) per il calcolo idle anche tra reload.

## Quando blocca

- **Avvio freddo:** al mount, se `enabled` → `locked = true`. (Il warm-up ping del backend è già al top di `App` e parte _prima_ del cancello — vedi sotto.)
- **Background / inattività:** su `visibilitychange → hidden` registro il timestamp; al `visible`, se `now - hidden > idleTimeoutMin*60s` → `lock()`. In più un timer d'inattività in-tab resettato dall'interazione (`noteActivity` su pointer/keydown), che blocca dopo `idleTimeoutMin`.

## Sblocco (`LockScreen`)

- Tastierino numerico, 4 pallini; all'inserimento della 4ª cifra → `verifyPin`.
- Bottone biometria se `biometric != null` e WebAuthn disponibile.
- PIN errato → shake + incremento `attempts`. Dopo **5** errori → cooldown progressivo (30s, poi crescente), tastierino disabilitato durante il cooldown. **Nessuna cancellazione dati in nessun caso.**
- Link "PIN dimenticato?" → vedi Recupero.

## Biometria (WebAuthn, best-effort / fast-follow)

- Attivazione: `navigator.credentials.create({ publicKey: { ..., authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' } } })` → salvo `credId`.
- Sblocco: `navigator.credentials.get({ publicKey: { allowCredentials: [{ id: credId }], userVerification: 'required' } })` → un assertion riuscito = sbloccato (fiducia **locale**, nessuna verifica server: è un gate locale, non un'autenticazione server-side).
- Degrado: se `!window.PublicKeyCredential` o create/get falliscono → opzione nascosta, resta il PIN.
- **Fasaggio:** il PIN è completo e spedibile da solo; la biometria si aggiunge dopo. Strutturare `appLock.ts` così che il ramo biometrico sia isolato e disattivabile senza toccare il PIN.

## Setup & gestione (`LockSetup`)

- Dopo il 1° login, se `loadConfig(userId) == null`: schermata one-shot "Proteggi l'app con un PIN" → **[Imposta PIN]** (inserito due volte, devono combaciare) / **[Più tardi]**. "Più tardi" scrive una config `enabled:false` così non ri-chiede a ogni avvio (ri-proponibile da Profilo).
- Dopo aver impostato il PIN, offerta opzionale di attivare la biometria.
- Da **Profilo** (`AccountControls`): attiva/disattiva il lock, cambia PIN (richiede il PIN attuale), on/off biometria.

## Recupero

"PIN dimenticato?" → conferma → `clearLock(userId)` (rimuove **l'intera config** dal localStorage → `loadConfig` torna `null`) + `supabase.auth.signOut()` → `AuthScreen`. Dopo il re-login con email+password, essendo `config == null`, riappare il prompt di setup. (Nota: "Più tardi" invece scrive `{enabled:false}` — un record che evita il ri-prompt a ogni avvio; il recupero rimuove proprio quel record così il prompt torna.) La password Supabase è la credenziale radice; chi la conosce può sempre rientrare (corretto). Protegge dal device perso/rubato da chi **non** conosce la password.

## Warm-up ping (requisito esplicito)

Il `fetch('${API}/api/health').catch(()=>{})` in `useEffect([])` in cima ad `App()` **resta lì e parte immediatamente** al caricamento pagina, **prima e indipendentemente** dal cancello di lock/auth. Così il backend Render (cold-start ~30-50s) si scalda mentre l'utente legge il disclaimer / fa login / **digita il PIN**. Il design dell'app-lock non lo sposta né lo ritarda.

## Gestione errori

- PIN errato → feedback visivo, conteggio, cooldown dopo 5 (nessun wipe).
- WebAuthn assente/fallito → fallback automatico al PIN.
- `localStorage` non disponibile / config corrotta → `loadConfig` ritorna `null` (lock di fatto disattivo, app accessibile con sola sessione); nessun crash.
- PIN dimenticato → recupero via re-login (sopra), nessuna perdita dati.

## Test

- **Unit (parti pure):** PBKDF2 hash/verify (stesso PIN → match; PIN diverso → no), `clearLock`, transizioni di stato (locked/unlocked/cooldown). Web Crypto disponibile in Node 20+ via `globalThis.crypto.subtle`.
- **Check-script** (`scripts/check-*.mjs`): wiring di `LockGate` nella catena di render, presenza di `LockScreen`/`LockSetup`, recovery che chiama `signOut`, e il warm-up ping al top di `App`.
- **Build/type:** `npm run build` su entrambe.

## Scope & non-obiettivi

- **In scope:** PIN gate completo (setup, sblocco, triggers, recupero, gestione da Profilo) su entrambe le app; biometria come fast-follow.
- **Fuori scope (ora):** cifratura dei dati at-rest; sync server dei dati; lockout distruttivo; policy di scadenza sessione lato Supabase.

## Fasaggio implementazione

1. **Fase 1 — ✅ SHIPPED (2026-06-03):** `appLock.ts` (config + PBKDF2 + state machine), `LockGate`, `LockScreen` (solo PIN), `LockSetup` (prompt + Profilo), triggers avvio/idle, recupero. Test (`test:app-lock`) + build. Su entrambe le app. _PLT `b4948537`, SchedaPRO `bdae9f4d3`._ Verificato live su SchedaPRO Netlify (PIN a 4 cifre funzionante).
2. **Fase 2 — ✅ SHIPPED (2026-06-03):** biometria WebAuthn (register/unlock + degrado), bottone nel `LockScreen`, step opzionale nel setup, toggle in Profilo. _PLT `ff2eceb5`, SchedaPRO `fa9228fd0`._

### Note operative emerse

- La credenziale biometrica è legata al **dominio** (rp.id = dominio corrente). Su dominio custom futuro gli utenti dovranno ri-registrare la biometria.
- Su desktop senza autenticatore di piattaforma l'attivazione biometrica può fallire/annullarsi: previsto, resta il PIN. La UI mostra l'opzione su `isBiometricSupported()` (sync); un gating più fine su `isPlatformAuthenticatorAvailable()` (async) è un miglioramento possibile.
