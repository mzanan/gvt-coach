import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const orderId = request.nextUrl.searchParams.get('order_id');

    if (!orderId) {
      return NextResponse.json({ error: 'Missing order_id parameter' }, { status: 400 });
    }

    console.log(`Fixing payment status for order_id: ${orderId}`);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Primero encontrar el mapping
    const { data: mappingData, error: mappingError } = await supabase
      .from('gvt_coach_checkout_mapping')
      .select('payment_status_id')
      .eq('checkout_order_id', orderId)
      .maybeSingle();

    if (mappingError) {
      console.error('Error fetching mapping:', mappingError);
      return NextResponse.json({ 
        error: 'Error fetching mapping', 
        details: mappingError 
      }, { status: 500 });
    }

    if (!mappingData || !mappingData.payment_status_id) {
      return NextResponse.json({ 
        error: 'No payment mapping found for this order ID' 
      }, { status: 404 });
    }

    const paymentStatusId = mappingData.payment_status_id;
    console.log(`Found payment_status_id: ${paymentStatusId}`);

    // Obtener el payment status actual
    const { data: paymentStatus, error: statusError } = await supabase
      .from('gvt_coach_payments_status')
      .select('*')
      .eq('id', paymentStatusId)
      .single();

    if (statusError) {
      console.error('Error fetching payment status:', statusError);
      return NextResponse.json({ 
        error: 'Error fetching payment status', 
        details: statusError 
      }, { status: 500 });
    }

    console.log('Current payment status:', paymentStatus);

    // Actualizar json_data.status
    let jsonData = paymentStatus.json_data || {};
    if (typeof jsonData === 'string') {
      try {
        jsonData = JSON.parse(jsonData);
      } catch (e) {
        jsonData = {};
      }
    }

    const updatedJsonData = {
      ...jsonData,
      status: 'PAID'
    };

    // Actualizar payment status a PAID
    const { data: updatedStatus, error: updateError } = await supabase
      .from('gvt_coach_payments_status')
      .update({
        status: 'PAID',
        json_data: updatedJsonData
      })
      .eq('id', paymentStatusId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating payment status:', updateError);
      return NextResponse.json({ 
        error: 'Error updating payment status', 
        details: updateError 
      }, { status: 500 });
    }

    console.log('Updated payment status:', updatedStatus);

    // Actualizar booking a CONFIRMED
    const { data: bookingUpdate, error: bookingError } = await supabase
      .from('gvt_coach_meetings_bookings')
      .update({
        payment_status: 'PAID',
        checkout_completed: true,
        payment_confirmed: true
      })
      .eq('checkout_order_id', orderId);

    if (bookingError) {
      console.warn('Error updating booking:', bookingError);
      // No fallar si hay error en la actualización del booking
    } else {
      console.log('Updated booking records');
    }

    return NextResponse.json({
      success: true,
      message: 'Payment status updated to PAID',
      data: {
        original: paymentStatus,
        updated: updatedStatus
      }
    });
  } catch (error) {
    console.error('Error fixing payment status:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error 
    }, { status: 500 });
  }
} 