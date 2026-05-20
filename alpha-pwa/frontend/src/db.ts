import Dexie, { type Table } from 'dexie';

export interface CaseRecord {
  case_id: string;
  [key: string]: any;
}

export interface TaskRecord {
  id: string; // Typically case_id::task_name
  case_id: string;
  done: boolean;
}

export interface AppState {
  key: string;
  value: any;
}

export class PLTDatabase extends Dexie {
  cases!: Table<CaseRecord, string>;
  tasks!: Table<TaskRecord, string>;
  appState!: Table<AppState, string>;

  constructor() {
    super('plt');
    this.version(2).stores({
      cases: 'case_id',
      tasks: 'id, case_id',
      appState: 'key'
    });
  }
}

export const db = new PLTDatabase();

export async function dbSave(record: CaseRecord): Promise<void> {
  await db.cases.put(record);
}

export async function dbList(): Promise<CaseRecord[]> {
  return await db.cases.toArray();
}

export async function dbGet(id: string): Promise<CaseRecord | null> {
  return await db.cases.get(id) ?? null;
}

export async function dbDelete(id: string): Promise<void> {
  await db.cases.delete(id);
}
