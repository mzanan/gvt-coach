import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const PAYMENT_ID = 'd9995ad8-4d51-4988-9c74-b0705896823c';
    console.log('Intentando actualizar el pago:', PAYMENT_ID);
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        error: 'Missing Supabase credentials',
      }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Primero, obtener el pago actual para ver su json_data
    const { data: existingPayment, error: fetchError } = await supabase
      .from('gvt_coach_payments_status')
      .select('*')
      .eq('id', PAYMENT_ID)
      .single();
      
    if (fetchError) {
      console.error('Error al obtener el pago:', fetchError);
      return NextResponse.json({
        error: 'Error al obtener el pago',
        details: fetchError
      }, { status: 500 });
    }
    
    console.log('Pago encontrado:', existingPayment);
    
    // Preparar los datos json actualizados
    let jsonData = existingPayment.json_data || {};
    if (typeof jsonData === 'string') {
      try {
        jsonData = JSON.parse(jsonData);
      } catch (e) {
        jsonData = {};
      }
    }
    
    // Actualizar el estado en json_data
    const updatedJsonData = {
      ...jsonData,
      status: 'PAID' // Actualizar el status en json_data
    };
    
    // Actualizar el registro
    const { data: updatedPayment, error: updateError } = await supabase
      .from('gvt_coach_payments_status')
      .update({
        status: 'PAID', // Actualizar el status principal
        json_data: updatedJsonData,
        updated_at: new Date().toISOString()
      })
      .eq('id', PAYMENT_ID);
      
    if (updateError) {
      console.error('Error al actualizar el pago:', updateError);
      return NextResponse.json({
        error: 'Error al actualizar el pago',
        details: updateError
      }, { status: 500 });
    }
    
    console.log('¡Pago actualizado exitosamente!');
    
    // Buscar bookings relacionados y actualizarlos
    const { data: mappingData, error: mappingError } = await supabase
      .from('gvt_coach_checkout_mapping')
      .select('checkout_order_id')
      .eq('payment_status_id', PAYMENT_ID)
      .single();
      
    if (mappingError) {
      console.error('Error al obtener el mapping:', mappingError);
      return NextResponse.json({
        success: true,
        warning: 'Pago actualizado pero hubo un error al obtener el mapping',
        details: mappingError
      });
    }
    
    if (mappingData?.checkout_order_id) {
      console.log('Encontrado checkout_order_id:', mappingData.checkout_order_id);
      
      // Actualizar bookings relacionados
      const { data: updatedBookings, error: bookingError } = await supabase
        .from('gvt_coach_meetings_bookings')
        .update({
          payment_status: 'PAID',
          checkout_completed: true,
          payment_confirmed: true
        })
        .eq('checkout_order_id', mappingData.checkout_order_id);
        
      if (bookingError) {
        console.error('Error al actualizar bookings:', bookingError);
        return NextResponse.json({
          success: true,
          warning: 'Pago actualizado pero hubo un error al actualizar los bookings',
          details: bookingError
        });
      }
      
      console.log('Bookings actualizados');
    }
    
    return NextResponse.json({
      success: true,
      message: 'Pago actualizado correctamente'
    });
  } catch (error) {
    console.error('Error general:', error);
    return NextResponse.json({
      error: 'Error general',
      details: error
    }, { status: 500 });
  }
} 