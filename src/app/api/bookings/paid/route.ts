import { NextRequest, NextResponse } from 'next/server';
import { getBookingsBetween, getPaidOrderIds } from '@/lib/db/bookings';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const coach = searchParams.get('coach');

    if (!start || !end) {
      return NextResponse.json(
        { error: 'start and end query params are required' },
        { status: 400 }
      );
    }

    const bookings = await getBookingsBetween(start, end);
    const scopedBookings = coach ? bookings.filter(booking => booking.coach === coach) : bookings;
    const orderIds = scopedBookings
      .map(booking => booking.checkout_order_id)
      .filter((orderId): orderId is string => Boolean(orderId));

    const paidOrderIds = await getPaidOrderIds(orderIds);

    const paidBookings = scopedBookings.filter(booking =>
      booking.checkout_order_id && paidOrderIds.has(booking.checkout_order_id)
    );

    return NextResponse.json(paidBookings);
  } catch (error) {
    console.error('[GET /api/bookings/paid] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
