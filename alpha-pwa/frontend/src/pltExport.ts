export const PLT_FORMAT = 'pocket-legal-triage.case';
export const PLT_VERSION = 1;
export const PBKDF2_ITERATIONS = 600000;

export type PlainPltContainer<T = unknown> = {
  format: typeof PLT_FORMAT;
  version: typeof PLT_VERSION;
  encrypted: false;
  exported_at: string;
  payload: T;
};

export type EncryptedPltContainer = {
  format: typeof PLT_FORMAT;
  version: typeof PLT_VERSION;
  encrypted: true;
  exported_at: string;
  kdf: {
    name: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    salt: string;
  };
  cipher: {
    name: 'AES-GCM';
    iv: string;
  };
  payload: string;
};

export type PltParseResult<T = unknown> =
  | { kind: 'case'; caseData: T; protected: false; legacy: boolean }
  | { kind: 'encrypted'; container: EncryptedPltContainer };

function requireCrypto(): Crypto {
  const c = globalThis.crypto;
  if (!c?.subtle || typeof c.getRandomValues !== 'function') {
    throw new Error('Cifratura non disponibile in questo browser.');
  }
  return c;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  if (typeof btoa === 'function') return btoa(binary);
  const BufferCtor = (globalThis as unknown as { Buffer?: { from: (value: Uint8Array | string, encoding?: string) => { toString: (encoding: string) => string } } }).Buffer;
  if (BufferCtor) return BufferCtor.from(bytes).toString('base64');
  throw new Error('Base64 non disponibile.');
}

function base64ToBytes(value: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  const BufferCtor = (globalThis as unknown as { Buffer?: { from: (value: string, encoding?: string) => Uint8Array } }).Buffer;
  if (BufferCtor) return new Uint8Array(BufferCtor.from(value, 'base64'));
  throw new Error('Base64 non disponibile.');
}

async function deriveAesKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const crypto = requireCrypto();
  const passwordBytes = new TextEncoder().encode(password);
  const passwordBuffer = passwordBytes.buffer.slice(passwordBytes.byteOffset, passwordBytes.byteOffset + passwordBytes.byteLength) as ArrayBuffer;
  const baseKey = await crypto.subtle.importKey('raw', passwordBuffer, 'PBKDF2', false, ['deriveKey']);
  const saltBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer;
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBuffer, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function looksLikeCase(value: unknown): boolean {
  return isRecord(value) && typeof value.case_id === 'string' && typeof value.case_title === 'string';
}

function assertSupportedContainer(value: Record<string, unknown>) {
  if (value.format !== PLT_FORMAT) throw new Error('File .plt non valido.');
  if (value.version !== PLT_VERSION) throw new Error('Questo file .plt usa una versione non supportata. Aggiorna PLT e riprova.');
}

export function exportPlainPlt<T>(caseData: T): PlainPltContainer<T> {
  return {
    format: PLT_FORMAT,
    version: PLT_VERSION,
    encrypted: false,
    exported_at: new Date().toISOString(),
    payload: caseData,
  };
}

export async function exportEncryptedPlt<T>(caseData: T, password: string): Promise<EncryptedPltContainer> {
  if (!password.trim()) throw new Error('Inserisci una password per proteggere il fascicolo.');
  const crypto = requireCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ivBuffer = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer;
  const key = await deriveAesKey(password, salt, PBKDF2_ITERATIONS);
  const plaintext = new TextEncoder().encode(JSON.stringify(caseData));
  const plaintextBuffer = plaintext.buffer.slice(plaintext.byteOffset, plaintext.byteOffset + plaintext.byteLength) as ArrayBuffer;
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivBuffer }, key, plaintextBuffer);

  return {
    format: PLT_FORMAT,
    version: PLT_VERSION,
    encrypted: true,
    exported_at: new Date().toISOString(),
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      salt: bytesToBase64(salt),
    },
    cipher: {
      name: 'AES-GCM',
      iv: bytesToBase64(iv),
    },
    payload: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function parsePltFile<T = unknown>(text: string): Promise<PltParseResult<T>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('File .plt non valido.');
  }

  if (!isRecord(parsed)) throw new Error('File .plt non valido.');

  if (parsed.format === PLT_FORMAT) {
    assertSupportedContainer(parsed);
    if (parsed.encrypted === true) {
      if (!isRecord(parsed.kdf) || !isRecord(parsed.cipher) || typeof parsed.payload !== 'string') {
        throw new Error('File .plt protetto non valido.');
      }
      const container = parsed as EncryptedPltContainer;
      if (container.kdf.name !== 'PBKDF2' || container.kdf.hash !== 'SHA-256' || container.cipher.name !== 'AES-GCM') {
        throw new Error('Questo file .plt usa una cifratura non supportata.');
      }
      return { kind: 'encrypted', container };
    }
    if (parsed.encrypted === false && 'payload' in parsed) {
      if (!looksLikeCase(parsed.payload)) throw new Error('File .plt non valido.');
      return { kind: 'case', caseData: parsed.payload as T, protected: false, legacy: false };
    }
    throw new Error('File .plt non valido.');
  }

  if (!looksLikeCase(parsed)) throw new Error('File non valido');
  return { kind: 'case', caseData: parsed as T, protected: false, legacy: true };
}

export async function decryptPltContainer<T = unknown>(container: EncryptedPltContainer, password: string): Promise<T> {
  try {
    const salt = base64ToBytes(container.kdf.salt);
    const iv = base64ToBytes(container.cipher.iv);
    const ivBuffer = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer;
    const ciphertext = base64ToBytes(container.payload);
    const ciphertextBuffer = ciphertext.buffer.slice(ciphertext.byteOffset, ciphertext.byteOffset + ciphertext.byteLength) as ArrayBuffer;
    const key = await deriveAesKey(password, salt, container.kdf.iterations);
    const plaintext = await requireCrypto().subtle.decrypt({ name: 'AES-GCM', iv: ivBuffer }, key, ciphertextBuffer);
    const decoded = new TextDecoder().decode(plaintext);
    const parsed = JSON.parse(decoded) as T;
    if (!looksLikeCase(parsed)) throw new Error('File .plt non valido.');
    return parsed;
  } catch {
    throw new Error('Password errata o file danneggiato.');
  }
}
