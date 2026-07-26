import { NextResponse, NextRequest } from 'next/server';
import { getBookingByOrderId } from '@/lib/db/bookings';

type RouteParams = {
  params: Promise<{ orderId: string }>
};

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { orderId } = await params;

    const booking = await getBookingByOrderId(orderId);

    if (!booking) {
      return NextResponse.json(
        { error: `No booking found for checkout_order_id: ${orderId}` },
        { status: 404 }
      );
    }

    return NextResponse.json(booking);
  } catch (error) {
    console.error('[GET by-order] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

