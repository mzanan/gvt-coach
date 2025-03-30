import { supabase } from '@/lib/supabase/client'
import { BookingDB } from '@/app/types/booking'

/**
 * Fetch booking by checkout order ID
 */
export async function fetchBookingByOrderId(checkoutOrderId: string) {
  try {
    if (!checkoutOrderId) {
      console.warn("Cannot fetch booking: checkout order ID is missing");
      return null;
    }
    
    // First try to find the booking directly
    const { data: bookingData, error: bookingError } = await supabase
      .from('gvt_coach_meetings_bookings')
      .select('*')
      .eq('checkout_order_id', checkoutOrderId)
      .maybeSingle();
      
    if (bookingError) {
      console.error(`Error fetching booking for orderId ${checkoutOrderId}:`, bookingError);
      return null;
    }
    
    if (bookingData) {
      return bookingData;
    }
    
    // If not found directly, try to find through mapping
    const { data: mappingData, error: mappingError } = await supabase
      .from('gvt_coach_checkout_mapping')
      .select('*')
      .eq('checkout_order_id', checkoutOrderId)
      .maybeSingle();
      
    if (!mappingError && mappingData) {
      // Now get the booking using the mapping
      const { data: bookingByMapping, error: bookingByMappingError } = await supabase
        .from('gvt_coach_meetings_bookings')
        .select('*')
        .eq('checkout_order_id', mappingData.checkout_order_id)
        .maybeSingle();
        
      if (!bookingByMappingError && bookingByMapping) {
        return bookingByMapping;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching booking:", error);
    return null;
  }
}

/**
 * Fetch payment mapping by checkout order ID
 */
export async function fetchPaymentMapping(checkoutOrderId: string) {
  try {
    if (!checkoutOrderId) {
      console.warn("Cannot fetch payment mapping: checkout order ID is missing");
      return null;
    }
    
    console.log(`Searching mapping for checkoutOrderId: ${checkoutOrderId}`);
    
    // Simple direct query
    const { data: mappingData, error: mappingError } = await supabase
      .from('gvt_coach_checkout_mapping')
      .select('*')
      .eq('checkout_order_id', checkoutOrderId)
      .maybeSingle();
      
    if (mappingError) {
      console.error(`Error fetching mapping for orderId ${checkoutOrderId}:`, mappingError);
    } else if (mappingData) {
      console.log(`Found payment mapping with ID ${mappingData.payment_status_id}`);
      return mappingData;
    }
    
    // Try by payment_order_id as fallback
    console.log(`Trying to find mapping by payment_order_id: ${checkoutOrderId}`);
    const { data: orderMappingData, error: orderMappingError } = await supabase
      .from('gvt_coach_checkout_mapping')
      .select('*')
      .eq('payment_order_id', checkoutOrderId)
      .maybeSingle();
      
    if (orderMappingError) {
      console.error(`Error fetching mapping by payment_order_id ${checkoutOrderId}:`, orderMappingError);
    } else if (orderMappingData) {
      console.log(`Found mapping by payment_order_id with ID ${orderMappingData.payment_status_id}`);
      return orderMappingData;
    }
    
    // As a last resort, look for the most recent mapping
    console.log(`Trying to find most recent mapping`);
    const { data: recentMapping, error: recentError } = await supabase
      .from('gvt_coach_checkout_mapping')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (!recentError && recentMapping) {
      console.log(`Using most recent mapping as fallback: ${recentMapping.checkout_order_id}`);
      return recentMapping;
    }
    
    console.warn("No payment mapping found after all attempts");
    return null;
  } catch (error) {
    console.error("Error fetching payment mapping:", error);
    return null;
  }
}

/**
 * Fetch payment status by ID
 */
export async function fetchPaymentStatus(paymentStatusId: string) {
  try {
    if (!paymentStatusId) {
      console.warn("Cannot fetch payment status: payment status ID is missing");
      return null;
    }
    
    const { data: paymentStatus, error: paymentError } = await supabase
      .from('gvt_coach_payments_status')
      .select('*')
      .eq('id', paymentStatusId)
      .maybeSingle();
      
    if (paymentError) {
      console.error(`Error fetching payment status:`, paymentError);
      return null;
    }
    
    return paymentStatus;
  } catch (error) {
    console.error("Error fetching payment status:", error);
    return null;
  }
}

// This helper function is not currently used, removing to fix linting error
// If needed in the future, uncomment and use it
// Helper to count matching characters
// function countMatchingChars(str1: string, str2: string) {
//   let count = 0;
//   const minLength = Math.min(str1.length, str2.length);
//   for (let i = 0; i < minLength; i++) {
//     if (str1[i] === str2[i]) count++;
//   }
//   return count;
// } 