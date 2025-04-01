import { BookingPlan } from '@/types/booking';
import { UserProfile } from '../../../types/user';
import { CheckoutResponse, PaymentProviderService } from '@/types/payment';
import { BookingFrequency } from '@/types/enums';
import { DateTime } from 'luxon';
import { getClientCookie, setClientCookie } from '@/lib/utils/cookies';

export const polarService: PaymentProviderService = {
  async createCheckout(
    bookingPlan: BookingPlan,
    userProfile: UserProfile,
    storePendingBooking = true
  ): Promise<CheckoutResponse> {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (!appUrl) {
        console.error('Missing NEXT_PUBLIC_APP_URL environment variable');
        throw new Error('Application URL configuration is missing.');
      }
      
      const userEmail = userProfile?.email || getClientCookie('user_email') || '';

      const frequencyString = bookingPlan.frequency;
      if (!frequencyString) {
        throw new Error('Invalid booking plan frequency: frequency is null');
      }
      const variantId = polarService.getVariantIdForBookingPlan(frequencyString);
      if (!variantId) {
        throw new Error(`Invalid booking plan frequency or no variant ID found for: ${frequencyString}`);
      }
      
      const reliableUserTimezone = getClientCookie('user_timezone') || 
                                    userProfile?.timezone || 
                                    Intl.DateTimeFormat().resolvedOptions().timeZone;

      let selectedDate: string | null = null;
      let utcDateString: string | null = null;
      
      try {
        const pendingBookingData = getClientCookie('pending_booking');
        if (pendingBookingData) {
          selectedDate = pendingBookingData.selectedDate;
          
          // Intentar obtener la fecha UTC del booking plan
          if (bookingPlan.firstSlot) {
            // Si tenemos una fecha seleccionada y utcDate, usamos esas directamente
            if (bookingPlan.firstSlot.date && bookingPlan.firstSlot.utcDate) {
              selectedDate = DateTime.fromJSDate(bookingPlan.firstSlot.date)
                .setZone(reliableUserTimezone)
                .toISO();
                
              utcDateString = DateTime.fromJSDate(bookingPlan.firstSlot.utcDate)
                .toUTC()
                .toISO();
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
        utcDate: utcDateString,
        selectedTimezone: reliableUserTimezone
      };
      
      // Store booking data in cookie for reference
      setClientCookie('pending_booking', bookingData);
      
      // Call the checkout API
      const response = await fetch(`${appUrl}/api/checkout`, {
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
      
      if (storePendingBooking) {
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
                    .setZone(reliableUserTimezone)
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
            
            const bookingCreateResponse = await fetch(`${appUrl}/api/booking/create`, {
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

  getVariantIdForBookingPlan: (frequency: BookingFrequency): string | null => {
    const productId = process.env.NEXT_PUBLIC_GVT_COACH_POLAR_SINGLE_SESSION_PRODUCT_ID;
    
    if (frequency === BookingFrequency.Once && productId) {
      return productId;
    }
    return null;
  }
}; 