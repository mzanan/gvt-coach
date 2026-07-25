import { BookingPlan } from '@/types/booking';
import { CheckoutResponse, PaymentProviderService } from '@/types/payment';
import { getClientCookie, setClientCookie } from '@/lib/utils/cookies';
import { UserProfile } from '@/types/user';
import { DateTime } from 'luxon';

export const stripeService: PaymentProviderService = {
  createCheckout: async (
    bookingPlan: BookingPlan,
    userProfile: UserProfile,
    storePendingBooking = false
  ): Promise<CheckoutResponse> => {
    try {
      const userEmail = userProfile?.email || getClientCookie('user_email') || '';

      const selectedCoach = bookingPlan.coach;
      if (!selectedCoach) {
        throw new Error('Coach not specified in booking plan');
      }

      const reliableUserTimezone = getClientCookie('user_timezone') ||
                                    userProfile?.timezone ||
                                    Intl.DateTimeFormat().resolvedOptions().timeZone;

      const slotTime = bookingPlan.firstSlot?.date;
      const utcDate = bookingPlan.firstSlot?.utcDate;

      let localTimeString: string | null = null;
      let utcTimeString: string | null = null;

      try {
        if (slotTime) {
          const slotDateTime = DateTime.fromJSDate(new Date(slotTime));
          localTimeString = slotDateTime.setZone(reliableUserTimezone).toISO();
          utcTimeString = utcDate ?
            DateTime.fromJSDate(new Date(utcDate)).toISO() :
            slotDateTime.toUTC().toISO();
        }
      } catch (e) {
        console.error('Error processing date/time in Stripe service:', e);
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
          provider: 'stripe',
          storePendingBooking
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Stripe Checkout error:', errorData);

        let serverMessage = '';
        try {
          serverMessage = JSON.parse(errorData)?.error || '';
        } catch {
          serverMessage = '';
        }

        throw new Error(serverMessage || 'Failed to create Stripe checkout');
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
    } catch (error) {
      console.error('Stripe Checkout error:', error);
      throw error;
    }
  },

  getVariantIdForBookingPlan: (): string | null => {
    return null;
  }
};
