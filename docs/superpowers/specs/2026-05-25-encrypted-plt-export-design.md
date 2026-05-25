# Encrypted PLT Export Design

## Goal

Make `.plt` case export safer while preserving the local-first workflow: cases stay on the device, and users can manually transfer a fascicolo to another device or colleague by sending the exported file and sharing the password separately.

## Product decision

Encrypted export is **default but optional**.

- Default: password-protected `.plt` using browser-native encryption.
- Optional: unprotected `.plt`, behind clear warning copy.
- Existing plaintext `.plt` imports remain supported for backward compatibility.
- The file is portable: any recipient with the encrypted `.plt` and correct password can import it. It is not tied to the original user or device.

## Terminology

Italian UI must use **Anonimizza**, not **Redigi**. In Italian, “redigere” means drafting/writing; “anonimizzare” is the correct product concept for replacing identifying information.

Existing copy/buttons should change:

- `Redigi` → `Anonimizza`
- `Redatto` → `Anonimizzato` or `Vista anonimizzata`
- `Gestione redazione dati` → `Anonimizza dati sensibili`
- `Attiva modalità redatta` → `Mostra vista anonimizzata`
- `Mostra dati originali` remains acceptable, or `Torna ai dati originali`

## Export copy — Italian

### Modal title

```text
Esporta fascicolo
```

### Intro

```text
I fascicoli restano su questo dispositivo. L’esportazione crea un file .plt che puoi trasferire manualmente su un altro dispositivo o inviare a un collega.
```

### Default protected option

```text
Proteggi con password — consigliato
```

Helper:

```text
Il contenuto del fascicolo viene cifrato nel browser prima del download. PLT non salva il file e non conosce la password.
```

Password note:

```text
Chi riceve il file potrà aprirlo su un altro dispositivo, ma solo con questa password. Se la perdi, PLT non può recuperarla.
```

Channel note:

```text
Consiglio: invia la password con un canale diverso dal file.
```

Primary button:

```text
Esporta .plt protetto
```

### Unprotected option

```text
Esporta senza password
```

Warning:

```text
Il file .plt non protetto contiene i dati del fascicolo in chiaro. Usalo solo per debug, archiviazione locale sicura o dopo aver anonimizzato i dati sensibili.
```

Recommendation:

```text
Prima di inviare un .plt non protetto, usa “Anonimizza” per sostituire nomi, indirizzi, numeri di procedimento e altri dati identificativi.
```

Confirmation:

```text
Confermi di voler esportare un file non protetto?
Il contenuto sarà leggibile da chiunque abbia accesso al file.
```

Buttons:

```text
Torna alla protezione con password
Esporta comunque
```

## Import copy — Italian

Encrypted `.plt`:

```text
Fascicolo protetto
Questo file .plt è cifrato. Inserisci la password usata al momento dell’esportazione.
```

Button:

```text
Sblocca e importa
```

Wrong password/corrupt file:

```text
Password errata o file danneggiato.
```

Unsupported version:

```text
Questo file .plt usa una versione non supportata. Aggiorna PLT e riprova.
```

Plain legacy `.plt` warning:

```text
Questo .plt non è protetto da password. Importalo solo se proviene da una fonte affidabile.
```

## File format

Keep the `.plt` extension.

### Legacy plaintext

Current raw case JSON remains valid:

```json
{
  "case_id": "...",
  "case_title": "..."
}
```

### New plaintext container

```json
{
  "format": "pocket-legal-triage.case",
  "version": 1,
  "encrypted": false,
  "exported_at": "2026-05-25T00:00:00.000Z",
  "payload": { "case_id": "..." }
}
```

### New encrypted container

```json
{
  "format": "pocket-legal-triage.case",
  "version": 1,
  "encrypted": true,
  "exported_at": "2026-05-25T00:00:00.000Z",
  "kdf": {
    "name": "PBKDF2",
    "hash": "SHA-256",
    "iterations": 600000,
    "salt": "base64..."
  },
  "cipher": {
    "name": "AES-GCM",
    "iv": "base64..."
  },
  "payload": "base64 ciphertext..."
}
```

The encrypted payload contains the UTF-8 encoded case JSON.

## Crypto design

Use browser-native Web Crypto:

- KDF: PBKDF2-HMAC-SHA256
- Iterations: 600,000 initially, stored in file for future migration
- Cipher: AES-256-GCM
- Salt: random 16 bytes
- IV: random 12 bytes per export
- Key: derived from password; never stored

No server, no paid service, no external crypto dependency for v1.

## Anonymize button visibility

The current toolbar button is too subtle for a privacy-critical action. Replace it with a more visible button:

```text
Anonimizza
```

Recommended style: bright privacy/security accent with a restrained gradient. “Rainbow colored” is acceptable as an attention cue, but it should still look professional rather than clownish. Use a multi-color gradient border/background with high contrast text, e.g. violet → blue → emerald, with a subtle glow. It should be more visible than Export.

When rules exist, show count:

```text
Anonimizza · 3
```

When anonymized view is active:

```text
Vista anonimizzata
```

## Export content rules

- Encrypted export defaults to original case data.
- Unprotected export should strongly recommend anonymization first.
- If anonymization rules exist, unprotected export should offer/export an anonymized copy by default.
- Current `handleExport()` exports `caseData`, not the redacted/anonymized display object. This must be corrected for anonymized export paths.

## Acceptance criteria

1. Export modal defaults to password-protected `.plt`.
2. User can still export unprotected `.plt` after warning.
3. Encrypted `.plt` imports on another device/browser with the correct password.
4. Wrong password fails with sane Italian error.
5. Encrypted `.plt` file does not contain case title, client name, or summary in plaintext.
6. Legacy plaintext `.plt` imports still work.
7. UI uses `Anonimizza`, not `Redigi`.
8. Anonimizza button is visually prominent and accessible.
9. Unprotected export copy recommends anonymization before sharing.
10. Tests cover crypto helpers, import/export parsing, Italian copy, and button visibility CSS.
