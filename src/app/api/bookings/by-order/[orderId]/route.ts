import { createClient } from '@/lib/supabase/server';
import { NextResponse, NextRequest } from 'next/server';

// Type for route parameters in Next.js
type RouteParams = {
  params: Promise<{ orderId: string }>
};

// Using the same format as other working route files
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const supabase = await createClient();
    const { orderId } = await params;

    console.log('[GET by-order] Looking for booking with checkout_order_id:', orderId);

    const { data: booking, error: bookingError } = await supabase
      .from('gvt_coach_meetings_bookings')
      .select('*')
      .eq('checkout_order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (bookingError) {
      console.error('[GET by-order] Error finding booking by checkout_order_id:', bookingError);
      
      // Also try to find all bookings with this checkout_order_id (not using single)
      const { data: allBookings } = await supabase
        .from('gvt_coach_meetings_bookings')
        .select('id, checkout_order_id, user_email, created_at')
        .eq('checkout_order_id', orderId)
        .order('created_at', { ascending: false });
        
      console.log('[GET by-order] All bookings with this checkout_order_id:', allBookings);
      
      return NextResponse.json(
        { error: bookingError.message },
        { status: 404 }
      );
    }

    console.log('[GET by-order] Found booking by checkout_order_id:', booking);
    return NextResponse.json(booking);
  } catch (error) {
    console.error('[GET by-order] Error:', error);
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