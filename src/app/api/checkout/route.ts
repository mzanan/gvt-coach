import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createLemonSqueezyCheckout } from './lemonsqueezy';
import { createPolarCheckout } from './polar';
import { createStripeCheckout } from './stripe';
import { BookingFrequency, PaymentOrderStatus } from '@/types/enums';
import { CoachId } from '@/config/coaches';
import { getLemonSqueezyVariantId, getPolarProductId } from '@/lib/utils/productIds';
import { insertBooking } from '@/lib/db/bookings';
import { insertPaymentStatus, upsertMapping } from '@/lib/db/payments';

interface CheckoutBookingData {
  userEmail?: string;
  selectedDate?: string;
  utcDate?: string;
  selectedTimezone?: string;
  bookingPlan?: {
    coach?: CoachId;
    frequency?: BookingFrequency;
  };
}

async function createPendingRecords(
  orderId: string,
  provider: string,
  bookingData: CheckoutBookingData,
  frequency: BookingFrequency,
  coach: CoachId,
  status: PaymentOrderStatus = PaymentOrderStatus.Pending
): Promise<void> {
  try {
    const confirmed = status === PaymentOrderStatus.Paid;

    const paymentStatus = await insertPaymentStatus({
      status,
      checkout_order_id: orderId,
      json_data: { checkout_order_id: orderId, provider }
    });

    await upsertMapping({
      checkout_order_id: orderId,
      payment_status_id: paymentStatus.id,
      payment_order_id: orderId,
      provider
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
          user_email: bookingData.userEmail,
          booking_date: bookingDateValue,
          user_timezone: bookingData.selectedTimezone || null,
          frequency,
          checkout_order_id: orderId,
          duration: 60,
          coach,
          payment_status: status,
          payment_confirmed: confirmed,
          checkout_completed: confirmed
        });
      }
    }
  } catch (dbError) {
    console.error('Checkout API: Error creating database records:', dbError);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookingData, provider: requestedProvider = 'stripe', storePendingBooking } = body;

    if (!bookingData || !bookingData.bookingPlan || !bookingData.bookingPlan.coach) {
      console.error('Checkout API: Missing booking data or coach information in request body:', body);
      return NextResponse.json({ error: 'Missing booking data or coach information' }, { status: 400 });
    }

    const selectedCoach: CoachId = bookingData.bookingPlan.coach;
    const frequency: BookingFrequency = bookingData.bookingPlan.frequency || BookingFrequency.Once;
    const paymentProvider = String(requestedProvider).toLowerCase().trim();

    let checkoutUrl = '';
    let orderId = '';

    if (paymentProvider === 'disabled') {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (!appUrl) {
        throw new Error('Application URL configuration is missing. Please set NEXT_PUBLIC_APP_URL.');
      }

      orderId = randomUUID();
      checkoutUrl = `${appUrl}/payment/success?checkout_order_id=${orderId}`;

      await createPendingRecords(orderId, 'disabled', bookingData, frequency, selectedCoach, PaymentOrderStatus.Paid);
    } else if (paymentProvider === 'polar') {
      const productId = getPolarProductId(selectedCoach);
      if (!productId) {
        throw new Error(`Polar Product ID not configured for coach ${selectedCoach}`);
      }
      const polarResponse = await createPolarCheckout(productId, bookingData);
      checkoutUrl = polarResponse.checkoutUrl;
      orderId = polarResponse.orderId;
    } else if (paymentProvider === 'lemonsqueezy') {
      const variantId = getLemonSqueezyVariantId(selectedCoach, frequency);
      if (!variantId) {
        throw new Error(`Lemon Squeezy Variant ID not configured for coach ${selectedCoach} and frequency ${frequency}`);
      }
      const lemonResponse = await createLemonSqueezyCheckout(variantId, bookingData);
      checkoutUrl = lemonResponse.checkoutUrl;
      orderId = lemonResponse.orderId;

      if (bookingData.userEmail) {
        await createPendingRecords(orderId, 'lemonsqueezy', bookingData, frequency, selectedCoach);
      }
    } else {
      const stripeResponse = await createStripeCheckout(bookingData);
      checkoutUrl = stripeResponse.checkoutUrl;
      orderId = stripeResponse.orderId;

      if (bookingData.userEmail) {
        await createPendingRecords(orderId, 'stripe', bookingData, frequency, selectedCoach);
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
