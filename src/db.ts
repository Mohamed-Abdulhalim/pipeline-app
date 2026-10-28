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

export type Expense = {
  id: number;
  category: string;
  amount: number;
  currency: Currency;
  amount_egp: number;
  spent_at: number;
  note: string;
  subcategory: string;
};

export type SavingKind = 'save' | 'withdraw';

export type Saving = {
  id: number;
  kind: SavingKind;
  amount: number;
  currency: Currency;
  amount_egp: number;
  saved_at: number;
  note: string;
  hidden: number;
};

export type PlanKind = 'income' | 'expense' | 'saving' | 'sub';

export const SUB_SEP = ' \u203A ';

export type PlanLine = {
  month: string;
  kind: PlanKind;
  label: string;
  amount: number;
};

export type Settings = {
  followupDays: number;
  usdRate: number;
  showHidden: number;
  showPipeline: number;
};

export const DEFAULT_CATEGORIES = ['Rent', 'Bills', 'Food', 'Transport', 'Family', 'Health', 'Subscriptions', 'Other'];

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
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      amount_egp REAL NOT NULL,
      spent_at INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS categories (
      name TEXT PRIMARY KEY,
      sort INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS subcategories (
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      sort INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (category, name)
    );
    CREATE TABLE IF NOT EXISTS plan_lines (
      month TEXT NOT NULL,
      kind TEXT NOT NULL,
      label TEXT NOT NULL,
      amount REAL NOT NULL,
      PRIMARY KEY (month, kind, label)
    );
    CREATE TABLE IF NOT EXISTS savings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL DEFAULT 'save',
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      amount_egp REAL NOT NULL,
      saved_at INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      hidden INTEGER NOT NULL DEFAULT 0
    );
  `);
  const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(expenses)');
  if (!cols.some((c) => c.name === 'subcategory')) {
    await db.execAsync("ALTER TABLE expenses ADD COLUMN subcategory TEXT NOT NULL DEFAULT ''");
  }
  const count = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM sources');
  if (!count || count.c === 0) {
    await db.runAsync('INSERT INTO sources (name, sort) VALUES (?, ?)', 'Salary', 0);
  }
  const cats = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM categories');
  if (!cats || cats.c === 0) await seedCategories(DEFAULT_CATEGORIES);
}

async function seedCategories(names: string[]): Promise<void> {
  for (const [i, name] of names.entries()) {
    await db.runAsync('INSERT OR IGNORE INTO categories (name, sort) VALUES (?, ?)', name, i);
  }
}

export async function getCategories(): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>('SELECT name FROM categories ORDER BY sort, name');
  return rows.map((r) => r.name);
}

export async function addCategory(name: string): Promise<void> {
  const max = await db.getFirstAsync<{ m: number | null }>('SELECT MAX(sort) AS m FROM categories');
  await db.runAsync('INSERT OR IGNORE INTO categories (name, sort) VALUES (?, ?)', name, (max?.m ?? 0) + 1);
}

export async function removeCategory(name: string): Promise<void> {
  await db.runAsync('DELETE FROM categories WHERE name = ?', name);
  await db.runAsync('DELETE FROM subcategories WHERE category = ?', name);
}

export async function renameCategory(from: string, to: string): Promise<boolean> {
  if (from === to) return true;
  const clash = await db.getFirstAsync('SELECT 1 FROM categories WHERE name = ?', to);
  if (clash) return false;
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE categories SET name = ? WHERE name = ?', to, from);
    await db.runAsync('UPDATE subcategories SET category = ? WHERE category = ?', to, from);
    await db.runAsync('UPDATE expenses SET category = ? WHERE category = ?', to, from);
    await db.runAsync("UPDATE plan_lines SET label = ? WHERE kind = 'expense' AND label = ?", to, from);
    await db.runAsync(
      "UPDATE plan_lines SET label = ? || substr(label, ?) WHERE kind = 'sub' AND label LIKE ? ESCAPE '\\'",
      to,
      from.length + 1,
      `${from.replace(/[\\%_]/g, (m) => `\\${m}`)}${SUB_SEP}%`,
    );
  });
  return true;
}

export async function getSubcategories(): Promise<Record<string, string[]>> {
  const rows = await db.getAllAsync<{ category: string; name: string }>('SELECT category, name FROM subcategories ORDER BY sort, name');
  const out: Record<string, string[]> = {};
  for (const r of rows) (out[r.category] ??= []).push(r.name);
  return out;
}

export async function addSubcategory(category: string, name: string): Promise<boolean> {
  const clash = await db.getFirstAsync('SELECT 1 FROM subcategories WHERE category = ? AND name = ?', category, name);
  if (clash) return false;
  const max = await db.getFirstAsync<{ m: number | null }>('SELECT MAX(sort) AS m FROM subcategories WHERE category = ?', category);
  await db.runAsync('INSERT INTO subcategories (category, name, sort) VALUES (?, ?, ?)', category, name, (max?.m ?? 0) + 1);
  return true;
}

export async function renameSubcategory(category: string, from: string, to: string): Promise<boolean> {
  if (from === to) return true;
  const clash = await db.getFirstAsync('SELECT 1 FROM subcategories WHERE category = ? AND name = ?', category, to);
  if (clash) return false;
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE subcategories SET name = ? WHERE category = ? AND name = ?', to, category, from);
    await db.runAsync('UPDATE expenses SET subcategory = ? WHERE category = ? AND subcategory = ?', to, category, from);
    await db.runAsync("UPDATE plan_lines SET label = ? WHERE kind = 'sub' AND label = ?", `${category}${SUB_SEP}${to}`, `${category}${SUB_SEP}${from}`);
  });
  return true;
}

export async function removeSubcategory(category: string, name: string): Promise<void> {
  await db.runAsync('DELETE FROM subcategories WHERE category = ? AND name = ?', category, name);
}

export async function getExpensesBetween(from: number, to: number): Promise<Expense[]> {
  return db.getAllAsync<Expense>(
    'SELECT * FROM expenses WHERE spent_at >= ? AND spent_at < ? ORDER BY spent_at DESC',
    from,
    to,
  );
}

export async function insertExpense(input: Omit<Expense, 'id'>): Promise<void> {
  await db.runAsync(
    'INSERT INTO expenses (category, subcategory, amount, currency, amount_egp, spent_at, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
    input.category,
    input.subcategory,
    input.amount,
    input.currency,
    input.amount_egp,
    input.spent_at,
    input.note,
  );
}

export async function deleteExpense(id: number): Promise<void> {
  await db.runAsync('DELETE FROM expenses WHERE id = ?', id);
}

export async function getSavingsBetween(from: number, to: number): Promise<Saving[]> {
  return db.getAllAsync<Saving>(
    'SELECT * FROM savings WHERE saved_at >= ? AND saved_at < ? ORDER BY saved_at DESC, id DESC',
    from,
    to,
  );
}

export async function getAllSavings(): Promise<Saving[]> {
  return db.getAllAsync<Saving>('SELECT * FROM savings ORDER BY saved_at DESC, id DESC');
}

export async function insertSaving(input: Omit<Saving, 'id'>): Promise<void> {
  await db.runAsync(
    'INSERT INTO savings (kind, amount, currency, amount_egp, saved_at, note, hidden) VALUES (?, ?, ?, ?, ?, ?, ?)',
    input.kind,
    input.amount,
    input.currency,
    input.amount_egp,
    input.saved_at,
    input.note,
    input.hidden,
  );
}

export async function setSavingHidden(id: number, hidden: boolean): Promise<void> {
  await db.runAsync('UPDATE savings SET hidden = ? WHERE id = ?', hidden ? 1 : 0, id);
}

export async function deleteSaving(id: number): Promise<void> {
  await db.runAsync('DELETE FROM savings WHERE id = ?', id);
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function getPlan(month: string): Promise<PlanLine[]> {
  return db.getAllAsync<PlanLine>('SELECT * FROM plan_lines WHERE month = ? ORDER BY kind, label', month);
}

export async function savePlan(month: string, lines: Omit<PlanLine, 'month'>[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM plan_lines WHERE month = ?', month);
    for (const l of lines) {
      if (l.amount > 0) {
        await db.runAsync('INSERT INTO plan_lines (month, kind, label, amount) VALUES (?, ?, ?, ?)', month, l.kind, l.label, l.amount);
      }
    }
  });
}

export function savingsNet(rows: Saving[], includeHidden: boolean): number {
  return rows
    .filter((r) => includeHidden || !r.hidden)
    .reduce((a, r) => a + (r.kind === 'save' ? r.amount_egp : -r.amount_egp), 0);
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
    showHidden: Number(map.get('showHidden') ?? 0),
    showPipeline: Number(map.get('showPipeline') ?? 1),
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
  version: number;
  exported_at: number;
  items: Item[];
  income: Income[];
  expenses?: Expense[];
  savings?: Saving[];
  plans?: PlanLine[];
  sources: string[];
  categories?: string[];
  subcategories?: { category: string; name: string; sort: number }[];
  settings: Settings;
};

export async function exportAll(): Promise<Backup> {
  return {
    app: 'pipeline',
    version: 4,
    exported_at: Date.now(),
    items: await db.getAllAsync<Item>('SELECT * FROM items'),
    income: await db.getAllAsync<Income>('SELECT * FROM income'),
    expenses: await db.getAllAsync<Expense>('SELECT * FROM expenses'),
    savings: await db.getAllAsync<Saving>('SELECT * FROM savings'),
    plans: await db.getAllAsync<PlanLine>('SELECT * FROM plan_lines'),
    sources: await getSources(),
    categories: await getCategories(),
    subcategories: await db.getAllAsync<{ category: string; name: string; sort: number }>('SELECT * FROM subcategories'),
    settings: await getSettings(),
  };
}

export async function importAll(data: Backup): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync(
      'DELETE FROM items; DELETE FROM income; DELETE FROM expenses; DELETE FROM savings; DELETE FROM plan_lines; DELETE FROM sources; DELETE FROM categories; DELETE FROM subcategories; DELETE FROM settings;',
    );
    await seedCategories(data.categories?.length ? data.categories : DEFAULT_CATEGORIES);
    for (const sc of data.subcategories ?? []) {
      await db.runAsync('INSERT OR IGNORE INTO subcategories (category, name, sort) VALUES (?, ?, ?)', sc.category, sc.name, sc.sort ?? 0);
    }
    for (const l of data.plans ?? []) {
      await db.runAsync('INSERT OR REPLACE INTO plan_lines (month, kind, label, amount) VALUES (?, ?, ?, ?)', l.month, l.kind, l.label, l.amount);
    }
    for (const v of data.savings ?? []) {
      await db.runAsync(
        'INSERT INTO savings (id, kind, amount, currency, amount_egp, saved_at, note, hidden) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        v.id,
        v.kind,
        v.amount,
        v.currency,
        v.amount_egp,
        v.saved_at,
        v.note,
        v.hidden,
      );
    }
    for (const e of data.expenses ?? []) {
      await db.runAsync(
        'INSERT INTO expenses (id, category, subcategory, amount, currency, amount_egp, spent_at, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        e.id,
        e.category,
        e.subcategory ?? '',
        e.amount,
        e.currency,
        e.amount_egp,
        e.spent_at,
        e.note,
      );
    }
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
    await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', 'showHidden', String(data.settings.showHidden ?? 0));
    await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?)', 'showPipeline', String(data.settings.showPipeline ?? 1));
  });
}
