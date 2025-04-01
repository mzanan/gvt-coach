import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BookingFrequency, PaymentOrderStatus } from '@/app/types/enums/booking';

export async function POST(req: NextRequest): Promise<NextResponse> {
  console.log('API: /booking/create: Processing request');
  
  try {
    // Log raw request body for debugging
    const rawBody = await req.text();
    console.log('API: /booking/create: Raw request body:', rawBody);
    
    // Parse the request body
    const body = JSON.parse(rawBody);
    console.log('API: /booking/create: Parsed request body:', body);
    
    const { orderId, bookingData, provider = 'lemonsqueezy' } = body;
    
    if (!orderId) {
      console.warn('API: /booking/create: Missing order ID in request');
      return NextResponse.json({ 
        error: 'Order ID is required' 
      }, { status: 400 });
    }
    
    console.log(`API: /booking/create: Creating booking with order ID: ${orderId}, provider: ${provider}`);
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('API: /booking/create: Missing Supabase credentials');
      return NextResponse.json({ 
        error: 'Server configuration error' 
      }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // First, check if this orderId already has a payment_status record through mapping table
    // or in json_data, since 'checkout_order_id' column doesn't exist in payments_status
    let paymentStatusId = null;
    
    // Opción 1: Buscar primero en la tabla de mapeo
    const { data: existingMapping, error: mappingError } = await supabase
      .from('gvt_coach_checkout_mapping')
      .select('payment_status_id')
      .eq('checkout_order_id', orderId)
      .maybeSingle();
      
    if (mappingError) {
      console.error('API: /booking/create: Error checking mapping table:', mappingError);
    } else if (existingMapping?.payment_status_id) {
      paymentStatusId = existingMapping.payment_status_id;
      console.log(`API: /booking/create: Found payment ID ${paymentStatusId} via mapping table`);
    } else {
      // Opción 2: Buscar en json_data si no se encuentra en el mapeo
      const { data: existingPaymentByJson, error: jsonSearchError } = await supabase
        .from('gvt_coach_payments_status')
        .select('id')
        .or(`json_data->>'checkout_id'.eq.'${orderId}',json_data->>'checkout_order_id'.eq.'${orderId}'`)
        .maybeSingle();
        
      if (jsonSearchError) {
        console.error('API: /booking/create: Error searching in json_data:', jsonSearchError);
      } else if (existingPaymentByJson) {
        paymentStatusId = existingPaymentByJson.id;
        console.log(`API: /booking/create: Found payment ID ${paymentStatusId} via json_data`);
      }
    }
    
    // If no payment status record exists, create one
    if (!paymentStatusId) {
      console.log('API: /booking/create: Creating new payment status record for order:', orderId);
      
      const paymentStatusData = {
        status: PaymentOrderStatus.Pending,
        json_data: {
          checkout_order_id: orderId,
          checkout_id: orderId,
          status: PaymentOrderStatus.Pending,
          event_type: 'checkout.initiated',
          customer_email: bookingData?.userEmail || null,
          product_id: bookingData?.productId || null,
          updated_at: new Date().toISOString()
        }
      };
      
      const { data: newPaymentStatus, error: createStatusError } = await supabase
        .from('gvt_coach_payments_status')
        .insert(paymentStatusData)
        .select('id')
        .single();
        
      if (createStatusError) {
        console.error('API: /booking/create: Error creating payment status:', createStatusError);
        return NextResponse.json({ 
          error: 'Failed to create payment status', 
          details: createStatusError.message 
        }, { status: 500 });
      }
      
      paymentStatusId = newPaymentStatus.id;
      console.log('API: /booking/create: Created payment status record with ID:', paymentStatusId);
    } else {
      console.log('API: /booking/create: Found existing payment status record with ID:', paymentStatusId);
    }
    
    // Next, check if we already have a mapping for this order
    const { data: mappingCheck, error: mappingCheckError } = await supabase
      .from('gvt_coach_checkout_mapping')
      .select('id, checkout_order_id')
      .or(`checkout_order_id.eq.'${orderId}',payment_order_id.eq.'${orderId}'`)
      .maybeSingle();
      
    if (mappingCheckError) {
      console.error('API: /booking/create: Error checking for existing mapping:', mappingCheckError);
      return NextResponse.json({ 
        error: 'Database error', 
        details: mappingCheckError.message 
      }, { status: 500 });
    }
    
    // If no mapping exists, create one
    if (!mappingCheck) {
      console.log('API: /booking/create: Creating new checkout mapping for order:', orderId);
      
      // Create checkout mapping
      console.log(`API: /booking/create: Creating new checkout mapping for order: ${orderId}`);

      const mappingData: Record<string, string | number | null> = {
        checkout_order_id: orderId,
        payment_status_id: paymentStatusId,
        provider: provider,
        payment_order_id: orderId
      };

      console.log(`API: /booking/create: Using same orderId for both checkout_order_id and payment_order_id`);

      try {
        const { data: mappingResult, error: mappingError } = await supabase
          .from('gvt_coach_checkout_mapping')
          .insert(mappingData)
          .select('id')
          .single();
          
        if (mappingError) {
          console.error('API: /booking/create: Error creating checkout mapping:', mappingError);
          
          // Si hay un error de clave duplicada, verificamos si ya existe un mapping para este checkout_order_id
          if (mappingError.code === '23505') {
            console.log(`API: /booking/create: Posible mapping duplicado, verificando si ya existe`);
            
            const { data: existingMapping } = await supabase
              .from('gvt_coach_checkout_mapping')
              .select('*')
              .eq('checkout_order_id', orderId)
              .maybeSingle();
            
            if (existingMapping) {
              console.log(`API: /booking/create: Ya existe un mapping para este checkout_order_id, continuando`);
            } else {
              // Si no existe, es un problema con payment_order_id duplicado
              return NextResponse.json({ 
                error: 'Failed to create checkout mapping due to constraint violation', 
                details: mappingError.message 
              }, { status: 500 });
            }
          } else {
            // Cualquier otro error
            return NextResponse.json({ 
              error: 'Failed to create checkout mapping', 
              details: mappingError.message 
            }, { status: 500 });
          }
        } else {
          console.log(`API: /booking/create: Created checkout mapping successfully with ID: ${mappingResult.id}`);
        }
      } catch (error) {
        console.error('API: /booking/create: Unexpected error creating checkout mapping:', error);
        return NextResponse.json({ 
          error: 'Unexpected error creating checkout mapping' 
        }, { status: 500 });
      }
    } else {
      console.log('API: /booking/create: Found existing checkout mapping with ID:', mappingCheck.id);
    }
    
    // If booking data is provided, create a booking record
    if (bookingData) {
      console.log('API: /booking/create: Creating booking record');
      
      // Check if a booking already exists with this checkout order ID
      const { data: existingBooking, error: existingBookingError } = await supabase
        .from('gvt_coach_meetings_bookings')
        .select('id')
        .eq('checkout_order_id', orderId)
        .maybeSingle();
        
      if (existingBookingError) {
        console.error('API: /booking/create: Error checking for existing booking:', existingBookingError);
        return NextResponse.json({ 
          error: 'Database error', 
          details: existingBookingError.message 
        }, { status: 500 });
      }
      
      // Only create a new booking if one doesn't already exist
      if (!existingBooking) {
        console.log('API: /booking/create: Creating new booking, full bookingData received:', bookingData);

        // --- TIMEZONE DETERMINATION: Read from user_data cookie --- 
        let timezoneFromCookie: string | undefined;
        try {
          const userDataCookie = req.cookies.get('user_data')?.value;
          if (userDataCookie) {
            const parsedData = JSON.parse(userDataCookie);
            timezoneFromCookie = parsedData?.timezone;
          }
        } catch (cookieError) {
          console.error("🍪 [API /booking/create] Error accessing or parsing user_data cookie:", cookieError);
          timezoneFromCookie = undefined;
        }
        
        // Prioritize cookie timezone, fallback to frontend data (as last resort), then server default
        const serverDefaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const userTimezone = timezoneFromCookie || bookingData.selectedTimezone || bookingData.userTimezone || serverDefaultTimezone;
        console.log("API: /booking/create: Using user timezone:", userTimezone, `(Source: ${timezoneFromCookie ? 'Cookie' : (bookingData.selectedTimezone || bookingData.userTimezone ? 'Frontend' : 'Server Default')})`);
        // --- END TIMEZONE DETERMINATION ---
        
        // Extraer fecha en un solo paso con fallbacks claros
        let bookingDateValue = null;
        
        if (bookingData.selectedDate) {
          bookingDateValue = typeof bookingData.selectedDate === 'string' 
            ? bookingData.selectedDate 
            : new Date(bookingData.selectedDate).toISOString();
          console.log("API: /booking/create: Using selectedDate from request:", bookingDateValue);
        } else if (bookingData.bookingDate) {
          bookingDateValue = typeof bookingData.bookingDate === 'string' 
            ? bookingData.bookingDate 
            : new Date(bookingData.bookingDate).toISOString();
          console.log("API: /booking/create: Using bookingDate from request:", bookingDateValue);
        }

        // Si no hay fecha disponible, devolvemos error en lugar de usar una por defecto
        if (!bookingDateValue) {
          console.error("API: /booking/create: No booking date provided in request");
          return NextResponse.json({ 
            error: 'No booking date provided in request' 
          }, { status: 400 });
        }

        // Ensure we have a valid user timezone
        console.log("API: /booking/create: Final booking date value:", bookingDateValue);

        // Create the booking record
        const { data: newBooking, error: createError } = await supabase
          .from('gvt_coach_meetings_bookings')
          .insert([{
            user_email: bookingData.userEmail,
            booking_date: bookingDateValue,
            frequency: bookingData.bookingPlan?.frequency || BookingFrequency.Once,
            coach: bookingData.bookingPlan?.coach,
            payment_status: PaymentOrderStatus.Pending,
            checkout_completed: false,
            payment_confirmed: false,
            user_timezone: userTimezone,
            checkout_order_id: orderId
          }])
          .select()
          .single();
          
        if (createError) {
          console.error('API: /booking/create: Error creating booking record:', createError);
          return NextResponse.json({ 
            error: 'Failed to create booking record', 
            details: createError.message 
          }, { status: 500 });
        }
        
        console.log('API: /booking/create: Created booking record with ID:', newBooking.id);
        
        // NOTA: La creación de Zoom meetings se ha movido a los webhooks (polar/route.ts, lemonsqueezy/route.ts)
        // para asegurar que solo se creen cuando el pago esté CONFIRMADO
        // Esto evita crear reuniones para pagos que nunca se completan
        
        return NextResponse.json({
          success: true,
          orderId: orderId,
          paymentStatusId: paymentStatusId,
          bookingId: newBooking.id
        });
      } else {
        console.log('API: /booking/create: Found existing booking with ID:', existingBooking.id);
        
        return NextResponse.json({
          success: true,
          orderId: orderId,
          paymentStatusId: paymentStatusId,
          bookingId: existingBooking.id,
          message: 'Used existing booking record'
        });
      }
    }
    
    // Return success response if no booking data was provided
    return NextResponse.json({
      success: true,
      orderId: orderId,
      paymentStatusId: paymentStatusId
    });
    
  } catch (error) {
    console.error('API: /booking/create: Unexpected error:', error);
    
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 