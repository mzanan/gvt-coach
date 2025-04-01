import { createClient } from '@/lib/supabase/server';
import { NextResponse, NextRequest } from 'next/server';
import { PaymentOrderStatus } from '@/types/enums/booking';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      email,
      date,
      frequency,
      endDate,
      orderId,
      secondSlot,
      meetLink
    } = await request.json();

    console.log('[POST /api/bookings] Creating booking with data:', {
      email,
      date,
      frequency,
      orderId
    });

    // Validate required fields
    if (!email || !date || !frequency || !orderId) {
      console.error('[POST /api/bookings] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: email, date, frequency, orderId are required' },
        { status: 400 }
      );
    }

    // Convert date strings to Date objects if needed
    const bookingDate = typeof date === 'string' ? new Date(date) : date;
    const endBookingDate = endDate ? (typeof endDate === 'string' ? new Date(endDate) : endDate) : null;
    const secondSlotDate = secondSlot ? (typeof secondSlot === 'string' ? new Date(secondSlot) : secondSlot) : null;

    // STEP 1: First, check if a payment status record already exists
    const { data: existingPaymentStatus } = await supabase
      .from('gvt_coach_payments_status')
      .select('*')
      .eq('checkout_order_id', orderId)
      .maybeSingle();

    // STEP 2: If no payment status record exists, create one first
    if (!existingPaymentStatus) {
      console.log('[POST /api/bookings] No payment status found, creating one for order:', orderId);
      
      const { data: newPaymentStatus, error: newPaymentStatusError } = await supabase
        .from('gvt_coach_payments_status')
        .insert({
          checkout_order_id: orderId,
          status: 'PENDING', // Default to PENDING
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();
        
      if (newPaymentStatusError) {
        console.error('[POST /api/bookings] Failed to create payment status record:', newPaymentStatusError);
        return NextResponse.json(
          { error: 'Failed to create payment status record' },
          { status: 500 }
        );
      }
      
      console.log('[POST /api/bookings] Payment status record created:', newPaymentStatus);
    } else {
      console.log('[POST /api/bookings] Found existing payment status record:', existingPaymentStatus);
    }

    // STEP 3: Now check if a booking already exists for this order ID to avoid duplicates
    const { data: existingBooking } = await supabase
      .from('gvt_coach_meetings_bookings')
      .select('*')
      .eq('checkout_order_id', orderId)
      .maybeSingle();

    if (existingBooking) {
      console.log('[POST /api/bookings] Booking already exists for this order:', existingBooking);
      return NextResponse.json(existingBooking);
    }

    // STEP 4: Create the booking record
    const bookingData = {
      user_email: email,
      booking_date: bookingDate.toISOString(),
      frequency: frequency,
      end_date: endBookingDate ? endBookingDate.toISOString() : null,
      checkout_order_id: orderId,
      meet_link: meetLink,
      second_slot_date: secondSlotDate ? secondSlotDate.toISOString() : null,
      status: PaymentOrderStatus.Pending // Usando el enum de estado de pago
    };

    console.log('[POST /api/bookings] Inserting booking with data:', bookingData);

    const { data: booking, error: bookingError } = await supabase
      .from('gvt_coach_meetings_bookings')
      .insert([bookingData])
      .select();

    if (bookingError) {
      console.error('[POST /api/bookings] Error creating booking:', bookingError);
      return NextResponse.json(
        { error: bookingError.message },
        { status: 400 }
      );
    }

    console.log('[POST /api/bookings] Booking created successfully:', booking);

    // STEP 5: Make sure mapping is properly set for this order ID
    try {
      // Attempt to update the mapping table (non-critical, so errors don't stop the flow)
      await supabase
        .from('gvt_coach_checkout_mapping')
        .upsert({
          checkout_order_id: orderId,
          // We don't know the payment_order_id yet, that comes from the payment provider
        });
    } catch (mappingError) {
      console.warn('[POST /api/bookings] Non-critical mapping table error:', mappingError);
    }

    return NextResponse.json(booking);
  } catch (error) {
    console.error('[POST /api/bookings] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
} 