import { resolve } from 'path';

export const E2E_DATABASE_FILE = resolve(process.cwd(), 'data/e2e.db');
export const E2E_DATABASE_URL = `file:${E2E_DATABASE_FILE}`;
