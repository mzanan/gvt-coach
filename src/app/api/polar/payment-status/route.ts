import { NextRequest, NextResponse } from 'next/server';
import { BookingFrequency, PaymentOrderStatus } from '@/types/enums';
import { insertBooking } from '@/lib/db/bookings';
import { insertPaymentStatus, upsertMapping } from '@/lib/db/payments';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, bookingData, provider } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId is required' },
        { status: 400 }
      );
    }

    const paymentStatus = await insertPaymentStatus({
      status: PaymentOrderStatus.Pending,
      json_data: bookingData || null
    });

    await upsertMapping({
      checkout_order_id: orderId,
      payment_order_id: orderId,
      payment_identifier_id: null,
      payment_status_id: paymentStatus.id,
      provider: provider || process.env.NEXT_PUBLIC_PAYMENT_PROVIDER || 'lemonsqueezy'
    });

    if (bookingData && bookingData.userEmail && bookingData.selectedDate) {
      try {
        const bookingDate = new Date(bookingData.selectedDate);
        const bookingFrequency = bookingData.bookingPlan?.frequency || BookingFrequency.Once;
        const userTimezone = bookingData.selectedTimezone || 'UTC';

        await insertBooking({
          checkout_order_id: orderId,
          user_email: bookingData.userEmail,
          payment_status: PaymentOrderStatus.Pending,
          checkout_completed: false,
          payment_confirmed: false,
          booking_date: bookingDate.toISOString(),
          frequency: bookingFrequency,
          user_timezone: userTimezone
        });
      } catch (bookingError) {
        console.error('Error creating booking record:', bookingError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Payment status created successfully',
      orderId
    });
  } catch (error) {
    console.error('Unexpected error in payment status API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
