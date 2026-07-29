import type { SeedBooking } from './seed';

export const PAYMENT_PAID_ORDER_ID = 'e2e-payment-paid';
export const PAYMENT_PENDING_ORDER_ID = 'e2e-payment-pending';
export const PAYMENT_VOID_ORDER_ID = 'e2e-payment-void';

export const TAKEN_SLOT_COACH = 'GABRIEL';
export const TAKEN_SLOT_COACH_LABEL = 'Gabriel';
export const TAKEN_SLOT_UTC_ISO = '2026-08-12T13:00:00.000Z';
export const TAKEN_SLOT_YEAR = 2026;
export const TAKEN_SLOT_MONTH = 'August';
export const TAKEN_SLOT_DAY = '12';
export const TAKEN_SLOT_LABEL_SAIGON = '8:00 PM';

export const E2E_FIXTURES: SeedBooking[] = [
  {
    orderId: PAYMENT_PAID_ORDER_ID,
    status: 'PAID',
    coach: 'GABRIEL',
    bookingDateIso: '2026-09-15T10:00:00.000Z',
    userEmail: 'qa-paid@example.com'
  },
  {
    orderId: PAYMENT_PENDING_ORDER_ID,
    status: 'PENDING',
    coach: 'GABRIEL',
    bookingDateIso: '2026-09-16T10:00:00.000Z',
    userEmail: 'qa-pending@example.com'
  },
  {
    orderId: PAYMENT_VOID_ORDER_ID,
    status: 'VOID',
    coach: 'GABRIEL',
    bookingDateIso: '2026-09-17T10:00:00.000Z',
    userEmail: 'qa-void@example.com'
  },
  {
    orderId: 'e2e-taken-slot',
    status: 'PAID',
    coach: TAKEN_SLOT_COACH,
    bookingDateIso: TAKEN_SLOT_UTC_ISO,
    userEmail: 'qa-taken-slot@example.com'
  }
];
