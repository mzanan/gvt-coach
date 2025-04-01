// Types for payment status and realtime notifications

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