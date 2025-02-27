import { getAuthToken } from '../helpers/authHelpers';
import { BookingFrequency, BookingPlan } from '../types/booking';
import { CheckoutPayload, PaymentOrderStatus } from '../types/payments';

interface UserProfile {
  email: string;
  first_name: string;
  last_name: string;
}

export const paymentService = {
  createCheckout: async (bookingPlan: BookingPlan, userProfile: UserProfile): Promise<{ checkoutUrl: string; orderId: string }> => {
    try {
      const token = await getAuthToken();

      const payload: CheckoutPayload = {
        variantId: bookingPlan.variantId || getVariantIdForPlan(bookingPlan.frequency),
        customData: {
          userEmail: userProfile.email,
          userName: `${userProfile.first_name} ${userProfile.last_name}`,
          frequency: bookingPlan.frequency,
          duration: String(bookingPlan.duration),
          firstSlot: bookingPlan.firstSlot ? {
            date: bookingPlan.firstSlot.date.toISOString()
          } : null,
          secondSlot: bookingPlan.secondSlot ? {
            date: bookingPlan.secondSlot.date.toISOString()
          } : null,
          bookingId: bookingPlan.bookingId
        }
      };

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.json();
        console.error('Raw error response:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || 'Failed to create checkout');
        } catch (e) {
          console.error('Error parsing error response:', e);
          throw new Error('Failed to create checkout');
        }
      }

      const { checkoutUrl, orderId } = await response.json();

      if (!checkoutUrl) {
        throw new Error('Invalid checkout URL received from server');
      }

      const pendingBooking = localStorage.getItem('pendingBooking');
      if (pendingBooking) {
        const bookingData = JSON.parse(pendingBooking);

        const updatedBookingData = {
          ...bookingData,
          orderId,
          booking: {
            ...bookingData.booking,
            order_id: orderId
          }
        };
        localStorage.setItem('pendingBooking', JSON.stringify(updatedBookingData));
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
      const token = await getAuthToken();
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_PAYMENT_URL}/api/payments/status?orderId=${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get payment status');
      }

      const responseData = await response.json();
      console.log('Payment status response:', responseData);

      if (!responseData.success || !responseData.data) {
        throw new Error('Invalid response format');
      }

      const status = responseData.data.status;

      if (!Object.values(PaymentOrderStatus).includes(status as PaymentOrderStatus)) {
        throw new Error(`Invalid status value: ${status}`);
      }

      return status as PaymentOrderStatus;
    } catch (error) {
      console.error('Error getting order status:', error);
      throw error;
    }
  }
};

const getVariantIdForPlan = (frequency: BookingFrequency): string => {
  switch (frequency) {
    case 'weekly':
      return process.env.NEXT_PUBLIC_LEMONSQUEEZY_WEEKLY_VARIANT_ID || '441046';
    case 'twice-weekly':
      return process.env.NEXT_PUBLIC_LEMONSQUEEZY_TWICE_WEEKLY_VARIANT_ID || '679238';
    case 'once':
      return process.env.NEXT_PUBLIC_LEMONSQUEEZY_SINGLE_SESSION_VARIANT_ID || '679229';
    default:
      throw new Error(`Invalid booking frequency: ${frequency}`);
  }
};