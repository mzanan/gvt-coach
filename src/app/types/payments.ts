import { BookingFrequency } from "./booking";

export enum PaymentOrderStatus {
  Active = 'ACTIVE',
  Pending = 'PENDING',
  Paid = 'PAID',
  Void = 'VOID'
}

export interface CheckoutPayload {
  variantId: string;
  customData: {
    userEmail: string;
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