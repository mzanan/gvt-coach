import { BookingPlan } from '@/types/booking';
import { CheckoutResponse, PaymentProviderService } from '@/types/payment';
import { BookingFrequency } from '@/types/enums';
import { DateTime } from 'luxon';
import { getClientCookie, setClientCookie } from '@/lib/utils/cookies';
import { UserProfile } from '@/types/user';

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
      
      const frequencyString = bookingPlan.frequency;
      if (!frequencyString) {
        throw new Error('Invalid booking plan frequency: frequency is null');
      }
      const variantId = lemonSqueezyService.getVariantIdForBookingPlan(frequencyString);
      if (!variantId) {
        throw new Error(`Invalid booking plan frequency or no variant ID found for: ${frequencyString}`);
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
      
      // Call the checkout API
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
        
        // If we get a 422 error, try with minimal data
        if (response.status === 422) {
          console.log('Trying checkout with minimal data...');
          
          // Create a minimal version of booking data
          const minimalBookingData = {
            userEmail,
            bookingPlan: {
              frequency: bookingPlan.frequency
            }
          };
          
          // Try again with minimal data
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
      
      // Update the pendingBooking in cookie with the orderId
      try {
        const pendingBookingData = getClientCookie('pending_booking');
        if (pendingBookingData) {
          const updatedBookingData = {
            ...pendingBookingData,
            orderId,
            booking: {
              ...pendingBookingData.booking,
              checkout_order_id: orderId
            }
          };
          setClientCookie('pending_booking', updatedBookingData);
        }
      } catch (e) {
        console.error('Error updating pendingBooking with order IDs:', e);
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

  getVariantIdForBookingPlan(frequency: string): string | null {
    console.log('LemonSqueezy booking frequency:', frequency);
    
    switch (frequency) {
      case BookingFrequency.Once:
        // First try server-side environment variable, then fall back to public one
        const singleSessionVariantId = process.env.GVT_COACH_LEMONSQUEEZY_SINGLE_SESSION_VARIANT_ID || 
                                    process.env.NEXT_PUBLIC_GVT_COACH_LEMONSQUEEZY_SINGLE_SESSION_VARIANT_ID;
        
        if (!singleSessionVariantId) {
          console.error('Missing GVT_COACH_LEMONSQUEEZY_SINGLE_SESSION_VARIANT_ID environment variable');
          return null;
        }
        
        // Log available environment variables for debugging
        console.log('Environment variables:', {
          singleSessionVariantId,
          storeId: process.env.NEXT_PUBLIC_GVT_COACH_LEMONSQUEEZY_STORE_ID
        });
        
        return singleSessionVariantId;
        
      case BookingFrequency.Weekly:
        // First try server-side environment variable, then fall back to public one
        const weeklyVariantId = process.env.GVT_COACH_LEMONSQUEEZY_WEEKLY_VARIANT_ID || 
                             process.env.NEXT_PUBLIC_GVT_COACH_LEMONSQUEEZY_WEEKLY_VARIANT_ID;
        
        if (!weeklyVariantId) {
          console.error('Missing GVT_COACH_LEMONSQUEEZY_WEEKLY_VARIANT_ID environment variable');
          return null;
        }
        return weeklyVariantId;
        
      case BookingFrequency.TwiceWeekly:
        // First try server-side environment variable, then fall back to public one
        const twiceWeeklyVariantId = process.env.GVT_COACH_LEMONSQUEEZY_TWICE_WEEKLY_VARIANT_ID || 
                                  process.env.NEXT_PUBLIC_GVT_COACH_LEMONSQUEEZY_TWICE_WEEKLY_VARIANT_ID;
        
        if (!twiceWeeklyVariantId) {
          console.error('Missing GVT_COACH_LEMONSQUEEZY_TWICE_WEEKLY_VARIANT_ID environment variable');
          return null;
        }
        return twiceWeeklyVariantId;
        
      default:
        console.error(`Unsupported booking frequency: ${frequency}`);
        return null;
    }
  }
}; 