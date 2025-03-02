import { createClient } from '@/lib/supabase/server';
import { NextResponse, NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }

) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    console.log('[GET] Looking for booking with ID:', id);

    const { data: booking, error: bookingError } = await supabase
      .from('meetings_bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (bookingError) {
      console.error('[GET] Error finding booking:', bookingError);
      return NextResponse.json(
        { error: bookingError.message },
        { status: 400 }
      );
    }

    console.log('[GET] Found booking:', booking);
    return NextResponse.json(booking);
  } catch (error) {
    console.error('[GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }

) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const updates = await request.json();
    
    console.log('[PATCH] Updating booking:', { id, updates });

    // First, check if the booking exists
    const { data: existingBooking, error: findError } = await supabase
      .from('meetings_bookings')
      .select('id, order_id, user_email')
      .eq('id', id)
      .single();

    if (findError) {
      console.error('[PATCH] Booking not found with ID:', id);
      console.error('[PATCH] Error details:', findError);

      // Let's get all bookings for debugging
      const { data: allBookings } = await supabase
        .from('meetings_bookings')
        .select('id, order_id, user_email')
        .limit(5);
      
      console.log('[PATCH] First 5 bookings in database:', allBookings);
      
      return NextResponse.json(
        { error: `Booking not found with ID: ${id}. Error: ${findError.message}` },
        { status: 404 }
      );
    }

    console.log('[PATCH] Found existing booking:', existingBooking);

    const { data, error } = await supabase
      .from('meetings_bookings')
      .update({
        meet_link: updates.meet_link
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[PATCH] Error updating booking:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.log('[PATCH] Booking updated successfully:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[PATCH] Error in PATCH:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}