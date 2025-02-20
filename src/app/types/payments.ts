import { BookingFrequency } from "./booking";

export type PaymentOrderStatus = 
  | 'pending' 
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'cancelled';

export interface CheckoutPayload {
  variantId: string;
  customData: {
    userEmail: string;
    userName: string;
    frequency: BookingFrequency;
    duration: string;
    firstSlot: { date: string } | null;
    secondSlot: { date: string } | null;
    bookingId?: string;
  };
}