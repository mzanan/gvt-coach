import { BookingPlan } from '@/types/booking';
import { CheckoutResponse, PaymentProviderService } from '@/types/payment';
import { getClientCookie, setClientCookie } from '@/lib/utils/cookies';
import { UserProfile } from '@/types/user';
import { DateTime } from 'luxon';

export const disabledPaymentsService: PaymentProviderService = {
  createCheckout: async (
    bookingPlan: BookingPlan,
    userProfile: UserProfile,
    storePendingBooking = false
  ): Promise<CheckoutResponse> => {
    const userEmail = userProfile?.email || getClientCookie('user_email') || '';

    if (!bookingPlan.coach) {
      throw new Error('Coach not specified in booking plan');
    }

    const reliableUserTimezone = getClientCookie('user_timezone') ||
                                  userProfile?.timezone ||
                                  Intl.DateTimeFormat().resolvedOptions().timeZone;

    const slotTime = bookingPlan.firstSlot?.date;
    const utcDate = bookingPlan.firstSlot?.utcDate;

    let localTimeString: string | null = null;
    let utcTimeString: string | null = null;

    if (slotTime) {
      const slotDateTime = DateTime.fromJSDate(new Date(slotTime));
      localTimeString = slotDateTime.setZone(reliableUserTimezone).toISO();
      utcTimeString = utcDate ?
        DateTime.fromJSDate(new Date(utcDate)).toISO() :
        slotDateTime.toUTC().toISO();
    }

    const bookingData = {
      userEmail,
      bookingPlan,
      selectedDate: localTimeString || null,
      utcDate: utcTimeString || null,
      selectedTimezone: reliableUserTimezone
    };

    setClientCookie('pending_booking', bookingData);

    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bookingData,
        provider: 'disabled',
        storePendingBooking
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Disabled-payments checkout error:', errorData);
      throw new Error('Failed to create booking');
    }

    const { checkoutUrl, orderId } = await response.json();

    try {
      const pendingBookingData = getClientCookie('pending_booking');
      if (pendingBookingData) {
        setClientCookie('pending_booking', { ...pendingBookingData, orderId });
      }
    } catch (e) {
      console.error('Error updating pendingBooking with order ID:', e);
    }

    return {
      checkoutUrl,
      orderId
    };
  },

  getVariantIdForBookingPlan: (): string | null => {
    return null;
  }
};
