import { createClient } from '@libsql/client';
import { rmSync } from 'fs';
import { SCHEMA_STATEMENTS, COLUMN_MIGRATIONS } from '../src/lib/db/schema';
import { E2E_DATABASE_FILE, E2E_DATABASE_URL } from './database';
import { E2E_FIXTURES } from './fixtures';
import { seedBookings } from './seed';

export default async function globalSetup() {
  rmSync(E2E_DATABASE_FILE, { force: true });
  rmSync(`${E2E_DATABASE_FILE}-shm`, { force: true });
  rmSync(`${E2E_DATABASE_FILE}-wal`, { force: true });

  const db = createClient({ url: E2E_DATABASE_URL });

  for (const statement of SCHEMA_STATEMENTS) {
    await db.execute(statement);
  }

  for (const statement of COLUMN_MIGRATIONS) {
    try {
      await db.execute(statement);
    } catch {
      // migrations are idempotent, an already-applied one is expected here
    }
  }

  db.close();

  await seedBookings(E2E_FIXTURES);
}
