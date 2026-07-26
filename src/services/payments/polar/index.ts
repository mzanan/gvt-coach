import { BookingPlan } from '@/types/booking';
import { UserProfile } from '../../../types/user';
import { CheckoutResponse, PaymentProviderService } from '@/types/payment';
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

      const selectedCoach = bookingPlan.coach;
      if (!selectedCoach) {
        throw new Error('Coach not specified in booking plan');
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
        bookingPlan: bookingPlan,
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

          bookingData,
          provider: 'polar',
          storePendingBooking
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Polar Checkout error:', errorData);
        throw new Error('Failed to create Polar checkout');
      }
      
      const { checkoutUrl, orderId } = await response.json();
      console.log('Polar Checkout created successfully:', { checkoutUrl, orderId });
      
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
                selectedTimezone: pendingBookingData?.selectedTimezone || userProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
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
      console.error('Polar Checkout error:', error);
      throw error;
    }
  },

  getVariantIdForBookingPlan: (): string | null => {
    console.warn("Polar service doesn't use getVariantIdForBookingPlan directly in this setup.");
    return null;
  }
}; 