import { createClient } from '@libsql/client';
import { SCHEMA_STATEMENTS, COLUMN_MIGRATIONS } from '../src/lib/db/schema';
import { E2E_DATABASE_URL } from './database';
import { E2E_FIXTURES } from './fixtures';
import { seedBookings } from './seed';

export default async function globalSetup() {
  const db = createClient({ url: E2E_DATABASE_URL });

  for (const statement of SCHEMA_STATEMENTS) {
    await db.execute(statement);
  }

  for (const statement of COLUMN_MIGRATIONS) {
    try {
      await db.execute(statement);
    } catch {}
  }

  const tables = await db.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
  );

  await db.execute('PRAGMA foreign_keys = OFF');

  for (const row of tables.rows) {
    await db.execute(`DELETE FROM "${row.name as string}"`);
  }

  await db.execute('PRAGMA foreign_keys = ON');

  db.close();

  await seedBookings(E2E_FIXTURES);
}
