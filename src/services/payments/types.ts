// Payment service types shared across different providers

import { BookingPlan } from '@/app/types/booking';
import { UserProfile } from '@/app/types/user';

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