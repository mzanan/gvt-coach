import { BookingPlan } from '@/types/booking';
import { UserProfile } from '@/types/user';
import { CheckoutResponse, PaymentProviderService } from '../types';
import { BookingFrequency } from '@/types/enums/booking';
import { DateTime } from 'luxon';
import { getClientCookie, setClientCookie } from '@/lib/utils/cookies';

export const polarService: PaymentProviderService = {
  createCheckout: async (
    bookingPlan: BookingPlan, 
    userProfile: UserProfile,
    storePendingBooking = false
  ): Promise<CheckoutResponse> => {
    try {
      // Validate required environment variables
      if (!process.env.NEXT_PUBLIC_APP_URL) {
        console.error('Missing NEXT_PUBLIC_APP_URL environment variable');
        throw new Error('Configuration error');
      }
      
      // Get user email from user profile or cookies
      const userEmail = userProfile?.email || getClientCookie('user_email') || '';
      
      // Get variant ID based on booking plan
      const variantId = polarService.getVariantIdForBookingPlan(bookingPlan.frequency);
      console.log('variantId', variantId);
      if (!variantId) {
        throw new Error('Invalid booking plan frequency');
      }
      
      // Log Polar environment variables for debugging
      console.log('Polar env check:', {
        accessToken: process.env.GVT_COACH_POLAR_SANDBOX_ACCESS_TOKEN ? 'Set' : 'Not set',
        productIds: {
          single: process.env.NEXT_PUBLIC_GVT_COACH_POLAR_SINGLE_SESSION_PRODUCT_ID ? 'Set' : 'Not set',
          weekly: process.env.GVT_COACH_POLAR_WEEKLY_PRODUCT_ID ? 'Set' : 'Not set',
          twiceWeekly: process.env.GVT_COACH_POLAR_TWICE_WEEKLY_PRODUCT_ID ? 'Set' : 'Not set'
        },
        webhookSecret: process.env.GVT_COACH_POLAR_WEBHOOK_SECRET ? 'Set' : 'Not set',
        apiUrl: process.env.GVT_COACH_POLAR_SANDBOX_API_URL ? 'Set' : 'Not set'
      });
      
      // Get the pending booking data from cookies if available
      let selectedDate = null;
      let utcDate = null;
      const userTimezone = userProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      try {
        const pendingBookingData = getClientCookie('pending_booking');
        if (pendingBookingData) {
          selectedDate = pendingBookingData.selectedDate;
          
          // Intentar obtener la fecha UTC del booking plan
          if (bookingPlan.firstSlot) {
            // Si tenemos una fecha seleccionada y utcDate, usamos esas directamente
            if (bookingPlan.firstSlot.date && bookingPlan.firstSlot.utcDate) {
              console.log('⭐ Polar: Usando firstSlot con fecha local y UTC');
              
              // Convertir a string ISO para consistencia
              selectedDate = DateTime.fromJSDate(bookingPlan.firstSlot.date)
                .setZone(userTimezone)
                .toISO();
                
              utcDate = DateTime.fromJSDate(bookingPlan.firstSlot.utcDate)
                .toUTC()
                .toISO();
                
              console.log('📅 Polar: Fechas extraídas del slot:', {
                selectedDate,
                utcDate,
                timezone: userTimezone,
                localHour: DateTime.fromJSDate(bookingPlan.firstSlot.date).hour,
                utcHour: DateTime.fromJSDate(bookingPlan.firstSlot.utcDate).hour
              });
            }
          }
        }
      } catch (e) {
        console.error('Error parsing pendingBooking for date:', e);
      }
      
      // Prepare booking data
      const bookingData = {
        userEmail,
        bookingPlan: {
          frequency: bookingPlan.frequency
        },
        selectedDate,
        utcDate,
        selectedTimezone: userTimezone
      };
      
      // Log booking data being sent
      console.log('📤 Polar: Enviando datos de reserva:', {
        selectedDate,
        utcDate,
        timezone: userTimezone
      });
      
      // Store booking data in cookie for reference
      setClientCookie('pending_booking', bookingData);
      
      // Call the checkout API
      console.log('Calling /api/checkout with:', { variantId, bookingData, provider: 'polar', storePendingBooking });
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          variantId,
          bookingData,
          provider: 'polar',
          storePendingBooking
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Checkout error:', errorText);
        throw new Error('Failed to create checkout');
      }
      
      const responseData = await response.json();
      const { checkoutUrl, orderId } = responseData;
      
      console.log('Checkout created successfully:', { 
        checkoutUrl, 
        orderId 
      });
      
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
          
          // NUEVO: Crear registros en la base de datos con booking/create
          console.log('Registering booking data using booking/create endpoint');
          
          // Make sure we're passing the selectedDate from the pendingBookingData
          const bookingCreateData = {
            orderId,
            bookingData: {
              userEmail,
              // Pass the entire bookingPlan object received by createCheckout
              bookingPlan: bookingPlan,
              // Make sure we always have a valid selectedDate
              selectedDate: bookingPlan.firstSlot?.date ? 
                DateTime.fromJSDate(bookingPlan.firstSlot.date)
                  .setZone(userTimezone)
                  .toISO() : 
                pendingBookingData?.selectedDate,
              selectedTimezone: pendingBookingData?.selectedTimezone || userProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
              productId: variantId
            },
            provider: 'polar'
          };
          
          // Verify we have a valid date before proceeding
          if (!bookingCreateData.bookingData.selectedDate) {
            console.error('Error: No valid date found for booking, cannot proceed:', { 
              pendingBookingDate: pendingBookingData?.selectedDate,
              bookingPlanDate: bookingPlan.firstSlot?.date ? 'Present' : 'Missing'
            });
            throw new Error('No valid booking date available');
          }
          
          console.log('Sending booking create data:', JSON.stringify(bookingCreateData));
          
          const bookingCreateResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/booking/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(bookingCreateData),
          });
          
          if (bookingCreateResponse.ok) {
            const bookingResult = await bookingCreateResponse.json();
            console.log('Booking registration success:', bookingResult);
          } else {
            const errorText = await bookingCreateResponse.text();
            console.error('Error registering booking:', errorText);
          }
        }
      } catch (e) {
        console.error('Error updating pendingBooking or registering booking:', e);
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
    console.log('Booking frequency:', frequency);
    
    switch (frequency) {
      case BookingFrequency.Once:
        const singleSessionProductId = process.env.NEXT_PUBLIC_GVT_COACH_POLAR_SINGLE_SESSION_PRODUCT_ID;
        
        if (!singleSessionProductId) {
          console.error('Missing NEXT_PUBLIC_GVT_COACH_POLAR_SINGLE_SESSION_PRODUCT_ID environment variable');
          return null;
        }
        return singleSessionProductId;
        
      case BookingFrequency.Weekly:
        // First try server-side environment variable, then fall back to public one
        const weeklyProductId = process.env.GVT_COACH_POLAR_WEEKLY_PRODUCT_ID || 
                        process.env.NEXT_PUBLIC_GVT_COACH_POLAR_WEEKLY_PRODUCT_ID;
        
        if (!weeklyProductId) {
          console.error('Missing GVT_COACH_POLAR_WEEKLY_PRODUCT_ID environment variable');
          return null;
        }
        return weeklyProductId;
        
      case BookingFrequency.TwiceWeekly:
        // First try server-side environment variable, then fall back to public one
        const twiceWeeklyProductId = process.env.GVT_COACH_POLAR_TWICE_WEEKLY_PRODUCT_ID || 
                        process.env.NEXT_PUBLIC_GVT_COACH_POLAR_TWICE_WEEKLY_PRODUCT_ID;
        
        if (!twiceWeeklyProductId) {
          console.error('Missing GVT_COACH_POLAR_TWICE_WEEKLY_PRODUCT_ID environment variable');
          return null;
        }
        return twiceWeeklyProductId;
        
      default:
        console.error(`Unsupported booking frequency: ${frequency}`);
        return null;
    }
  }
}; 