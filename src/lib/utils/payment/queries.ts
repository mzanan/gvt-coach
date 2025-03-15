import { supabase } from '@/lib/supabase/client'
import { BookingDB } from '@/app/types/booking'

/**
 * Fetch booking data by checkout order ID
 */
export async function fetchBookingByOrderId(checkoutOrderId: string): Promise<BookingDB | null> {
  try {
    // Direct lookup by checkout_order_id - most common case
    const { data: bookingResults, error: bookingError } = await supabase
      .from('gvt_coach_meetings_bookings')
      .select('*')
      .eq('checkout_order_id', checkoutOrderId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (!bookingError && bookingResults && bookingResults.length > 0) {
      console.log("Found booking directly by checkout_order_id:", bookingResults[0]);
      return bookingResults[0] as BookingDB;
    }
    
    // Second attempt: check if this is a Polar order ID in the mapping table
    try {
      const { data: mapping, error: mappingError } = await supabase
        .from('gvt_coach_checkout_mapping')
        .select('checkout_order_id')
        .eq('payment_order_id', checkoutOrderId)
        .maybeSingle();
      
      if (!mappingError && mapping && mapping.checkout_order_id) {
        const actualCheckoutOrderId = mapping.checkout_order_id;
        
        if (actualCheckoutOrderId !== checkoutOrderId) {
          // Try fetching with the mapped checkout_order_id
          const { data: mappedBookingResults, error: mappedBookingError } = await supabase
            .from('gvt_coach_meetings_bookings')
            .select('*')
            .eq('checkout_order_id', actualCheckoutOrderId)
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (!mappedBookingError && mappedBookingResults && mappedBookingResults.length > 0) {
            console.log("Found booking via mapping table:", mappedBookingResults[0]);
            return mappedBookingResults[0] as BookingDB;
          }
        }
      }
    } catch (mappingCheckError) {
      console.error("Error checking mapping table:", mappingCheckError);
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching booking data:", error);
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
    
    // Simple direct query
    const { data: mappingData, error: mappingError } = await supabase
      .from('gvt_coach_checkout_mapping')
      .select('*')
      .eq('checkout_order_id', checkoutOrderId)
      .maybeSingle();
      
    if (mappingError) {
      console.error(`Error fetching mapping for orderId ${checkoutOrderId}:`, mappingError);
      return null;
    }
    
    if (mappingData) {
      console.log(`Found payment mapping with ID ${mappingData.payment_status_id}`);
      return mappingData;
    }
    
    // Try by payment_order_id as fallback
    const { data: orderMappingData, error: orderMappingError } = await supabase
      .from('gvt_coach_checkout_mapping')
      .select('*')
      .eq('payment_order_id', checkoutOrderId)
      .maybeSingle();
      
    if (!orderMappingError && orderMappingData) {
      console.log(`Found mapping by payment_order_id with ID ${orderMappingData.payment_status_id}`);
      return orderMappingData;
    }
    
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