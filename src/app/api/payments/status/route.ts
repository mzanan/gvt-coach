import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, bookingData } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId is required' },
        { status: 400 }
      );
    }

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

    // 1. Create payment status record
    const { data: paymentData, error: paymentError } = await supabase
      .from('gvt_coach_payments_status')
      .insert({
        status: 'PENDING',
        json_data: bookingData || null
      })
      .select('id')
      .single();

    if (paymentError) {
      console.error('Error creating payment status record:', paymentError);
      return NextResponse.json(
        { error: 'Failed to create payment status record', details: paymentError },
        { status: 500 }
      );
    }

    // 2. Create mapping record
    const { error: mappingError } = await supabase
      .from('gvt_coach_checkout_mapping')
      .upsert({
        checkout_order_id: orderId,
        payment_order_id: null,
        payment_identifier_id: null,
        payment_status_id: paymentData.id
      }, {
        onConflict: 'checkout_order_id'
      });

    if (mappingError) {
      console.error('Error creating checkout mapping:', mappingError);
      return NextResponse.json(
        { error: 'Failed to create checkout mapping', details: mappingError },
        { status: 500 }
      );
    }

    // 3. Create booking record if we have booking data
    if (bookingData && bookingData.userEmail && bookingData.selectedDate) {
      try {
        const bookingDate = new Date(bookingData.selectedDate);
        const bookingFrequency = bookingData.bookingPlan?.frequency || 'once';
        const bookingDuration = bookingData.bookingPlan?.duration || 1;
        const userTimezone = bookingData.selectedTimezone || 'UTC';
        
        // Create booking record
        const { error: bookingError } = await supabase
          .from('gvt_coach_meetings_bookings')
          .insert({
            checkout_order_id: orderId,
            user_email: bookingData.userEmail,
            payment_status: 'PENDING',
            checkout_completed: false,
            payment_confirmed: false,
            booking_date: bookingDate.toISOString(),
            frequency: bookingFrequency,
            duration: bookingDuration, // Just use the months directly, not converted to minutes
            recurring_time: new Date(bookingDate).toISOString().substring(11, 16), // Extract HH:MM
            updated_at: new Date().toISOString(),
            user_timezone: userTimezone
          });

        if (bookingError) {
          console.error('Error creating booking record:', bookingError);
          // Don't fail the whole operation if booking creation fails
        } else {
          console.log(`✅ Successfully created booking record for order: ${orderId}`);
        }
      } catch (bookingError) {
        console.error('Error in booking creation:', bookingError);
        // Continue even if booking creation fails
      }
    }

    console.log(`✅ Successfully created payment records for order: ${orderId}`);
    
    return NextResponse.json({
      success: true,
      message: 'Payment status created successfully',
      orderId
    });
    
  } catch (error) {
    console.error('Unexpected error in payment status API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 