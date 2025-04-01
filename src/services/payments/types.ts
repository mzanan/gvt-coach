// Payment service types shared across different providers

import { BookingPlan } from '@/types/booking';
import { UserProfile } from '@/types/user';

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
  
  getVariantIdForBookingPlan: (frequency: string) => string | null;
} 