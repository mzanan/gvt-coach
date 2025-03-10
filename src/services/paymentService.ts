import { BookingPlan } from '@/app/types/booking';
import { UserProfile } from '@/app/types/user';
import { PaymentOrderStatus } from '@/app/types/payments';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export const paymentService = {
  createCheckout: async (bookingPlan: BookingPlan, userProfile: UserProfile): Promise<{ checkoutUrl: string; orderId: string }> => {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      
      // Get user email
      const userEmail = userProfile?.email || localStorage.getItem('userEmail') || '';
      
      // Get variant ID based on booking plan
      const variantId = getVariantIdForBookingPlan(bookingPlan.frequency);
      
      if (!variantId) {
        throw new Error('Invalid booking plan frequency');
      }
      
      // Get the selectedSlot data from localStorage if available
      let selectedDate = null;
      try {
        const pendingBookingStr = localStorage.getItem('pendingBooking');
        if (pendingBookingStr) {
          const pendingBookingData = JSON.parse(pendingBookingStr);
          selectedDate = pendingBookingData.selectedDate;
        }
      } catch (e) {
        console.error('Error parsing pendingBooking for date:', e);
      }
      
      // Prepare booking data
      const bookingData = {
        userEmail,
        bookingPlan,
        selectedDate,
        selectedTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };
      
      // Store booking data in localStorage for reference
      localStorage.setItem('pendingBooking', JSON.stringify(bookingData));
      
      // Call the checkout API
      console.log('Calling /api/checkout with:', { variantId, bookingData });
      
      const response = await fetch(`${appUrl}/api/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          variantId,
          bookingData
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Checkout error:', errorText);
        throw new Error('Failed to create checkout');
      }
      
      const { checkoutUrl, orderId } = await response.json();
      
      console.log('Checkout created successfully:', { checkoutUrl, orderId });
      
      // Update the pendingBooking in localStorage with the orderId
      try {
        const pendingBookingStr = localStorage.getItem('pendingBooking');
        if (pendingBookingStr) {
          const bookingData = JSON.parse(pendingBookingStr);

          const updatedBookingData = {
            ...bookingData,
            orderId,
            booking: {
              ...bookingData.booking,
              checkout_order_id: orderId
            }
          };
          localStorage.setItem('pendingBooking', JSON.stringify(updatedBookingData));
        }
      } catch (e) {
        console.error('Error updating pendingBooking with orderId:', e);
      }

      return {
        checkoutUrl,
        orderId
      };
    } catch (error) {
      console.error('Checkout error:', error);
      throw error;
    }
  },

  getOrderStatus: async (orderId: string): Promise<PaymentOrderStatus> => {
    try {
      // Use Supabase client to query directly
      const supabase = createClientComponentClient();
      
      console.log(`Checking payment status for order ${orderId} directly in database`);
      
      // Primero buscar en la tabla de mapeo
      const { data: mappingData, error: mappingError } = await supabase
        .from('gvt_coach_checkout_mapping')
        .select('payment_status_id')
        .eq('checkout_order_id', orderId)
        .maybeSingle();
        
      if (mappingError) {
        console.error('Error fetching mapping data:', mappingError);
        return PaymentOrderStatus.Pending;
      }
      
      if (!mappingData || !mappingData.payment_status_id) {
        console.warn('No payment status ID found for this order');
        return PaymentOrderStatus.Pending;
      }
      
      // Buscar el estado del pago usando el ID
      const { data: paymentStatus, error } = await supabase
        .from('gvt_coach_payments_status')
        .select('status')
        .eq('id', mappingData.payment_status_id)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching payment status:', error);
        return PaymentOrderStatus.Pending;
      }
      
      if (!paymentStatus) {
        return PaymentOrderStatus.Pending;
      }
      
      // Map the status from the database
      const statusData = paymentStatus?.status?.toUpperCase();
      
      // Determine payment status
      switch (statusData) {
        case 'PAID':
          return PaymentOrderStatus.Paid;
        case 'ACTIVE':
          return PaymentOrderStatus.Active;
        case 'VOID':
          return PaymentOrderStatus.Void;
        case 'PENDING':
        default:
          return PaymentOrderStatus.Pending;
      }
    } catch (error) {
      console.error('Error getting order status:', error);
      return PaymentOrderStatus.Pending;
    }
  }
};

// Helper function to get the variant ID for a booking plan frequency
function getVariantIdForBookingPlan(frequency: string): string | null {
  switch (frequency) {
    case 'once':
      return process.env.NEXT_PUBLIC_LEMONSQUEEZY_SINGLE_SESSION_VARIANT_ID || '';
    case 'weekly':
      return process.env.NEXT_PUBLIC_LEMONSQUEEZY_WEEKLY_VARIANT_ID || '';
    case 'twice-weekly':
      return process.env.NEXT_PUBLIC_LEMONSQUEEZY_TWICE_WEEKLY_VARIANT_ID || '';
    default:
      return null;
  }
}