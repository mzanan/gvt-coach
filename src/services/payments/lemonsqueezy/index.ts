import { BookingPlan } from '@/types/booking';
import { CheckoutResponse, PaymentProviderService } from '@/types/payment';
import { getClientCookie, setClientCookie } from '@/lib/utils/cookies';
import { UserProfile } from '../../../types/user';
import { DateTime } from 'luxon';
import { getLemonSqueezyVariantId } from '@/lib/utils/productIds';

export const lemonSqueezyService: PaymentProviderService = {
  createCheckout: async (
    bookingPlan: BookingPlan, 
    userProfile: UserProfile,
    storePendingBooking = false
  ): Promise<CheckoutResponse> => {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (!appUrl) {
        console.error('Missing NEXT_PUBLIC_APP_URL environment variable.');
        throw new Error('Application URL configuration is missing.');
      }
      
      const userEmail = userProfile?.email || getClientCookie('user_email') || '';
      
      const selectedCoach = bookingPlan.coach;
      if (!selectedCoach) {
        throw new Error('Coach not specified in booking plan');
      }
      const frequency = bookingPlan.frequency;
      if (!frequency) {
        throw new Error('Invalid booking plan frequency: frequency is null');
      }

      const variantId = getLemonSqueezyVariantId(selectedCoach, frequency);
      if (!variantId) {
        throw new Error(`No valid Lemon Squeezy variant ID found for coach ${selectedCoach} and frequency ${frequency}`);
      }

      const slotTime = bookingPlan.firstSlot?.date;
      const utcDate = bookingPlan.firstSlot?.utcDate;
      
      const reliableUserTimezone = getClientCookie('user_timezone') || 
                                     userProfile?.timezone || 
                                     Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      let localTimeString = null;
      let utcTimeString = null;
      
      try {
        if (slotTime) {
          const slotDateTime = DateTime.fromJSDate(new Date(slotTime));
          localTimeString = slotDateTime.setZone(reliableUserTimezone).toISO();
          utcTimeString = utcDate ? 
            DateTime.fromJSDate(new Date(utcDate)).toISO() : 
            slotDateTime.toUTC().toISO();
        }
      } catch (e) {
        console.error('Error processing date/time in LemonSqueezy service:', e);
      }
      
      const bookingData = {
        userEmail,
        bookingPlan: bookingPlan,
        selectedDate: localTimeString || null,
        utcDate: utcTimeString || null,
        selectedTimezone: reliableUserTimezone
      };
      
      setClientCookie('pending_booking', {
        userEmail,
        bookingPlan,
        selectedDate: localTimeString || (slotTime ? new Date(slotTime).toISOString() : null),
        utcDate: utcTimeString || (utcDate ? new Date(utcDate).toISOString() : null),
        selectedTimezone: reliableUserTimezone
      });
      
      console.log('Calling /api/checkout with:', { variantId, bookingData, storePendingBooking });
      
      const response = await fetch(`${appUrl}/api/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          variantId,
          bookingData,
          provider: 'lemonsqueezy',
          storePendingBooking
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Checkout error:', errorData);
        
        if (response.status === 422) {
          console.log('Trying checkout with minimal data...');
          
          const minimalBookingData = {
            userEmail,
            bookingPlan: { frequency: bookingPlan.frequency, coach: bookingPlan.coach }
          };
          
          const retryResponse = await fetch(`${appUrl}/api/checkout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              variantId,
              bookingData: minimalBookingData,
              provider: 'lemonsqueezy',
              storePendingBooking
            }),
          });
          
          if (!retryResponse.ok) {
            const retryErrorData = await retryResponse.text();
            console.error('Retry checkout error:', retryErrorData);
            throw new Error('Failed to create checkout, even with minimal data');
          }
          
          const retryResult = await retryResponse.json();
          return {
            checkoutUrl: retryResult.checkoutUrl,
            orderId: retryResult.orderId
          };
        }
        
        throw new Error('Failed to create checkout');
      }
      
      const { checkoutUrl, orderId } = await response.json();
      
      console.log('Checkout created successfully:', { checkoutUrl, orderId });
      
      try {
        const pendingBookingData = getClientCookie('pending_booking');
        if (pendingBookingData) {
          const updatedBookingData = { ...pendingBookingData, orderId };
          setClientCookie('pending_booking', updatedBookingData);
        }
      } catch (e) {
        console.error('Error updating pendingBooking with order ID:', e);
      }

      return {
        checkoutUrl,
        orderId
      };
    } catch (error) {
      console.error('Lemon Squeezy Checkout error:', error);
      throw error;
    }
  },
  getVariantIdForBookingPlan: (): string | null => {
    console.warn("lemonSqueezyService.getVariantIdForBookingPlan called directly, consider using getLemonSqueezyVariantId helper.");
    return null;
  }
}; 