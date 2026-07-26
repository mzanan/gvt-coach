import type { Row } from '@libsql/client';
import { getDb, ensureSchema } from './client';
import { CoachRecord, CoachPaymentProvider, CoachMeetingProvider } from '@/types/coach';
import { COACHES_CONFIG } from '@/config/coaches';

export type { CoachRecord };

function rowToCoach(row: Row): CoachRecord {
  const record = row as Record<string, unknown>;
  return {
    id: String(record.id),
    name: String(record.name),
    displayName: String(record.display_name),
    description: String(record.description ?? ''),
    photoUrl: String(record.photo_url ?? ''),
    timezone: String(record.timezone),
    email: String(record.email),
    workingHours: JSON.parse(String(record.working_hours)),
    prices: JSON.parse(String(record.prices)),
    paymentProvider: String(record.payment_provider) as CoachPaymentProvider,
    meetingProvider: String(record.meeting_provider) as CoachMeetingProvider,
    polarProductId: String(record.polar_product_id ?? ''),
  };
}

async function seedFromDefaults(): Promise<void> {
  const defaultPaymentProvider = process.env.NEXT_PUBLIC_GVT_COACH_PAYMENT_PROVIDER || 'stripe';

  for (const [id, coach] of Object.entries(COACHES_CONFIG)) {
    await getDb().execute({
      sql: `INSERT INTO coaches (id, name, display_name, description, photo_url, timezone, email, working_hours, prices, payment_provider, meeting_provider, polar_product_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        coach.name,
        coach.displayName,
        coach.description,
        coach.photoUrl,
        coach.timezone,
        coach.email,
        JSON.stringify(coach.workingHours),
        JSON.stringify(coach.prices),
        defaultPaymentProvider,
        'zoom',
        '',
      ]
    });
  }
}

export async function listCoaches(): Promise<CoachRecord[]> {
  await ensureSchema();
  let result = await getDb().execute('SELECT * FROM coaches ORDER BY created_at');

  if (result.rows.length === 0) {
    await seedFromDefaults();
    result = await getDb().execute('SELECT * FROM coaches ORDER BY created_at');
  }

  return result.rows.map(rowToCoach);
}

export async function getCoach(id: string): Promise<CoachRecord | null> {
  const coaches = await listCoaches();
  return coaches.find(coach => coach.id === id) || null;
}

export async function upsertCoach(id: string, coach: Omit<CoachRecord, 'id'>): Promise<CoachRecord | null> {
  await ensureSchema();
  await getDb().execute({
    sql: `INSERT INTO coaches (id, name, display_name, description, photo_url, timezone, email, working_hours, prices, payment_provider, meeting_provider, polar_product_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            display_name = excluded.display_name,
            description = excluded.description,
            photo_url = excluded.photo_url,
            timezone = excluded.timezone,
            email = excluded.email,
            working_hours = excluded.working_hours,
            prices = excluded.prices,
            payment_provider = excluded.payment_provider,
            meeting_provider = excluded.meeting_provider,
            polar_product_id = excluded.polar_product_id,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    args: [
      id,
      coach.name,
      coach.displayName,
      coach.description,
      coach.photoUrl,
      coach.timezone,
      coach.email,
      JSON.stringify(coach.workingHours),
      JSON.stringify(coach.prices),
      coach.paymentProvider,
      coach.meetingProvider,
      coach.polarProductId,
    ]
  });
  return getCoach(id);
}

export async function deleteCoach(id: string): Promise<void> {
  await ensureSchema();
  await getDb().execute({
    sql: 'DELETE FROM coaches WHERE id = ?',
    args: [id]
  });
}
