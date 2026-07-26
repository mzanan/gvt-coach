import { BookingPlan } from './booking';
import { UserProfile } from "./user";

export interface CheckoutResponse {
  checkoutUrl: string;
  orderId: string;
}

export interface PaymentProviderService {
  createCheckout: (
    bookingPlan: BookingPlan,
    userProfile: UserProfile,
    storePendingBooking?: boolean
  ) => Promise<CheckoutResponse>;

  getVariantIdForBookingPlan: () => string | null;
}
