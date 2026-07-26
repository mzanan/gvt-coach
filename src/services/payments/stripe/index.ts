import { BookingPlan } from '@/types/booking';
import { CheckoutResponse, PaymentProviderService } from '@/types/payment';
import { UserProfile } from '@/types/user';
import { buildCheckoutBookingData, postCheckout } from '../checkoutClient';

export const stripeService: PaymentProviderService = {
  createCheckout: async (
    bookingPlan: BookingPlan,
    userProfile: UserProfile,
    storePendingBooking = false
  ): Promise<CheckoutResponse> => {
    if (!bookingPlan.coach) {
      throw new Error('Coach not specified in booking plan');
    }

    const bookingData = buildCheckoutBookingData(bookingPlan, userProfile);
    return postCheckout('stripe', bookingData, storePendingBooking);
  },

  getVariantIdForBookingPlan: (): string | null => {
    return null;
  }
};
