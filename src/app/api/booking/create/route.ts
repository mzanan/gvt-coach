import { NextRequest, NextResponse } from 'next/server';
import { BookingFrequency } from '@/types/enums';
import { getBookingByOrderId, insertBooking, isCoachSlotPaidBooked, toIsoDateOrNull } from '@/lib/db/bookings';
import { ensurePendingPaymentStatus } from '@/lib/db/payments';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { orderId, bookingData, provider = 'stripe' } = body;

    if (!orderId) {
      return NextResponse.json({
        error: 'Order ID is required'
      }, { status: 400 });
    }

    const paymentStatusId = await ensurePendingPaymentStatus(orderId, provider, {
      checkout_id: orderId,
      event_type: 'checkout.initiated',
      customer_email: bookingData?.userEmail || null,
      product_id: bookingData?.productId || null,
      updated_at: new Date().toISOString()
    });

    if (bookingData) {
      const existingBooking = await getBookingByOrderId(orderId);

      if (!existingBooking) {
        let timezoneFromCookie: string | undefined;
        try {
          const userDataCookie = req.cookies.get('user_data')?.value;
          if (userDataCookie) {
            const parsedData = JSON.parse(userDataCookie);
            timezoneFromCookie = parsedData?.timezone;
          }
        } catch {
          timezoneFromCookie = undefined;
        }

        const serverDefaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const userTimezone = timezoneFromCookie || bookingData.selectedTimezone || bookingData.userTimezone || serverDefaultTimezone;

        const bookingDateValue = toIsoDateOrNull(bookingData.selectedDate ?? bookingData.bookingDate);

        if (!bookingDateValue) {
          return NextResponse.json({
            error: 'No booking date provided in request'
          }, { status: 400 });
        }

        const coach = bookingData.bookingPlan?.coach;

        if (!coach) {
          return NextResponse.json({
            error: 'Missing coach information in request'
          }, { status: 400 });
        }

        const slotTaken = await isCoachSlotPaidBooked(coach, bookingDateValue);
        if (slotTaken) {
          return NextResponse.json({
            error: 'This time slot is no longer available'
          }, { status: 409 });
        }

        try {
          const newBooking = await insertBooking({
            user_email: bookingData.userEmail,
            booking_date: bookingDateValue,
            user_timezone: userTimezone,
            frequency: BookingFrequency.Once,
            checkout_order_id: orderId,
            duration: 60,
            coach
          });

          return NextResponse.json({
            success: true,
            orderId,
            paymentStatusId,
            bookingId: newBooking.id
          });
        } catch (error) {
          if (!String(error).includes('UNIQUE constraint failed')) {
            throw error;
          }

          const concurrentBooking = await getBookingByOrderId(orderId);
          if (!concurrentBooking) throw error;

          return NextResponse.json({
            success: true,
            orderId,
            paymentStatusId,
            bookingId: concurrentBooking.id,
            message: 'Used existing booking record'
          });
        }
      }

      return NextResponse.json({
        success: true,
        orderId,
        paymentStatusId,
        bookingId: existingBooking.id,
        message: 'Used existing booking record'
      });
    }

    return NextResponse.json({
      success: true,
      orderId,
      paymentStatusId
    });
  } catch (error) {
    console.error('API: /booking/create: Unexpected error:', error);

    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
