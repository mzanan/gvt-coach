import { NextRequest, NextResponse } from 'next/server';
import { BookingFrequency, PaymentOrderStatus } from '@/types/enums';
import { getBookingByOrderId, insertBooking } from '@/lib/db/bookings';
import {
  findPaymentStatusByJsonOrderId,
  getMappingByAnyOrderId,
  getMappingByOrderId,
  insertPaymentStatus,
  upsertMapping
} from '@/lib/db/payments';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { orderId, bookingData, provider = 'lemonsqueezy' } = body;

    if (!orderId) {
      return NextResponse.json({
        error: 'Order ID is required'
      }, { status: 400 });
    }

    let paymentStatusId: string | null = null;

    const existingMapping = await getMappingByOrderId(orderId);

    if (existingMapping?.payment_status_id) {
      paymentStatusId = existingMapping.payment_status_id;
    } else {
      const existingPaymentByJson = await findPaymentStatusByJsonOrderId(orderId);
      if (existingPaymentByJson) {
        paymentStatusId = existingPaymentByJson.id;
      }
    }

    if (!paymentStatusId) {
      const newPaymentStatus = await insertPaymentStatus({
        status: PaymentOrderStatus.Pending,
        json_data: {
          checkout_order_id: orderId,
          checkout_id: orderId,
          status: PaymentOrderStatus.Pending,
          event_type: 'checkout.initiated',
          customer_email: bookingData?.userEmail || null,
          product_id: bookingData?.productId || null,
          updated_at: new Date().toISOString()
        }
      });
      paymentStatusId = newPaymentStatus.id;
    }

    const mappingCheck = await getMappingByAnyOrderId(orderId);

    if (!mappingCheck) {
      await upsertMapping({
        checkout_order_id: orderId,
        payment_status_id: paymentStatusId,
        provider,
        payment_order_id: orderId
      });
    }

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

        let bookingDateValue: string | null = null;

        if (bookingData.selectedDate) {
          bookingDateValue = typeof bookingData.selectedDate === 'string'
            ? bookingData.selectedDate
            : new Date(bookingData.selectedDate).toISOString();
        } else if (bookingData.bookingDate) {
          bookingDateValue = typeof bookingData.bookingDate === 'string'
            ? bookingData.bookingDate
            : new Date(bookingData.bookingDate).toISOString();
        }

        if (!bookingDateValue) {
          return NextResponse.json({
            error: 'No booking date provided in request'
          }, { status: 400 });
        }

        const newBooking = await insertBooking({
          user_email: bookingData.userEmail,
          booking_date: bookingDateValue,
          user_timezone: userTimezone,
          frequency: BookingFrequency.Once,
          checkout_order_id: orderId,
          duration: 60,
          coach: bookingData.bookingPlan?.coach || 'MATIAS'
        });

        return NextResponse.json({
          success: true,
          orderId,
          paymentStatusId,
          bookingId: newBooking.id
        });
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
