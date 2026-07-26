import { createClient, type Client } from '@libsql/client';
import { SCHEMA_STATEMENTS, COLUMN_MIGRATIONS } from './schema';

const globalForDb = globalThis as unknown as {
  dbClient?: Client;
  dbReady?: Promise<void>;
};

function buildClient(): Client {
  const url = process.env.DATABASE_URL || 'file:data/gvt-coach.db';
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  return createClient(authToken ? { url, authToken } : { url });
}

export function getDb(): Client {
  if (!globalForDb.dbClient) {
    globalForDb.dbClient = buildClient();
  }
  return globalForDb.dbClient;
}

export function ensureSchema(): Promise<void> {
  if (!globalForDb.dbReady) {
    globalForDb.dbReady = (async () => {
      const db = getDb();
      for (const statement of SCHEMA_STATEMENTS) {
        await db.execute(statement);
      }
      for (const statement of COLUMN_MIGRATIONS) {
        try {
          await db.execute(statement);
        } catch (error) {
          if (!String(error).includes('duplicate column name')) {
            throw error;
          }
        }
      }
    })();
  }
  return globalForDb.dbReady;
}
