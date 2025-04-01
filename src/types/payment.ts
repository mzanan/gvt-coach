import { BookingFrequency, PaymentOrderStatus } from "./enums";
import { BookingDB, BookingPlan } from './booking';
import { UserProfile } from "./user";

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

/**
 * Payload interface for Supabase Realtime payment status updates
 */
export interface PaymentStatusPayload {
  new: {
    id: string;
    status: string;
    updated_at: string;
    created_at: string;
    json_data: Record<string, unknown>;
  };
  old: Record<string, unknown>;
  commit_timestamp: string;
  eventType: string;
  schema: string;
  table: string;
}

/**
 * Interface for poll state tracking in payment pages
 */
export interface PaymentPollState {
  isPolling: boolean;
  lastCheckTime: number;
  isCheckInProgress: boolean;
}

/**
 * Callbacks for payment status polling
 */
export interface PaymentStatusHandlers {
  onBookingFound: (booking: BookingDB) => void;
  onPaymentConfirmed: () => void;
  onPollCompleted: () => void;
}

// Moved from services/payments/types.ts
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