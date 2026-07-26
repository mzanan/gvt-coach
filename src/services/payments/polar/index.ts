import { BookingPlan } from '@/types/booking';
import { UserProfile } from '@/types/user';
import { CheckoutResponse, PaymentProviderService } from '@/types/payment';
import { getClientCookie, setClientCookie } from '@/lib/utils/cookies';
import { buildCheckoutBookingData, postCheckout } from '../checkoutClient';

async function registerBookingRecord(
  orderId: string,
  bookingPlan: BookingPlan,
  userEmail: string,
  selectedDate: string | null,
  selectedTimezone: string
): Promise<void> {
  if (!selectedDate) {
    console.error('Polar: no valid booking date available, skipping booking registration');
    return;
  }

  const response = await fetch('/api/booking/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId,
      bookingData: { userEmail, bookingPlan, selectedDate, selectedTimezone },
      provider: 'polar'
    }),
  });

  if (!response.ok) {
    console.error('Error registering booking:', await response.text());
  }
}

export const polarService: PaymentProviderService = {
  async createCheckout(
    bookingPlan: BookingPlan,
    userProfile: UserProfile,
    storePendingBooking = true
  ): Promise<CheckoutResponse> {
    if (!bookingPlan.coach) {
      throw new Error('Coach not specified in booking plan');
    }

    const bookingData = buildCheckoutBookingData(bookingPlan, userProfile);
    const { checkoutUrl, orderId } = await postCheckout('polar', bookingData, storePendingBooking);

    if (storePendingBooking) {
      const pendingBookingData = getClientCookie('pending_booking');
      if (pendingBookingData) {
        setClientCookie('pending_booking', {
          ...pendingBookingData,
          orderId,
          booking: { ...pendingBookingData.booking, checkout_order_id: orderId }
        });
      }

      await registerBookingRecord(
        orderId,
        bookingPlan,
        bookingData.userEmail,
        bookingData.selectedDate,
        bookingData.selectedTimezone
      );
    }

    return { checkoutUrl, orderId };
  },

  getVariantIdForBookingPlan: (): string | null => {
    return null;
  }
};
