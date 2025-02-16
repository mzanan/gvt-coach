import { supabase } from '@/lib/supabase/client';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Get booking from database
    const { data: booking, error } = await supabase
      .from('meetings_bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }), 
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        }
      );
    }

    // If frequency is twice-weekly, get the second booking
    if (booking.frequency === 'twice-weekly') {
      const { data: secondBooking } = await supabase
        .from('meetings_bookings')
        .select('*')
        .eq('user_email', booking.user_email)
        .eq('frequency', 'twice-weekly')
        .gt('booking_date', booking.booking_date)
        .limit(1)
        .single();

      if (secondBooking) {
        booking.second_booking_date = secondBooking.booking_date;
      }
    }

    return new Response(
      JSON.stringify(booking),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      }
    );

  } catch (error) {
    console.error('Error fetching booking:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }), 
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      }
    );
  }
}

// Handle OPTIONS request for CORS
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