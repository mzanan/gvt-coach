import { DateTime } from 'luxon';
import { BookingPlan } from '@/types/booking';
import { CheckoutResponse } from '@/types/payment';
import { UserProfile } from '@/types/user';
import { getClientCookie, setClientCookie } from '@/lib/utils/cookies';
import { bookingService } from '@/services/bookingService';

export interface CheckoutBookingData {
  userEmail: string;
  bookingPlan: BookingPlan;
  selectedDate: string | null;
  utcDate: string | null;
  selectedTimezone: string;
}

export function resolveUserTimezone(userProfile: UserProfile): string {
  return getClientCookie('user_timezone') ||
    userProfile?.timezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function buildCheckoutBookingData(bookingPlan: BookingPlan, userProfile: UserProfile): CheckoutBookingData {
  const userEmail = userProfile?.email || getClientCookie('user_email') || '';
  const userTimezone = resolveUserTimezone(userProfile);

  const slotTime = bookingPlan.firstSlot?.date;
  const utcDate = bookingPlan.firstSlot?.utcDate;

  let selectedDate: string | null = null;
  let utcDateString: string | null = null;

  if (slotTime) {
    const slotDateTime = DateTime.fromJSDate(new Date(slotTime));
    selectedDate = slotDateTime.setZone(userTimezone).toISO();
    utcDateString = utcDate
      ? DateTime.fromJSDate(new Date(utcDate)).toISO()
      : slotDateTime.toUTC().toISO();
  }

  const bookingData: CheckoutBookingData = {
    userEmail,
    bookingPlan,
    selectedDate,
    utcDate: utcDateString,
    selectedTimezone: userTimezone
  };

  setClientCookie('pending_booking', bookingData);

  return bookingData;
}

export async function postCheckout(
  provider: string,
  bookingData: CheckoutBookingData,
  storePendingBooking: boolean
): Promise<CheckoutResponse> {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingData, provider, storePendingBooking }),
  });

  if (!response.ok) {
    const raw = await response.text();
    console.error(`${provider} checkout error:`, raw);

    let message = `Failed to create ${provider} checkout`;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.error) message = parsed.error;
    } catch {}

    if (response.status === 409) {
      bookingService.clearTimeSlotsCache();
    }

    throw new Error(message);
  }

  const { checkoutUrl, orderId } = await response.json();

  const pendingBookingData = getClientCookie('pending_booking');
  if (pendingBookingData) {
    setClientCookie('pending_booking', { ...pendingBookingData, orderId });
  }

  return { checkoutUrl, orderId };
}
