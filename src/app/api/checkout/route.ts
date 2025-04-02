import { NextRequest, NextResponse } from 'next/server';
import { createLemonSqueezyCheckout } from './lemonsqueezy';
import { createPolarCheckout } from './polar';
import { createClient } from '@/lib/supabase/server';
import { BookingFrequency, PaymentOrderStatus } from '@/types/enums';
import { CoachId } from '@/config/coaches';
import { getLemonSqueezyVariantId, getPolarProductId } from '@/lib/utils/productIds';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookingData, provider: requestedProvider = 'lemonsqueezy', storePendingBooking } = body;
    
    // Validate bookingData and coach exist
    if (!bookingData || !bookingData.bookingPlan || !bookingData.bookingPlan.coach) {
        console.error('Checkout API: Missing booking data or coach information in request body:', body);
        return NextResponse.json({ error: 'Missing booking data or coach information' }, { status: 400 });
    }

    // Extract coach and frequency
    const selectedCoach: CoachId = bookingData.bookingPlan.coach;
    const frequency: BookingFrequency = bookingData.bookingPlan.frequency || BookingFrequency.Once;
    const paymentProvider = String(requestedProvider).toLowerCase().trim();

    console.log('Checkout API: Processing request for coach', selectedCoach, 'with provider', paymentProvider);

    let checkoutUrl = '';
    let orderId = '';
    let productIdForProvider: string | null = null;

    // Get the correct ID based on provider and coach
    if (paymentProvider === 'polar') {
      productIdForProvider = getPolarProductId(selectedCoach);
      if (!productIdForProvider) {
        console.error(`Checkout API: Polar Product ID not configured for coach ${selectedCoach}`);
        throw new Error(`Polar Product ID not configured for coach ${selectedCoach}`);
      }
      // Pass the correct ID (productIdForProvider) to createPolarCheckout
      const polarResponse = await createPolarCheckout(productIdForProvider, bookingData);
      checkoutUrl = polarResponse.checkoutUrl;
      orderId = polarResponse.orderId;
    } else { // Default to LemonSqueezy
      productIdForProvider = getLemonSqueezyVariantId(selectedCoach, frequency);
      if (!productIdForProvider) {
         console.error(`Checkout API: Lemon Squeezy Variant ID not configured for coach ${selectedCoach} and frequency ${frequency}`);
        throw new Error(`Lemon Squeezy Variant ID not configured for coach ${selectedCoach} and frequency ${frequency}`);
      }
      // Log the variant ID being used
      console.log(`Checkout API: Using Lemon Squeezy Variant ID: ${productIdForProvider} for coach ${selectedCoach}`);
      // Pass the correct ID (productIdForProvider) to createLemonSqueezyCheckout
      const lemonResponse = await createLemonSqueezyCheckout(productIdForProvider, bookingData);
      checkoutUrl = lemonResponse.checkoutUrl;
      orderId = lemonResponse.orderId;

      // Database operations for LemonSqueezy
      if (bookingData && bookingData.userEmail) {
        try {
          const supabase = await createClient(); 
          const userEmail = bookingData.userEmail;

          console.log('Checkout API: Creating pending DB records for LemonSqueezy', { userEmail, frequency, orderId, coach: selectedCoach, hasBookingDate: !!bookingData.selectedDate });

          const { data: paymentStatus, error: paymentStatusError } = await supabase
            .from('gvt_coach_payments_status')
            .insert({ status: PaymentOrderStatus.Pending, json_data: { checkout_order_id: orderId, provider: 'lemonsqueezy' } })
            .select('id')
            .single();

          if (paymentStatusError) throw paymentStatusError;
          console.log('Checkout API: Created payment status record:', paymentStatus.id);

          const { error: mappingError } = await supabase
            .from('gvt_coach_checkout_mapping')
            .insert({ checkout_order_id: orderId, payment_status_id: paymentStatus.id, provider: 'lemonsqueezy' });

          if (mappingError) throw mappingError;
          console.log('Checkout API: Created checkout mapping');

          if (bookingData.selectedDate) {
            let bookingDateValue: string | null = null;
            try {
              bookingDateValue = bookingData.utcDate || new Date(bookingData.selectedDate).toISOString();
            } catch { 
              console.error("Invalid date format:", bookingData.selectedDate); 
            }

            if (bookingDateValue) {
              const { error: bookingError } = await supabase
                .from('gvt_coach_meetings_bookings')
                .insert([{ 
                  user_email: userEmail, 
                  booking_date: bookingDateValue, 
                  user_timezone: bookingData.selectedTimezone || null,
                  frequency: frequency, 
                  checkout_order_id: orderId, 
                  duration: 60, // Or get from bookingData
                  coach: selectedCoach // Ensure coach is saved
                }]);

              if (bookingError) { console.error('Checkout API: Error creating booking record:', bookingError); }
              else { console.log('Checkout API: Created pending booking record with orderId:', orderId); }
            }
          } else {
            console.log('Checkout API: No booking date, skipping booking record creation');
          }
        } catch (dbError) {
          console.error('Checkout API: Error creating database records:', dbError);
        }
      }
    }

    // Handle storePendingBooking logic and return response
    if (bookingData && storePendingBooking) {
        const responseDataWithId = { checkoutUrl, orderId, provider: paymentProvider, checkoutOrderId: orderId };
        return NextResponse.json(responseDataWithId);
    } else {
        return NextResponse.json({ checkoutUrl, orderId, provider: paymentProvider });
    }

  } catch (error) {
    console.error('Checkout API: Unexpected error', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 