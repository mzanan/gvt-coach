import { BookingFrequency, BookingPlan } from '../types/booking';

interface UserProfile {
  email: string;
  first_name: string;
  last_name: string;
}

interface CheckoutPayload {
  variantId: string;
  customData: {
    userEmail: string;
    userName: string;
    frequency: BookingFrequency;
    duration: string;
    firstSlot: { date: string } | null;
    secondSlot: { date: string } | null;
  };
}

export const paymentService = {
  createCheckout: async (bookingPlan: BookingPlan, userProfile: UserProfile): Promise<string> => {
    try {
      const tokenResponse = await fetch('/api/auth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientId: process.env.NEXT_PUBLIC_CLIENT_ID,
          clientSecret: process.env.NEXT_PUBLIC_CLIENT_SECRET
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token error response:', errorText);
        throw new Error('Failed to get authentication token');
      }

      const { token }: { token: string } = await tokenResponse.json();

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
          } : null
        }
      };

      console.log('Checkout payload:', payload);

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
          throw new Error('Failed to create checkout');
        }
      }

      const data: { data: { attributes: { url: string } } } = await response.json();
      if (!data.data.attributes.url) {
        throw new Error('Invalid checkout URL received from server');
      }
      return data.data.attributes.url;
    } catch (error) {
      console.error('Checkout error:', error);
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