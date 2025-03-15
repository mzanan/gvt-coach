import { BookingPlan } from '@/app/types/booking';
import { UserProfile } from '@/app/types/user';
import { CheckoutResponse, PaymentProviderService } from '../types';
import { BookingFrequency } from '@/app/types/enums/booking';
import { DateTime } from 'luxon';

export const lemonSqueezyService: PaymentProviderService = {
  createCheckout: async (
    bookingPlan: BookingPlan, 
    userProfile: UserProfile,
    storePendingBooking = false
  ): Promise<CheckoutResponse> => {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      
      // Get user email
      const userEmail = userProfile?.email || localStorage.getItem('userEmail') || '';
      
      // Get variant ID based on booking plan
      const variantId = lemonSqueezyService.getVariantIdForBookingPlan(bookingPlan.frequency);
      
      if (!variantId) {
        throw new Error('Invalid booking plan frequency');
      }

      // Debug: Log the environment and variant ID
      console.log('Current environment:', process.env.NEXT_PUBLIC_ENV);
      console.log('Using variant ID:', variantId);
      
      // Get the actual selected slot time from the booking plan
      const slotTime = bookingPlan.firstSlot?.date;
      const utcDate = bookingPlan.firstSlot?.utcDate;
      
      // Logging simplificado del plan de reserva
      console.log('Plan de reserva:', {
        frequency: bookingPlan.frequency,
        slot: bookingPlan.firstSlot ? {
          id: bookingPlan.firstSlot.id,
          local: bookingPlan.firstSlot.date ? new Date(bookingPlan.firstSlot.date).toISOString() : null,
          utc: bookingPlan.firstSlot.utcDate ? new Date(bookingPlan.firstSlot.utcDate).toISOString() : null,
        } : null
      });
      
      // Convertir fechas de manera simplificada
      let localTimeString = null;
      let utcTimeString = null;
      
      try {
        if (slotTime) {
          const userTimezone = userProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
          
          // Obtener tiempo local y UTC en un solo paso
          const slotDateTime = DateTime.fromJSDate(new Date(slotTime));
          localTimeString = slotDateTime.setZone(userTimezone).toISO();
          utcTimeString = utcDate ? 
            DateTime.fromJSDate(new Date(utcDate)).toISO() : 
            slotDateTime.toUTC().toISO();
        }
      } catch (e) {
        console.error('Error procesando fecha/hora:', e);
      }
      
      // Prepare booking data - simplified version to avoid potential issues
      const bookingData = {
        userEmail,
        bookingPlan: {
          frequency: bookingPlan.frequency
        },
        selectedDate: localTimeString || null,
        utcDate: utcTimeString || null,
        selectedTimezone: userProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
      };
      
      // Store booking data in localStorage for reference with complete details
      localStorage.setItem('pendingBooking', JSON.stringify({
        userEmail,
        bookingPlan,
        selectedDate: localTimeString || (slotTime ? new Date(slotTime).toISOString() : null),
        utcDate: utcTimeString || (utcDate ? new Date(utcDate).toISOString() : null),
        selectedTimezone: userProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
      }));
      
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