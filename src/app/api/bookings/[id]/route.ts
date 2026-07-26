import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/adminAuth';
import { getBookingById, updateBooking, type BookingWrite } from '@/lib/db/bookings';

const PATCHABLE_FIELDS = [
  'meet_link', 'payment_status', 'checkout_completed', 'payment_confirmed',
  'confirmation_email_sent', 'user_timezone'
] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const booking = await getBookingById(id);

    if (!booking) {
      return NextResponse.json(
        { error: `Booking not found with ID: ${id}` },
        { status: 404 }
      );
    }

    return NextResponse.json(booking);
  } catch (error) {
    console.error('[GET /api/bookings/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export const PATCH = withAdmin(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const updates = await request.json();

  const existingBooking = await getBookingById(id);

  if (!existingBooking) {
    return NextResponse.json(
      { error: `Booking not found with ID: ${id}` },
      { status: 404 }
    );
  }

  const fields: BookingWrite = {};
  for (const field of PATCHABLE_FIELDS) {
    if (updates[field] !== undefined) {
      fields[field] = updates[field];
    }
  }

  const updated = await updateBooking(id, fields);

  return NextResponse.json(updated);
});
