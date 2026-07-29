import { createClient } from '@libsql/client';
import { randomUUID } from 'crypto';
import { E2E_DATABASE_URL } from './database';

export interface SeedBooking {
  orderId: string;
  status: 'PAID' | 'PENDING' | 'VOID';
  coach: string;
  bookingDateIso: string;
  userEmail: string;
}

export async function seedBookings(bookings: SeedBooking[]): Promise<void> {
  const db = createClient({ url: E2E_DATABASE_URL });

  for (const booking of bookings) {
    const paymentStatusId = randomUUID();
    const confirmed = booking.status === 'PAID';

    await db.execute({
      sql: 'INSERT INTO gvt_coach_payments_status (id, status, checkout_order_id, json_data) VALUES (?, ?, ?, ?)',
      args: [paymentStatusId, booking.status, booking.orderId, JSON.stringify({ seeded_by: 'e2e' })]
    });

    await db.execute({
      sql: 'INSERT INTO gvt_coach_checkout_mapping (checkout_order_id, payment_order_id, payment_status_id, provider) VALUES (?, ?, ?, ?)',
      args: [booking.orderId, booking.orderId, paymentStatusId, 'stripe']
    });

    await db.execute({
      sql: `INSERT INTO gvt_coach_meetings_bookings
            (id, checkout_order_id, user_email, booking_date, frequency, payment_status, checkout_completed, payment_confirmed, user_timezone, duration, coach)
            VALUES (?, ?, ?, ?, 'ONCE', ?, ?, ?, 'UTC', 60, ?)`,
      args: [
        randomUUID(),
        booking.orderId,
        booking.userEmail,
        booking.bookingDateIso,
        booking.status,
        confirmed ? 1 : 0,
        confirmed ? 1 : 0,
        booking.coach
      ]
    });
  }

  db.close();
}
