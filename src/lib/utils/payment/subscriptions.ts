import { supabase } from '@/lib/supabase/client'
import { PaymentStatusPayload } from '@/app/types/payment-status'

/**
 * Set up a Supabase channel to listen for payment status updates
 */
export function setupPaymentStatusChannel(
  orderId: string,
  onPaymentConfirmed: (orderId: string) => void,
  onMappingUpdated: (orderId: string) => void
) {
  console.log("⚡️ Setting up real-time listeners for order ID:", orderId);
  
  // No need to set up subscriptions without an order ID
  if (!orderId) {
    console.warn("No orderId available - cannot set up real-time listeners");
    return null;
  }
  
  // Create the channel
  const channel = supabase.channel(`payment_updates_${orderId}`);
  
  // Listen for payment status changes
  channel.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'gvt_coach_payments_status',
    },
    (payload) => {
      console.log("💲 Payment status changed:", payload);
      
      // Check if the update signals a successful payment
      const newData = payload.new as PaymentStatusPayload['new'];
      if (newData && (newData.status === 'PAID' || newData.status === 'ACTIVE')) {
        console.log("✅ Payment confirmed via real-time update");
        onPaymentConfirmed(orderId);
      }
    }
  );
  
  // Listen for checkout mapping changes
  channel.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'gvt_coach_checkout_mapping',
      filter: `checkout_order_id=eq.${orderId}`,
    },
    (payload) => {
      console.log("🔄 Checkout mapping updated:", payload);
      onMappingUpdated(orderId);
    }
  );
  
  // Listen for new bookings
  channel.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'gvt_coach_meetings_bookings',
    },
    (payload) => {
      console.log("📅 New booking created:", payload);
      
      const newBooking = payload.new as any;
      if (newBooking && newBooking.checkout_order_id === orderId) {
        onPaymentConfirmed(orderId);
      }
    }
  );
  
  // Start the subscription
  channel.subscribe((status) => {
    console.log(`Subscription status for channel payment_updates_${orderId}:`, status);
  });
  
  // Return the channel so it can be unsubscribed later
  return channel;
} 