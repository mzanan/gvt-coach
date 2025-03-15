import { BookingPlan } from '@/app/types/booking';
import { UserProfile } from '@/app/types/user';
import { CheckoutResponse, PaymentProviderService } from '../types';
import { BookingFrequency } from '@/app/types/enums/booking';
import { DateTime } from 'luxon';

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
      
      // Get user email
      const userEmail = userProfile?.email || localStorage.getItem('userEmail') || '';
      
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
          single: process.env.GVT_COACH_POLAR_SINGLE_SESSION_PRODUCT_ID ? 'Set' : 'Not set',
          weekly: process.env.GVT_COACH_POLAR_WEEKLY_PRODUCT_ID ? 'Set' : 'Not set',
          twiceWeekly: process.env.GVT_COACH_POLAR_TWICE_WEEKLY_PRODUCT_ID ? 'Set' : 'Not set'
        },
        webhookSecret: process.env.GVT_COACH_POLAR_WEBHOOK_SECRET ? 'Set' : 'Not set',
        apiUrl: process.env.GVT_COACH_POLAR_SANDBOX_API_URL ? 'Set' : 'Not set'
      });
      
      // Get the selectedSlot data from localStorage if available
      let selectedDate = null;
      let utcDate = null;
      const userTimezone = userProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      try {
        const pendingBookingStr = localStorage.getItem('pendingBooking');
        if (pendingBookingStr) {
          const pendingBookingData = JSON.parse(pendingBookingStr);
          selectedDate = pendingBookingData.selectedDate;
          
          // Intentar obtener la fecha UTC del booking plan
          if (bookingPlan.firstSlot) {
            // Import DateTime from luxon at the top of the file instead of using require()
            // const { DateTime } = require('luxon');
            // (ensure to add the import at the top of the file)
            
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
      
      // Store booking data in localStorage for reference
      localStorage.setItem('pendingBooking', JSON.stringify(bookingData));
      
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
      
      // Update the pendingBooking in localStorage with the orderId
      try {
        const pendingBookingStr = localStorage.getItem('pendingBooking');
        if (pendingBookingStr) {
          const pendingData = JSON.parse(pendingBookingStr);

          const updatedBookingData = {
            ...pendingData,
            orderId,
            booking: {
              ...pendingData.booking,
              checkout_order_id: orderId
            }
          };
          localStorage.setItem('pendingBooking', JSON.stringify(updatedBookingData));
          
          // NUEVO: Crear registros en la base de datos con booking/create
          console.log('Registering booking data using booking/create endpoint');
          const bookingCreateResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/booking/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              orderId,
              bookingData: {
                userEmail,
                selectedDate,
                selectedTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                productId: variantId
              },
              provider: 'polar'
            }),
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
        // First try server-side environment variable, then fall back to public one
        const singleSessionProductId = process.env.GVT_COACH_POLAR_SINGLE_SESSION_PRODUCT_ID || 
                        process.env.NEXT_PUBLIC_GVT_COACH_POLAR_SINGLE_SESSION_PRODUCT_ID;
        
        if (!singleSessionProductId) {
          console.error('Missing GVT_COACH_POLAR_SINGLE_SESSION_PRODUCT_ID environment variable');
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