import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PaymentOrderStatus } from '@/types/enums/booking';

// Type for route parameters in Next.js
type RouteParams = {
  params: Promise<{ orderId: string }>
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { orderId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const provider = searchParams.get('provider') || 'lemonsqueezy'; // Default to lemonsqueezy if not specified
    
    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Handle Polar orders directly if specified
    if (provider === 'polar') {
      console.log(`Checking Polar order status for ${orderId}`);
      
      try {
        // First try to get order from our database
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
          console.error('Missing Supabase credentials');
          return NextResponse.json(
            { error: 'Server configuration error' },
            { status: 500 }
          );
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // IMPROVED: Look for mapping with either checkout_order_id or payment_order_id
        const { data: mapping, error: mappingError } = await supabase
          .from('gvt_coach_checkout_mapping')
          .select('payment_status_id, provider, checkout_order_id')
          .or(`checkout_order_id.eq.'${orderId}',payment_order_id.eq.'${orderId}'`)
          .maybeSingle();

        console.log("Mapping lookup result:", { orderId, found: !!mapping, mapping });

        if (!mappingError && mapping && mapping.payment_status_id) {
          // We found the mapping, so get the payment status
          const { data: paymentStatus, error: paymentStatusError } = await supabase
            .from('gvt_coach_payments_status')
            .select('status, created_at, updated_at, json_data')
            .eq('id', mapping.payment_status_id)
            .maybeSingle();

          if (!paymentStatusError && paymentStatus) {
            console.log("Found payment status:", paymentStatus);
            // We found the payment status, so return it
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

        // NEW: If we didn't find mapping, check directly in bookings table
        console.log("No mapping found, checking directly in bookings table");
        const { data: bookings, error: bookingsError } = await supabase
          .from('gvt_coach_meetings_bookings')
          .select('id, payment_status, checkout_completed, payment_confirmed')
          .eq('checkout_order_id', orderId)
          .limit(1);

        if (!bookingsError && bookings && bookings.length > 0) {
          const booking = bookings[0];
          console.log("Found booking directly:", booking);
          
          // If booking shows payment is confirmed, treat as PAID
          if (booking.payment_confirmed === true || 
              booking.checkout_completed === true || 
              booking.payment_status === PaymentOrderStatus.Paid) {
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
        }

        // If we get here, we didn't find the order in our database
        // or it wasn't marked as paid yet
        console.log("No PAID status found for order:", orderId);
        
        // Return basic pending status if we can't get data from Polar API
        return NextResponse.json({
          orderId,
          provider: 'polar',
          status: PaymentOrderStatus.Pending,
          created: null,
          updated: null,
          paymentDetails: null,
          source: 'fallback'
        });
        
      } catch (polarError) {
        console.error("Error checking Polar API:", polarError);
        return NextResponse.json(
          { error: 'Failed to check Polar API', details: String(polarError) },
          { status: 500 }
        );
      }
    }

    // For non-Polar providers, use the existing code
    // Get Supabase credentials
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find checkout mapping
    const { data: mapping, error: mappingError } = await supabase
      .from('gvt_coach_checkout_mapping')
      .select('payment_status_id, provider')
      .eq('checkout_order_id', orderId)
      .maybeSingle();

    if (mappingError) {
      console.error('Error fetching checkout mapping:', mappingError);
      return NextResponse.json(
        { error: 'Failed to fetch order details', details: mappingError },
        { status: 500 }
      );
    }

    if (!mapping) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Find payment status details
    const { data: paymentStatus, error: paymentStatusError } = await supabase
      .from('gvt_coach_payments_status')
      .select('status, created_at, updated_at, json_data')
      .eq('id', mapping.payment_status_id)
      .maybeSingle();

    if (paymentStatusError) {
      console.error('Error fetching payment status:', paymentStatusError);
      return NextResponse.json(
        { error: 'Failed to fetch payment status', details: paymentStatusError },
        { status: 500 }
      );
    }

    // Find associated booking details
    const { data: booking, error: bookingError } = await supabase
      .from('gvt_coach_meetings_bookings')
      .select('*')
      .eq('checkout_order_id', orderId)
      .maybeSingle();

    if (bookingError) {
      console.error('Error fetching booking details:', bookingError);
      // No error is returned as the booking might not exist yet
    }

    // Build response
    return NextResponse.json({
      orderId,
      provider: mapping.provider,
      status: paymentStatus?.status || 'UNKNOWN',
      created: paymentStatus?.created_at,
      updated: paymentStatus?.updated_at,
      paymentDetails: paymentStatus?.json_data || null,
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