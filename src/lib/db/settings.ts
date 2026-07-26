import { getDb, ensureSchema } from './client';

export async function getSetting<T>(key: string): Promise<T | null> {
  await ensureSchema();
  const result = await getDb().execute({
    sql: 'SELECT value FROM app_settings WHERE key = ?',
    args: [key]
  });

  const raw = result.rows[0]?.value;
  if (typeof raw !== 'string') return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await ensureSchema();
  await getDb().execute({
    sql: `INSERT INTO app_settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    args: [key, JSON.stringify(value)]
  });
}
