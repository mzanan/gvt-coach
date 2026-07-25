import { NextRequest, NextResponse } from 'next/server';
import { getMappingByAnyOrderId, getMostRecentMapping } from '@/lib/db/payments';

type RouteParams = {
  params: Promise<{ orderId: string }>
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { orderId } = await params;

    const mapping = await getMappingByAnyOrderId(orderId) || await getMostRecentMapping();

    if (!mapping) {
      return NextResponse.json(
        { error: 'No payment mapping found' },
        { status: 404 }
      );
    }

    return NextResponse.json(mapping);
  } catch (error) {
    console.error('[GET /api/payments/mapping] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
