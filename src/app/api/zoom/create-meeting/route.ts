import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { DateTime } from 'luxon';

// Función para obtener el token de Zoom
async function getZoomToken() {
  const accountId = process.env.GVT_COACH_ZOOM_ACCOUNT_ID;
  const clientId = process.env.GVT_COACH_ZOOM_CLIENT_ID;
  const clientSecret = process.env.GVT_COACH_ZOOM_CLIENT_SECRET;
  
  if (!accountId || !clientId || !clientSecret) {
    throw new Error('Missing Zoom credentials');
  }
  
  console.log('Obtaining Zoom token with Account ID:', accountId.substring(0, 5) + '...');
  
  const tokenResponse = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      'grant_type': 'account_credentials',
      'account_id': accountId,
    }),
  });
  
  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Error getting Zoom token:', errorText);
    throw new Error(`Failed to get Zoom token: ${tokenResponse.status}`);
  }
  
  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// Endpoint para generar reunión para una reserva específica
export async function POST(request: NextRequest) {
  try {
    const { bookingId } = await request.json();
    
    if (!bookingId) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }
    
    console.log('Creating Zoom meeting for booking ID:', bookingId);
    
    // Obtener la reserva de la base de datos
    const supabase = await createClient();
    const { data: booking, error: bookingError } = await supabase
      .from('gvt_coach_meetings_bookings')
      .select('*')
      .eq('id', bookingId)
      .single();
    
    if (bookingError || !booking) {
      console.error('Error fetching booking:', bookingError);
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    
    // Verificar si ya tiene un enlace de reunión
    if (booking.meet_link) {
      console.log('Booking already has a meet link:', booking.meet_link);
      return NextResponse.json({ meet_link: booking.meet_link });
    }
    
    // Verificar que tenga fecha de reserva
    if (!booking.booking_date) {
      console.error('Booking has no date');
      return NextResponse.json({ error: 'Booking has no date' }, { status: 400 });
    }
    
    // Obtener el token de Zoom
    const accessToken = await getZoomToken();
    
    // Crear la reunión en Zoom
    const meetingTime = DateTime.fromISO(booking.booking_date).toJSDate();
    const durationMinutes = booking.duration ? booking.duration * 60 : 60;
    
    const meetingData = {
      topic: `GVT Coaching Session with ${booking.user_email}`,
      type: 2, // Scheduled meeting
      start_time: meetingTime.toISOString(),
      duration: durationMinutes,
      timezone: booking.user_timezone || 'UTC',
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: true,
        waiting_room: false,
        mute_upon_entry: false,
        auto_recording: "none",
      },
    };
    
    console.log('Creating Zoom meeting with data:', JSON.stringify(meetingData));
    
    const meetingResponse = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(meetingData),
    });
    
    if (!meetingResponse.ok) {
      const errorText = await meetingResponse.text();
      console.error('Error creating Zoom meeting:', errorText);
      return NextResponse.json({ error: 'Failed to create Zoom meeting' }, { status: 500 });
    }
    
    const meetingDetails = await meetingResponse.json();
    
    if (!meetingDetails.join_url) {
      console.error('No join URL in Zoom response');
      return NextResponse.json({ error: 'No join URL in Zoom response' }, { status: 500 });
    }
    
    // Actualizar la reserva con el enlace de reunión
    const { error: updateError } = await supabase
      .from('gvt_coach_meetings_bookings')
      .update({ meet_link: meetingDetails.join_url })
      .eq('id', bookingId);
    
    if (updateError) {
      console.error('Error updating booking with meet link:', updateError);
      return NextResponse.json({ error: 'Failed to save meet link' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      meet_link: meetingDetails.join_url,
      meeting_id: meetingDetails.id
    });
  } catch (error) {
    console.error('Error creating Zoom meeting:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
} 