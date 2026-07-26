import { NextRequest, NextResponse } from 'next/server';
import { PaymentOrderStatus } from '@/types/enums';
import { fulfillPaidBookings } from '@/services/bookingFulfillment';
import { getBookingByOrderId, getBookingsByOrderId, updateBooking } from '@/lib/db/bookings';
import { getMappingByAnyOrderId, getPaymentStatusById } from '@/lib/db/payments';

const PAID_STATUSES: string[] = [PaymentOrderStatus.Paid, PaymentOrderStatus.Active, PaymentOrderStatus.Completed];

export async function POST(request: NextRequest) {
  try {
    const { checkoutOrderId } = await request.json();

    if (!checkoutOrderId) {
      return NextResponse.json({ error: 'checkoutOrderId is required' }, { status: 400 });
    }

    const mapping = await getMappingByAnyOrderId(checkoutOrderId);
    const paymentStatus = mapping?.payment_status_id
      ? await getPaymentStatusById(mapping.payment_status_id)
      : null;

    if (!paymentStatus || !PAID_STATUSES.includes(paymentStatus.status)) {
      return NextResponse.json({
        confirmed: false,
        status: paymentStatus?.status || PaymentOrderStatus.Pending,
        booking: await getBookingByOrderId(checkoutOrderId)
      });
    }

    const bookings = await getBookingsByOrderId(checkoutOrderId);
    for (const booking of bookings) {
      if (!booking.payment_confirmed) {
        await updateBooking(booking.id, {
          payment_status: PaymentOrderStatus.Paid,
          payment_confirmed: true,
          checkout_completed: true
        });
      }
    }

    const logId = Math.random().toString(36).substring(2, 8);
    await fulfillPaidBookings(checkoutOrderId, logId);

    return NextResponse.json({
      confirmed: true,
      status: PaymentOrderStatus.Paid,
      booking: await getBookingByOrderId(checkoutOrderId)
    });
  } catch (error) {
    console.error('[POST /api/bookings/confirm] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
