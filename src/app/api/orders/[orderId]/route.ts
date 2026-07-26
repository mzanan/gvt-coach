import { NextRequest, NextResponse } from 'next/server';
import { PaymentOrderStatus } from '@/types/enums';
import { getBookingByOrderId } from '@/lib/db/bookings';
import { getMappingByAnyOrderId, getMappingByOrderId, getPaymentStatusById } from '@/lib/db/payments';

type RouteParams = {
  params: Promise<{ orderId: string }>
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { orderId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const provider = searchParams.get('provider') || 'stripe';

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    if (provider === 'polar') {
      const mapping = await getMappingByAnyOrderId(orderId);

      if (mapping?.payment_status_id) {
        const paymentStatus = await getPaymentStatusById(mapping.payment_status_id);

        if (paymentStatus) {
          return NextResponse.json({
            orderId,
            provider: 'polar',
            status: paymentStatus.status,
            created: paymentStatus.created_at,
            updated: paymentStatus.updated_at,
            paymentDetails: paymentStatus.json_data || null,
            source: 'database'
          });
        }
      }

      const booking = await getBookingByOrderId(orderId);

      if (booking && (booking.payment_confirmed === true ||
          booking.checkout_completed === true ||
          booking.payment_status === PaymentOrderStatus.Paid)) {
        return NextResponse.json({
          orderId,
          provider: 'polar',
          status: PaymentOrderStatus.Paid,
          created: null,
          updated: null,
          paymentDetails: null,
          source: 'booking_table'
        });
      }

      return NextResponse.json({
        orderId,
        provider: 'polar',
        status: PaymentOrderStatus.Pending,
        created: null,
        updated: null,
        paymentDetails: null,
        source: 'fallback'
      });
    }

    const mapping = await getMappingByOrderId(orderId);

    if (!mapping) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    const paymentStatus = mapping.payment_status_id
      ? await getPaymentStatusById(mapping.payment_status_id)
      : null;

    const booking = await getBookingByOrderId(orderId);

    return NextResponse.json({
      orderId,
      provider: mapping.provider,
      status: paymentStatus?.status,
      created: paymentStatus?.created_at,
      updated: paymentStatus?.updated_at,
      paymentDetails: paymentStatus?.json_data,
      booking: booking || null,
      source: 'database'
    });
  } catch (error) {
    console.error('Unexpected error in order API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
