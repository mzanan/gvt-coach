import { NextRequest, NextResponse } from 'next/server';
import { createLemonSqueezyCheckout } from './lemonsqueezy';
import { createPolarCheckout } from './polar';
import { BookingFrequency, PaymentOrderStatus } from '@/types/enums';
import { CoachId } from '@/config/coaches';
import { getLemonSqueezyVariantId, getPolarProductId } from '@/lib/utils/productIds';
import { insertBooking } from '@/lib/db/bookings';
import { insertPaymentStatus, upsertMapping } from '@/lib/db/payments';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookingData, provider: requestedProvider = 'lemonsqueezy', storePendingBooking } = body;

    if (!bookingData || !bookingData.bookingPlan || !bookingData.bookingPlan.coach) {
      console.error('Checkout API: Missing booking data or coach information in request body:', body);
      return NextResponse.json({ error: 'Missing booking data or coach information' }, { status: 400 });
    }

    const selectedCoach: CoachId = bookingData.bookingPlan.coach;
    const frequency: BookingFrequency = bookingData.bookingPlan.frequency || BookingFrequency.Once;
    const paymentProvider = String(requestedProvider).toLowerCase().trim();

    let checkoutUrl = '';
    let orderId = '';
    let productIdForProvider: string | null = null;

    if (paymentProvider === 'polar') {
      productIdForProvider = getPolarProductId(selectedCoach);
      if (!productIdForProvider) {
        throw new Error(`Polar Product ID not configured for coach ${selectedCoach}`);
      }
      const polarResponse = await createPolarCheckout(productIdForProvider, bookingData);
      checkoutUrl = polarResponse.checkoutUrl;
      orderId = polarResponse.orderId;
    } else {
      productIdForProvider = getLemonSqueezyVariantId(selectedCoach, frequency);
      if (!productIdForProvider) {
        throw new Error(`Lemon Squeezy Variant ID not configured for coach ${selectedCoach} and frequency ${frequency}`);
      }
      const lemonResponse = await createLemonSqueezyCheckout(productIdForProvider, bookingData);
      checkoutUrl = lemonResponse.checkoutUrl;
      orderId = lemonResponse.orderId;

      if (bookingData && bookingData.userEmail) {
        try {
          const userEmail = bookingData.userEmail;

          const paymentStatus = await insertPaymentStatus({
            status: PaymentOrderStatus.Pending,
            json_data: { checkout_order_id: orderId, provider: 'lemonsqueezy' }
          });

          await upsertMapping({
            checkout_order_id: orderId,
            payment_status_id: paymentStatus.id,
            provider: 'lemonsqueezy'
          });

          if (bookingData.selectedDate) {
            let bookingDateValue: string | null = null;
            try {
              bookingDateValue = bookingData.utcDate || new Date(bookingData.selectedDate).toISOString();
            } catch {
              console.error('Invalid date format:', bookingData.selectedDate);
            }

            if (bookingDateValue) {
              await insertBooking({
                user_email: userEmail,
                booking_date: bookingDateValue,
                user_timezone: bookingData.selectedTimezone || null,
                frequency,
                checkout_order_id: orderId,
                duration: 60,
                coach: selectedCoach
              });
            }
          }
        } catch (dbError) {
          console.error('Checkout API: Error creating database records:', dbError);
        }
      }
    }

    if (bookingData && storePendingBooking) {
      return NextResponse.json({ checkoutUrl, orderId, provider: paymentProvider, checkoutOrderId: orderId });
    }
    return NextResponse.json({ checkoutUrl, orderId, provider: paymentProvider });
  } catch (error) {
    console.error('Checkout API: Unexpected error', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
