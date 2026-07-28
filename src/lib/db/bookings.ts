import { randomUUID } from 'crypto';
import { DateTime } from 'luxon';
import type { Row } from '@libsql/client';
import { getDb, ensureSchema } from './client';
import { BookingDB } from '@/types/booking';

const BOOLEAN_COLUMNS = ['checkout_completed', 'payment_confirmed', 'confirmation_email_sent'] as const;

const WRITABLE_COLUMNS = [
  'checkout_order_id', 'user_email', 'user_name', 'booking_date', 'frequency',
  'status', 'payment_status', 'checkout_completed', 'payment_confirmed',
  'confirmation_email_sent', 'meet_link', 'user_timezone', 'duration', 'coach'
] as const;

export type BookingWrite = Partial<Record<(typeof WRITABLE_COLUMNS)[number], unknown>>;

export function rowToBooking(row: Row): BookingDB {
  const booking = { ...row } as Record<string, unknown>;
  for (const column of BOOLEAN_COLUMNS) {
    if (booking[column] !== undefined && booking[column] !== null) {
      booking[column] = Number(booking[column]) === 1;
    }
  }
  return booking as unknown as BookingDB;
}

function splitWritable(fields: BookingWrite): { columns: string[]; values: unknown[] } {
  const columns: string[] = [];
  const values: unknown[] = [];
  for (const column of WRITABLE_COLUMNS) {
    if (fields[column] !== undefined) {
      columns.push(column);
      const raw = fields[column];
      values.push(typeof raw === 'boolean' ? (raw ? 1 : 0) : raw);
    }
  }
  return { columns, values };
}

export async function getBookingById(id: string): Promise<BookingDB | null> {
  await ensureSchema();
  const result = await getDb().execute({
    sql: 'SELECT * FROM gvt_coach_meetings_bookings WHERE id = ?',
    args: [id]
  });
  return result.rows[0] ? rowToBooking(result.rows[0]) : null;
}

export async function getBookingByOrderId(orderId: string): Promise<BookingDB | null> {
  await ensureSchema();
  const result = await getDb().execute({
    sql: 'SELECT * FROM gvt_coach_meetings_bookings WHERE checkout_order_id = ? ORDER BY created_at DESC LIMIT 1',
    args: [orderId]
  });
  return result.rows[0] ? rowToBooking(result.rows[0]) : null;
}

export async function getLatestBookingByEmail(email: string): Promise<BookingDB | null> {
  await ensureSchema();
  const result = await getDb().execute({
    sql: 'SELECT * FROM gvt_coach_meetings_bookings WHERE user_email = ? ORDER BY created_at DESC LIMIT 1',
    args: [email]
  });
  return result.rows[0] ? rowToBooking(result.rows[0]) : null;
}

export async function getBookingsByOrderId(orderId: string): Promise<BookingDB[]> {
  await ensureSchema();
  const result = await getDb().execute({
    sql: 'SELECT * FROM gvt_coach_meetings_bookings WHERE checkout_order_id = ?',
    args: [orderId]
  });
  return result.rows.map(rowToBooking);
}

export async function getBookingsBetween(startIso: string, endIso: string): Promise<BookingDB[]> {
  await ensureSchema();
  const result = await getDb().execute({
    sql: 'SELECT * FROM gvt_coach_meetings_bookings WHERE booking_date >= ? AND booking_date < ?',
    args: [startIso, endIso]
  });
  return result.rows.map(rowToBooking);
}

export async function insertBooking(fields: BookingWrite): Promise<BookingDB> {
  await ensureSchema();
  const id = randomUUID();
  const { columns, values } = splitWritable(fields);
  const placeholders = columns.map(() => '?').join(', ');
  await getDb().execute({
    sql: `INSERT INTO gvt_coach_meetings_bookings (id${columns.length ? ', ' + columns.join(', ') : ''}) VALUES (?${columns.length ? ', ' + placeholders : ''})`,
    args: [id, ...values] as never[]
  });
  const created = await getBookingById(id);
  if (!created) throw new Error('Booking insert failed');
  return created;
}

export async function updateBooking(id: string, fields: BookingWrite): Promise<BookingDB | null> {
  await ensureSchema();
  const { columns, values } = splitWritable(fields);
  if (columns.length === 0) return getBookingById(id);
  const assignments = columns.map(column => `${column} = ?`).join(', ');
  await getDb().execute({
    sql: `UPDATE gvt_coach_meetings_bookings SET ${assignments}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    args: [...values, id] as never[]
  });
  return getBookingById(id);
}

export async function claimConfirmationEmail(id: string): Promise<boolean> {
  await ensureSchema();
  const result = await getDb().execute({
    sql: `UPDATE gvt_coach_meetings_bookings
          SET confirmation_email_sent = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
          WHERE id = ? AND confirmation_email_sent = 0`,
    args: [id]
  });
  return result.rowsAffected > 0;
}

export async function isCoachSlotPaidBooked(coach: string, bookingDateIso: string): Promise<boolean> {
  const slotStart = DateTime.fromISO(bookingDateIso, { zone: 'utc' }).startOf('hour');
  if (!slotStart.isValid) return false;
  const slotEnd = slotStart.plus({ hours: 1 });

  const candidates = await getBookingsBetween(slotStart.toISO() as string, slotEnd.toISO() as string);
  const sameCoach = candidates.filter(booking => booking.coach === coach && booking.checkout_order_id);
  if (sameCoach.length === 0) return false;

  const orderIds = sameCoach.map(booking => booking.checkout_order_id as string);
  const paidOrderIds = await getPaidOrderIds(orderIds);
  return sameCoach.some(booking => paidOrderIds.has(booking.checkout_order_id as string));
}

export async function getPaidOrderIds(orderIds: string[]): Promise<Set<string>> {
  await ensureSchema();
  if (orderIds.length === 0) return new Set();
  const placeholders = orderIds.map(() => '?').join(', ');
  const result = await getDb().execute({
    sql: `SELECT m.checkout_order_id
          FROM gvt_coach_checkout_mapping m
          JOIN gvt_coach_payments_status p ON p.id = m.payment_status_id
          WHERE m.checkout_order_id IN (${placeholders}) AND p.status = 'PAID'`,
    args: orderIds
  });
  return new Set(result.rows.map(row => String(row.checkout_order_id)));
}
