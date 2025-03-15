import { PaymentPollState } from '@/app/types/payment-status'
import { fetchBookingByOrderId, fetchPaymentMapping, fetchPaymentStatus } from './queries'
import { BookingDB } from '@/app/types/booking'

interface PaymentStatusHandlers {
  onBookingFound: (booking: BookingDB) => void;
  onPaymentConfirmed: () => void;
  onPollCompleted: () => void;
}

/**
 * Check payment status by order ID using a polling mechanism as a fallback
 */
export async function checkPaymentStatus(
  orderId: string,
  pollState: PaymentPollState,
  handlers: PaymentStatusHandlers,
  userEmail?: string | null,
  emailSent?: boolean,
  isSending?: boolean,
  emailRetryCount?: number,
  maxEmailRetries?: number,
  sendConfirmationEmail?: () => Promise<void>
) {
  // Use the ref values to check if we should poll
  if (!orderId || !pollState.isPolling) return;
  
  // Prevent concurrent executions of this function
  if (pollState.isCheckInProgress) return;
  
  // Set check in progress flag
  pollState.isCheckInProgress = true;
  
  // Update last check time
  pollState.lastCheckTime = Date.now();
  
  try {
    console.log("🔍 Polling: Checking payment status for order ID:", orderId);
    
    // First, try to find the booking directly by checkout_order_id
    console.log("Looking for booking with checkout_order_id:", orderId);
    const bookingData = await fetchBookingByOrderId(orderId);
    
    if (bookingData) {
      console.log("📋 Found booking directly:", bookingData);
      handlers.onBookingFound(bookingData);
      
      // If the booking status is CONFIRMED, we're good
      if (bookingData.status === 'CONFIRMED') {
        handlers.onPaymentConfirmed();
        
        // If we have a booking and email, send the confirmation
        if (userEmail && !emailSent && !isSending && 
            emailRetryCount !== undefined && 
            maxEmailRetries !== undefined && 
            emailRetryCount < maxEmailRetries && 
            sendConfirmationEmail) {
          sendConfirmationEmail();
        }
        
        // We can stop polling now that we have confirmation
        pollState.isPolling = false;
        console.log("✅ Booking found with CONFIRMED status - stopping poll");
        pollState.isCheckInProgress = false;
        handlers.onPollCompleted();
        return;
      }
    }
    
    // If we didn't find a booking or it's not confirmed, check payment status
    console.log("Looking for payment mapping for orderId:", orderId);
    const mappingData = await fetchPaymentMapping(orderId);

    if (!mappingData || !mappingData.payment_status_id) {
      console.warn(`No payment mapping found for orderId: ${orderId}`);
      pollState.isCheckInProgress = false;
      return;
    }
      
    // Look for payment status using the ID
    console.log("Looking for payment status with ID:", mappingData.payment_status_id);
    const paymentStatus = await fetchPaymentStatus(mappingData.payment_status_id);
    
    if (!paymentStatus) {
      console.warn(`No payment status found`);
      pollState.isCheckInProgress = false;
      return;
    }
    
    console.log("💵 Payment status:", paymentStatus);
    
    // If payment is confirmed, find the booking
    if (paymentStatus.status === 'PAID' || paymentStatus.status === 'ACTIVE') {
      handlers.onPaymentConfirmed();
      
      // If we already found the booking above, no need to look again
      if (bookingData) {
        // We can stop polling now that we have confirmation
        pollState.isPolling = false;
        console.log("✅ Payment confirmed in database - stopping poll");
        pollState.isCheckInProgress = false;
        handlers.onPollCompleted();
        return;
      }
      
      // Find the booking that references this checkout_order_id
      console.log("Looking for booking with mapping checkout_order_id:", mappingData.checkout_order_id);
      const bookingByMapping = await fetchBookingByOrderId(mappingData.checkout_order_id);
        
      if (bookingByMapping) {
        console.log("📋 Found booking via mapping:", bookingByMapping);
        handlers.onBookingFound(bookingByMapping);
        
        // If the booking status is CONFIRMED, we're good
        if (bookingByMapping.status === 'CONFIRMED') {
          // We can stop polling now that we have confirmation
          pollState.isPolling = false;
          console.log("✅ Booking found via mapping with CONFIRMED status - stopping poll");
          handlers.onPollCompleted();
        }
        
        // If we have a booking and email, try to send the confirmation
        if (userEmail && !emailSent && !isSending && 
            emailRetryCount !== undefined && 
            maxEmailRetries !== undefined && 
            emailRetryCount < maxEmailRetries &&
            sendConfirmationEmail) {
          sendConfirmationEmail();
        }
      } else {
        console.log("⏳ Payment is confirmed but booking is not created yet - will keep polling");
      }
    }
  } catch (error) {
    console.error("Error checking payment status:", error);
  } finally {
    // Make sure to reset the check in progress flag
    pollState.isCheckInProgress = false;
  }
} 