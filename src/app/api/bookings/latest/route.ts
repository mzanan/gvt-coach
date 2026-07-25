import { NextRequest, NextResponse } from 'next/server';
import { getLatestBookingByEmail } from '@/lib/db/bookings';

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'email query param is required' },
        { status: 400 }
      );
    }

    const booking = await getLatestBookingByEmail(email);

    if (!booking) {
      return NextResponse.json(
        { error: 'No booking found for this email' },
        { status: 404 }
      );
    }

    return NextResponse.json(booking);
  } catch (error) {
    console.error('[GET /api/bookings/latest] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
