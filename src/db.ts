import * as SQLite from 'expo-sqlite';

export const STAGES = ['Found', 'Applied', 'Talking', 'Won', 'Lost'] as const;
export type Stage = (typeof STAGES)[number];
export const OPEN_STAGES: Stage[] = ['Found', 'Applied', 'Talking'];
export const KINDS = ['Job', 'Freelance gig', 'Client lead', 'Product', 'Other'] as const;
export const CURRENCIES = ['EGP', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

export type Item = {
  id: number;
  title: string;
  source: string;
  kind: string;
  stage: Stage;
  value: number;
  currency: Currency;
  link: string;
  notes: string;
  created_at: number;
  touched_at: number;
  notif_id: string | null;
};

export type Income = {
  id: number;
  source: string;
  amount: number;
  currency: Currency;
  amount_egp: number;
  received_at: number;
  note: string;
};

export type Settings = {
  followupDays: number;
  usdRate: number;
};

const db = SQLite.openDatabaseSync('pipeline.db');

export async function initDb(): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      kind TEXT NOT NULL,
      stage TEXT NOT NULL,
      value REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'EGP',
      link TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      touched_at INTEGER NOT NULL,
      notif_id TEXT
    );
    CREATE TABLE IF NOT EXISTS income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      amount_egp REAL NOT NULL,
      received_at INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS sources (
      name TEXT PRIMARY KEY,
      sort INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  const count = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM sources');
  if (!count || count.c === 0) {
    await db.runAsync('INSERT INTO sources (name, sort) VALUES (?, ?)', 'Tactful salary', 0);
  }
}

export async function getSources(): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>('SELECT name FROM sources ORDER BY sort, name');
  return rows.map((r) => r.name);
}

export async function addSource(name: string): Promise<void> {
  const max = await db.getFirstAsync<{ m: number | null }>('SELECT MAX(sort) AS m FROM sources');
  await db.runAsync('INSERT OR IGNORE INTO sources (name, sort) VALUES (?, ?)', name, (max?.m ?? 0) + 1);
}

export async function removeSource(name: string): Promise<void> {
  await db.runAsync('DELETE FROM sources WHERE name = ?', name);
}

export async function getSettings(): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    followupDays: Number(map.get('followupDays') ?? 3),
    usdRate: Number(map.get('usdRate') ?? 50),
  };
}

export async function saveSetting(key: keyof Settings, value: number): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, String(value));
}

export async function getItems(): Promise<Item[]> {
  return db.getAllAsync<Item>('SELECT * FROM items ORDER BY touched_at DESC');
}

export type ItemInput = Omit<Item, 'id' | 'created_at' | 'touched_at' | 'notif_id'>;

export async function insertItem(input: ItemInput): Promise<number> {
  const now = Date.now();
  const res = await db.runAsync(
    'INSERT INTO items (title, source, kind, stage, value, currency, link, notes, created_at, touched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    input.title,
    input.source,
    input.kind,
    input.stage,
    input.value,
    input.currency,
    input.link,
    input.notes,
    now,
    now,
  );
  return res.lastInsertRowId;
}

export async function updateItem(id: number, input: ItemInput): Promise<void> {
  await db.runAsync(
    'UPDATE items SET title = ?, source = ?, kind = ?, stage = ?, value = ?, currency = ?, link = ?, notes = ?, touched_at = ? WHERE id = ?',
    input.title,
    input.source,
    input.kind,
    input.stage,
    input.value,
    input.currency,
    input.link,
    input.notes,
    Date.now(),
    id,
  );
}

export async function setItemStage(id: number, stage: Stage): Promise<void> {
  await db.runAsync('UPDATE items SET stage = ?, touched_at = ? WHERE id = ?', stage, Date.now(), id);
}

export async function touchItem(id: number): Promise<void> {
  await db.runAsync('UPDATE items SET touched_at = ? WHERE id = ?', Date.now(), id);
}

export async function setItemNotif(id: number, notifId: string | null): Promise<void> {
  await db.runAsync('UPDATE items SET notif_id = ? WHERE id = ?', notifId, id);
}

export async function getItem(id: number): Promise<Item | null> {
  return db.getFirstAsync<Item>('SELECT * FROM items WHERE id = ?', id);
}

export async function deleteItem(id: number): Promise<void> {
  await db.runAsync('DELETE FROM items WHERE id = ?', id);
}

export async function getIncomeBetween(from: number, to: number): Promise<Income[]> {
  return db.getAllAsync<Income>(
    'SELECT * FROM income WHERE received_at >= ? AND received_at < ? ORDER BY received_at DESC',
    from,
    to,
  );
}

export async function insertIncome(input: Omit<Income, 'id'>): Promise<void> {
  await db.runAsync(
    'INSERT INTO income (source, amount, currency, amount_egp, received_at, note) VALUES (?, ?, ?, ?, ?, ?)',
    input.source,
    input.amount,
    input.currency,
    input.amount_egp,
    input.received_at,
    input.note,
  );
}

export async function deleteIncome(id: number): Promise<void> {
  await db.runAsync('DELETE FROM income WHERE id = ?', id);
}

export type Backup = {
  app: 'pipeline';
  version: 1;
  exported_at: number;
  items: Item[];
  income: Income[];
  sources: string[];
  settings: Settings;
};

export async function exportAll(): Promise<Backup> {
  return {
    app: 'pipeline',
    version: 1,
    exported_at: Date.now(),
    items: await db.getAllAsync<Item>('SELECT * FROM items'),
    income: await db.getAllAsync<Income>('SELECT * FROM income'),
    sources: await getSources(),
    settings: await getSettings(),
  };
}

export async function importAll(data: Backup): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM items; DELETE FROM income; DELETE FROM sources; DELETE FROM settings;');
    for (const [i, name] of data.sources.entries()) {
      await db.runAsync('INSERT OR IGNORE INTO sources (name, sort) VALUES (?, ?)', name, i);
    }
    for (const it of data.items) {
      await db.runAsync(
        'INSERT INTO items (id, title, source, kind, stage, value, currency, link, notes, created_at, touched_at, notif_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)',
        it.id,
        it.title,
        it.source,
        it.kind,
        it.stage,
        it.value,
        it.currency,
        it.link,
        it.notes,
        it.created_at,
        it.touched_at,
      );
    }
    for (const r of data.income) {
      await db.runAsync(
        'INSERT INTO income (id, source, amount, currency, amount_egp, received_at, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
        r.id,
        r.source,
        r.amount,
        r.currency,
        r.amount_egp,
        r.received_at,
        r.note,
      );
    }
    await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', 'followupDays', String(data.settings.followupDays));
    await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', 'usdRate', String(data.settings.usdRate));
  });
}
