// IndexedDB persistence — all case data stays on device, never on PLT servers.
// Only the text sent to the AI API leaves the device (user's conscious choice).

const DB_NAME = 'plt';
const DB_VERSION = 2;
const LEGACY_STORE = 'cases';
const STORE = 'cases_v2';

export const ANONYMOUS_LOCAL_OWNER_ID = 'anonymous';
export const LEGACY_LOCAL_OWNER_ID = 'legacy';

type SessionLike = { user?: { id?: string | null } } | null | undefined;

export type LocalCaseRecord = {
  case_id: string;
  local_id?: string;
  local_owner_id?: string;
};

export function localOwnerIdFromSession(session: SessionLike): string {
  return session?.user?.id || ANONYMOUS_LOCAL_OWNER_ID;
}

export function localCaseKey(ownerId: string, caseId: string): string {
  return `${ownerId}::${caseId}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = event => {
      const db = req.result;
      let v2Store: IDBObjectStore | null = null;
      if (!db.objectStoreNames.contains(STORE)) {
        v2Store = db.createObjectStore(STORE, { keyPath: 'local_id' });
        v2Store.createIndex('local_owner_id', 'local_owner_id', { unique: false });
      } else {
        const tx = req.transaction;
        v2Store = tx?.objectStore(STORE) ?? null;
        if (v2Store && !v2Store.indexNames.contains('local_owner_id')) {
          v2Store.createIndex('local_owner_id', 'local_owner_id', { unique: false });
        }
      }

      if ((event.oldVersion || 0) < 2 && db.objectStoreNames.contains(LEGACY_STORE) && v2Store && req.transaction) {
        const legacyStore = req.transaction.objectStore(LEGACY_STORE);
        const legacyReq = legacyStore.getAll();
        legacyReq.onsuccess = () => {
          for (const record of legacyReq.result as LocalCaseRecord[]) {
            if (!record?.case_id) continue;
            v2Store?.put({
              ...record,
              local_owner_id: LEGACY_LOCAL_OWNER_ID,
              local_id: localCaseKey(LEGACY_LOCAL_OWNER_ID, record.case_id),
            });
          }
        };
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbClaimLegacyCases(ownerId: string): Promise<void> {
  if (!ownerId || ownerId === ANONYMOUS_LOCAL_OWNER_ID || ownerId === LEGACY_LOCAL_OWNER_ID) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const records = (req.result as LocalCaseRecord[]).filter(r => r.local_owner_id === LEGACY_LOCAL_OWNER_ID);
      for (const record of records) {
        store.delete(record.local_id ?? localCaseKey(LEGACY_LOCAL_OWNER_ID, record.case_id));
        store.put({
          ...record,
          local_owner_id: ownerId,
          local_id: localCaseKey(ownerId, record.case_id),
        });
      }
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function dbSave<T extends { case_id: string }>(ownerId: string, record: T): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const localRecord = {
      ...record,
      local_owner_id: ownerId,
      local_id: localCaseKey(ownerId, record.case_id),
    };
    tx.objectStore(STORE).put(localRecord);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function dbList<T extends { case_id: string }>(ownerId: string): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const index = store.indexNames.contains('local_owner_id') ? store.index('local_owner_id') : null;
    const req = index ? index.getAll(ownerId) : store.getAll();
    req.onsuccess = () => {
      db.close();
      resolve((req.result as (T & LocalCaseRecord)[]).filter(record => record.local_owner_id === ownerId));
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function dbGet<T extends { case_id: string }>(ownerId: string, id: string): Promise<T | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(localCaseKey(ownerId, id));
    req.onsuccess = () => { db.close(); resolve((req.result as T) ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function dbDelete(ownerId: string, id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(localCaseKey(ownerId, id));
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
