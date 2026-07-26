import { NextResponse, NextRequest } from 'next/server';
import { PaymentOrderStatus, BookingFrequency } from '@/types/enums';
import { getBookingByOrderId, insertBooking } from '@/lib/db/bookings';
import { getPaymentStatusByOrderId, insertPaymentStatus, upsertMapping } from '@/lib/db/payments';

export async function POST(request: NextRequest) {
  try {
    const { email, date, orderId, meetLink } = await request.json();

    if (!email || !date || !orderId) {
      return NextResponse.json(
        { error: 'Missing required fields: email, date, orderId are required' },
        { status: 400 }
      );
    }

    const bookingDate = typeof date === 'string' ? new Date(date) : date;

    const existingPaymentStatus = await getPaymentStatusByOrderId(orderId);

    if (!existingPaymentStatus) {
      await insertPaymentStatus({
        status: PaymentOrderStatus.Pending,
        checkout_order_id: orderId
      });
    }

    const existingBooking = await getBookingByOrderId(orderId);

    if (existingBooking) {
      return NextResponse.json(existingBooking);
    }

    const booking = await insertBooking({
      user_email: email,
      booking_date: bookingDate.toISOString(),
      frequency: BookingFrequency.Once,
      checkout_order_id: orderId,
      meet_link: meetLink,
      status: PaymentOrderStatus.Pending
    });

    try {
      await upsertMapping({ checkout_order_id: orderId });
    } catch (mappingError) {
      console.warn('[POST /api/bookings] Non-critical mapping table error:', mappingError);
    }

    return NextResponse.json([booking]);
  } catch (error) {
    console.error('[POST /api/bookings] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

