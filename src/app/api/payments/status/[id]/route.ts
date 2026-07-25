import { NextRequest, NextResponse } from 'next/server';
import { getPaymentStatusById } from '@/lib/db/payments';

type RouteParams = {
  params: Promise<{ id: string }>
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const paymentStatus = await getPaymentStatusById(id);

    if (!paymentStatus) {
      return NextResponse.json(
        { error: 'Payment status not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(paymentStatus);
  } catch (error) {
    console.error('[GET /api/payments/status] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
