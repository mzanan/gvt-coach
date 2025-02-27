import { BookingFrequency } from "./booking";

export enum PaymentOrderStatus {
  Active = 'active',
  PastDue = 'past_due',
  Cancelled = 'cancelled',
  Pending = 'pending',
  Paid = 'paid'
}

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

export interface PaymentStatusResponse {
  success: boolean;
  data: {
    orderId: string | null;
    subscriptionId: string | null;
    status: PaymentOrderStatus;
    lastUpdated?: Date;
    nextRenewalDate?: string | null;
  }
}