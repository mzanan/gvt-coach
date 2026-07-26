import { randomUUID } from 'crypto';
import type { Row } from '@libsql/client';
import { getDb, ensureSchema } from './client';

export interface PaymentStatusRecord {
  id: string;
  status: string;
  checkout_order_id: string | null;
  json_data: unknown;
  created_at: string;
  updated_at: string;
}

export interface CheckoutMappingRecord {
  id: number;
  checkout_order_id: string | null;
  payment_order_id: string | null;
  payment_identifier_id: string | null;
  payment_status_id: string | null;
  provider: string | null;
  created_at: string;
  updated_at: string;
}

function rowToPaymentStatus(row: Row): PaymentStatusRecord {
  const record = { ...row } as Record<string, unknown>;
  if (typeof record.json_data === 'string' && record.json_data.length > 0) {
    try {
      record.json_data = JSON.parse(record.json_data);
    } catch {
      record.json_data = null;
    }
  }
  return record as unknown as PaymentStatusRecord;
}

function rowToMapping(row: Row): CheckoutMappingRecord {
  return { ...row } as unknown as CheckoutMappingRecord;
}

export async function getPaymentStatusById(id: string): Promise<PaymentStatusRecord | null> {
  await ensureSchema();
  const result = await getDb().execute({
    sql: 'SELECT * FROM gvt_coach_payments_status WHERE id = ?',
    args: [id]
  });
  return result.rows[0] ? rowToPaymentStatus(result.rows[0]) : null;
}

export async function getPaymentStatusByOrderId(orderId: string): Promise<PaymentStatusRecord | null> {
  await ensureSchema();
  const result = await getDb().execute({
    sql: 'SELECT * FROM gvt_coach_payments_status WHERE checkout_order_id = ? LIMIT 1',
    args: [orderId]
  });
  return result.rows[0] ? rowToPaymentStatus(result.rows[0]) : null;
}

export async function findPaymentStatusByJsonOrderId(orderId: string): Promise<PaymentStatusRecord | null> {
  await ensureSchema();
  const result = await getDb().execute({
    sql: `SELECT * FROM gvt_coach_payments_status
          WHERE json_extract(json_data, '$.checkout_id') = ? OR json_extract(json_data, '$.checkout_order_id') = ?
          LIMIT 1`,
    args: [orderId, orderId]
  });
  return result.rows[0] ? rowToPaymentStatus(result.rows[0]) : null;
}

export async function insertPaymentStatus(fields: {
  status: string;
  checkout_order_id?: string | null;
  json_data?: unknown;
}): Promise<PaymentStatusRecord> {
  await ensureSchema();
  const id = randomUUID();
  await getDb().execute({
    sql: 'INSERT INTO gvt_coach_payments_status (id, status, checkout_order_id, json_data) VALUES (?, ?, ?, ?)',
    args: [
      id,
      fields.status,
      fields.checkout_order_id ?? null,
      fields.json_data === undefined || fields.json_data === null ? null : JSON.stringify(fields.json_data)
    ]
  });
  const created = await getPaymentStatusById(id);
  if (!created) throw new Error('Payment status insert failed');
  return created;
}

export async function updatePaymentStatus(id: string, fields: {
  status?: string;
  json_data?: unknown;
}): Promise<PaymentStatusRecord | null> {
  await ensureSchema();
  const assignments: string[] = [];
  const values: unknown[] = [];
  if (fields.status !== undefined) {
    assignments.push('status = ?');
    values.push(fields.status);
  }
  if (fields.json_data !== undefined) {
    assignments.push('json_data = ?');
    values.push(fields.json_data === null ? null : JSON.stringify(fields.json_data));
  }
  if (assignments.length === 0) return getPaymentStatusById(id);
  await getDb().execute({
    sql: `UPDATE gvt_coach_payments_status SET ${assignments.join(', ')}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    args: [...values, id] as never[]
  });
  return getPaymentStatusById(id);
}

export async function getMappingByOrderId(orderId: string): Promise<CheckoutMappingRecord | null> {
  await ensureSchema();
  const result = await getDb().execute({
    sql: 'SELECT * FROM gvt_coach_checkout_mapping WHERE checkout_order_id = ? LIMIT 1',
    args: [orderId]
  });
  return result.rows[0] ? rowToMapping(result.rows[0]) : null;
}

export async function getMappingByAnyOrderId(orderId: string): Promise<CheckoutMappingRecord | null> {
  await ensureSchema();
  const result = await getDb().execute({
    sql: 'SELECT * FROM gvt_coach_checkout_mapping WHERE checkout_order_id = ? OR payment_order_id = ? LIMIT 1',
    args: [orderId, orderId]
  });
  return result.rows[0] ? rowToMapping(result.rows[0]) : null;
}

export async function ensurePendingPaymentStatus(
  orderId: string,
  provider: string,
  extraJson: Record<string, unknown> = {}
): Promise<string> {
  const existingMapping = await getMappingByAnyOrderId(orderId);
  if (existingMapping?.payment_status_id) {
    return existingMapping.payment_status_id;
  }

  const existingByJson = await findPaymentStatusByJsonOrderId(orderId);
  const paymentStatusId = existingByJson
    ? existingByJson.id
    : (await insertPaymentStatus({
        status: 'PENDING',
        checkout_order_id: orderId,
        json_data: { checkout_order_id: orderId, provider, ...extraJson }
      })).id;

  await upsertMapping({
    checkout_order_id: orderId,
    payment_order_id: orderId,
    payment_status_id: paymentStatusId,
    provider
  });

  return paymentStatusId;
}

export async function getMostRecentMapping(): Promise<CheckoutMappingRecord | null> {
  await ensureSchema();
  const result = await getDb().execute(
    'SELECT * FROM gvt_coach_checkout_mapping ORDER BY created_at DESC LIMIT 1'
  );
  return result.rows[0] ? rowToMapping(result.rows[0]) : null;
}

export async function upsertMapping(fields: {
  checkout_order_id: string;
  payment_order_id?: string | null;
  payment_identifier_id?: string | null;
  payment_status_id?: string | null;
  provider?: string | null;
}): Promise<void> {
  await ensureSchema();
  await getDb().execute({
    sql: `INSERT INTO gvt_coach_checkout_mapping (checkout_order_id, payment_order_id, payment_identifier_id, payment_status_id, provider)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(checkout_order_id) DO UPDATE SET
            payment_order_id = COALESCE(excluded.payment_order_id, payment_order_id),
            payment_identifier_id = COALESCE(excluded.payment_identifier_id, payment_identifier_id),
            payment_status_id = COALESCE(excluded.payment_status_id, payment_status_id),
            provider = COALESCE(excluded.provider, provider),
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    args: [
      fields.checkout_order_id,
      fields.payment_order_id ?? null,
      fields.payment_identifier_id ?? null,
      fields.payment_status_id ?? null,
      fields.provider ?? null
    ]
  });
}

export async function insertSessionSummary(fields: {
  user_email: string;
  session_date: string;
  summary: string;
  next_steps?: string | null;
  resources?: string | null;
  sent_at?: string | null;
}): Promise<void> {
  await ensureSchema();
  await getDb().execute({
    sql: 'INSERT INTO session_summaries (user_email, session_date, summary, next_steps, resources, sent_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: [
      fields.user_email,
      fields.session_date,
      fields.summary,
      fields.next_steps ?? null,
      fields.resources ?? null,
      fields.sent_at ?? null
    ]
  });
}
