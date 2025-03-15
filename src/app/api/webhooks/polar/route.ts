import { createClient } from '@supabase/supabase-js'
import { bookingService } from '@/services/bookingService'
import { BookingStatus, PaymentOrderStatus } from '@/app/types/enums/booking'

export async function POST(request: Request) {
  try {
    // Clonar el request para poder leer el body múltiples veces
    const clonedRequest = request.clone();
    const body = await clonedRequest.json();

    // Responder inmediatamente para evitar timeouts
    const response = new Response(JSON.stringify({ message: 'Webhook received' }), {
      status: 202,
    });

    // Procesar el evento de forma asíncrona
    processWebhookEvent(body).catch(error => {
      console.error('[ERROR] Polar webhook processing failed:', error);
    });

    return response;
  } catch (error) {
    console.error('[ERROR] Polar webhook failed:', error);
    return new Response(JSON.stringify({ error: 'Error processing webhook' }), {
      status: 500,
    });
  }
}

async function processWebhookEvent(body: any) {
  try {
    // Añadir timestamp y uid a los logs para rastreo
    const logId = Math.random().toString(36).substring(2, 8);
    console.log(`[${logId}] Polar Webhook - Received payload:`, JSON.stringify(body, null, 2));

    // Extraer el tipo de evento
    const eventType = body.type || '';
    console.log(`[${logId}] Polar Webhook - Event type: ${eventType}`);

    // Filtrar solo eventos relevantes
    const RELEVANT_EVENTS = ['checkout.created', 'order.created', 'order.completed'];
    if (!RELEVANT_EVENTS.includes(eventType)) {
      console.log(`[${logId}] Polar Webhook - Ignoring non-essential event: ${eventType}`);
      return;
    }

    // Acceder al objeto data donde está la información principal
    const data = body.data || body;

    // Extraer identificadores relevantes
    let productId = '';
    let checkoutId = '';
    let orderId = '';
    let metadataCheckoutOrderId = '';
    let userEmail = '';
    let metadataProductId = '';
    let paymentStatus = PaymentOrderStatus.Pending;

    if (eventType === 'checkout.created') {
      productId = data.product_id || '';
      checkoutId = data.id || '';
      metadataCheckoutOrderId = data.metadata?.checkoutOrderId || '';
      userEmail = data.customer_email || data.email || '';
      metadataProductId = data.product_id || '';
      // Para checkout.created, verificar si el estado es 'open'
      if (data.status === 'open') {
        paymentStatus = PaymentOrderStatus.Pending;
      }
      console.log(`[${logId}] Polar Webhook - Processing checkout.created with ID: ${checkoutId}, status: ${data.status || 'unknown'}`);
    } else if (eventType === 'order.created' || eventType === 'order.completed') {
      productId = data.product_id || '';
      orderId = data.id || '';
      checkoutId = data.checkout_id || '';
      metadataCheckoutOrderId = data.metadata?.checkoutOrderId || '';
      userEmail = data.customer?.email || data.email || '';
      metadataProductId = data.product_id || '';
      // Para order.created, siempre configurar como PAID
      if (eventType === 'order.created') {
        console.log(`Setting status to ${PaymentOrderStatus.Paid} for event ${eventType}`);
        paymentStatus = PaymentOrderStatus.Paid;
      }
      console.log(`[${logId}] Polar Webhook - Processing ${eventType} with order ID: ${orderId}, checkout ID: ${checkoutId}, status: ${data.status || 'unknown'}`);
    }

    // Usar ID consistente
    const checkoutOrderId = checkoutId || orderId || metadataCheckoutOrderId || productId;
    if (!checkoutOrderId) {
      console.error(`[${logId}] Polar Webhook - No valid ID found`);
      return;
    }
    
    // Log all extracted IDs for debugging
    console.log(`[${logId}] Polar Webhook - Using checkout order ID: ${checkoutOrderId}`);
    console.log(`[${logId}] Polar Webhook - IDs extracted: checkoutId=${checkoutId}, orderId=${orderId}, metadataCheckoutOrderId=${metadataCheckoutOrderId}, productId=${productId}`);

    // Iniciar Supabase Client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Primero buscar en la tabla de mapping para encontrar el payment_status_id
    console.log(`[${logId}] Polar Webhook - Buscando mapping para checkout_order_id: ${checkoutOrderId}`);
    const { data: mappingData, error: mappingError } = await supabase
      .from('gvt_coach_checkout_mapping')
      .select('payment_status_id')
      .eq('checkout_order_id', checkoutOrderId)
      .maybeSingle();

    if (mappingError) {
      console.error(`[${logId}] Polar Webhook - Error al buscar mapping:`, mappingError);
      return new Response(JSON.stringify({ error: 'Error buscando mapping record' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let existingPayment = null;
    let paymentId = null;

    // Si encontramos un mapping, buscar el payment_status por su ID
    if (mappingData && mappingData.payment_status_id) {
      console.log(`[${logId}] Polar Webhook - Encontrado mapping con payment_status_id: ${mappingData.payment_status_id}`);
      
      const { data: paymentData, error: fetchError } = await supabase
        .from('gvt_coach_payments_status')
        .select('*')
        .eq('id', mappingData.payment_status_id)
        .single();

      if (fetchError) {
        console.error(`[${logId}] Polar Webhook - Error al obtener payment_status por ID:`, fetchError);
        return new Response(JSON.stringify({ error: 'Error fetching payment record' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      existingPayment = paymentData;
      paymentId = mappingData.payment_status_id;
      console.log(`[${logId}] Polar Webhook - Encontrado payment record:`, existingPayment);
    }

    // Si no hay mapping o no se encontró el payment, crear uno nuevo si corresponde
    if (!existingPayment) {
      if (eventType === 'checkout.created') {
        // Crear nuevo registro SOLO para checkout.created
        console.log(`[${logId}] Polar Webhook - Creating new PENDING payment record for checkout.created`);
        
        const { data: newPayment, error: insertError } = await supabase
          .from('gvt_coach_payments_status')
          .insert({
            status: paymentStatus,
            json_data: {
              event_type: eventType,
              checkout_order_id: checkoutOrderId,
              product_id: productId,
              checkout_id: checkoutId,
              order_id: orderId,
              customer_email: userEmail,
              status: paymentStatus,
              webhook_event: eventType,
              updated_at: new Date().toISOString(),
              original_payload: body
            }
          })
          .select();
          
        if (insertError) {
          console.error(`[${logId}] Polar Webhook - Error creating payment record`, insertError);
            return;
          }
          
        paymentId = newPayment?.[0]?.id;
        console.log(`[${logId}] Polar Webhook - Created new payment record: ${paymentId} with status: ${paymentStatus}`);
      } else if (eventType === 'order.created' && !existingPayment) {
        // CASO ESPECIAL: Si es order.created y no encontramos ningún registro previo, 
        // significa que algo falló y debemos crear uno nuevo
        console.log(`[${logId}] Polar Webhook - WARNING: No existing PENDING record found for order.created, creating new PAID record`);
        
        const { data: newPayment, error: insertError } = await supabase
          .from('gvt_coach_payments_status')
          .insert({
            status: paymentStatus,
            json_data: {
              event_type: eventType,
              checkout_order_id: checkoutOrderId,
              product_id: productId,
              checkout_id: checkoutId,
              order_id: orderId,
              customer_email: userEmail,
              status: paymentStatus,
              webhook_event: eventType,
              updated_at: new Date().toISOString(),
              original_payload: body
            }
          })
          .select();
          
        if (insertError) {
          console.error(`[${logId}] Polar Webhook - Error creating payment record`, insertError);
          return;
        }
        
        paymentId = newPayment?.[0]?.id;
        console.log(`[${logId}] Polar Webhook - Created emergency payment record: ${paymentId} with status: ${paymentStatus}`);
      } else {
        console.log(`[${logId}] Polar Webhook - Not creating payment record for ${eventType} without existing record`);
        return;
      }
    } else {
      // Si ya existe un payment, actualizarlo según corresponda
      // Don't downgrade a payment record from PAID to PENDING
      if (existingPayment.status === PaymentOrderStatus.Paid && paymentStatus === PaymentOrderStatus.Pending) {
        console.log(`Skipping status update: Cannot downgrade from ${PaymentOrderStatus.Paid} to ${PaymentOrderStatus.Pending}`);
        return new Response(JSON.stringify({ 
          message: 'Payment record exists but no update needed (cannot downgrade status)',
          paymentId: existingPayment.id
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Only update if the status is different
      if (existingPayment.status !== paymentStatus) {
        // Parse the existing json_data
        let jsonData = existingPayment.json_data || {};
        if (typeof jsonData === 'string') {
          try {
            jsonData = JSON.parse(jsonData);
          } catch (e) {
            jsonData = {};
          }
        }
        
        // Create updated json_data with current status
        const updatedJsonData = {
          ...jsonData,
          status: paymentStatus, // Always update status in json_data to match main status
          provider: 'polar',
          payment_intent: data.payment_intent || '',
          amount: data.amount || 0,
          currency: data.currency || '',
          customer_email: data.customer_email || '',
          updated_at: new Date().toISOString()
        };

        // Log if statuses are inconsistent
        if (jsonData.status !== paymentStatus) {
          console.log(`[${logId}] Polar Webhook - Fixing inconsistent status: json_data.status (${jsonData.status}) will be updated to match main status (${paymentStatus})`);
        }

        // Update the record
        const { data: updatedPayment, error: updateError } = await supabase
          .from('gvt_coach_payments_status')
          .update({
            status: paymentStatus,
            json_data: updatedJsonData,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPayment.id)
          .select()
          .single();
        
        if (updateError) {
          console.error(`[${logId}] Polar Webhook - Error updating payment status`, updateError);
        } else {
          console.log(`[${logId}] Polar Webhook - Successfully updated payment status to ${paymentStatus}`);
          
          // Limpiar caché de time slots cuando un pago se confirma como PAID
          if (paymentStatus === PaymentOrderStatus.Paid) {
            try {
              bookingService.clearTimeSlotsCache();
              console.log(`[${logId}] Polar Webhook - Cleared time slots cache after payment confirmation`);
            } catch (cacheError) {
              console.error(`[${logId}] Polar Webhook - Error clearing cache:`, cacheError);
            }
          }
        }
      } else {
        // Even if the main status hasn't changed, ensure json_data.status matches
        if (existingPayment.json_data?.status !== paymentStatus) {
          console.log(`[${logId}] Polar Webhook - Main status unchanged (${paymentStatus}) but json_data.status needs update`);
          
          // Parse the existing json_data
          let jsonData = existingPayment.json_data || {};
          if (typeof jsonData === 'string') {
            try {
              jsonData = JSON.parse(jsonData);
            } catch (e) {
              jsonData = {};
            }
          }
          
          // Update only json_data to ensure status is consistent
          const updatedJsonData = {
            ...jsonData,
            status: paymentStatus,
            updated_at: new Date().toISOString()
          };
          
          const { error: updateJsonError } = await supabase
            .from('gvt_coach_payments_status')
            .update({
              json_data: updatedJsonData,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingPayment.id);
          
          if (updateJsonError) {
            console.error(`[${logId}] Polar Webhook - Error updating json_data status`, updateJsonError);
          } else {
            console.log(`[${logId}] Polar Webhook - Successfully updated json_data.status to ${paymentStatus}`);
          }
        } else {
          console.log(`[${logId}] Polar Webhook - Status already up to date (${paymentStatus}), no update needed`);
        }
      }
      
      // Usar el ID existente
      paymentId = existingPayment.id;
    }
    
    // PASO 5: Actualizar o crear mapping para seguimiento
    if (paymentId) {
      // SOLUCIÓN SIMPLIFICADA: 
      // Siempre usar el checkout_order_id como payment_order_id para garantizar un valor único
      
      // Preparar datos para mapping con payment_order_id idéntico a checkout_order_id
      const mappingData = {
        checkout_order_id: checkoutOrderId,
        payment_status_id: paymentId,
        provider: 'polar',
        // SIEMPRE usar checkout_order_id como payment_order_id
        payment_order_id: checkoutOrderId
      };
      
      console.log(`[${logId}] Polar Webhook - Using checkout_order_id as payment_order_id: ${checkoutOrderId}`);
      
      // Buscar si ya existe un mapping para este checkout_order_id
      console.log(`[${logId}] Polar Webhook - Checking for existing mapping with checkout_order_id: ${checkoutOrderId}`);
      const { data: existingMapping, error: findMappingError } = await supabase
        .from('gvt_coach_checkout_mapping')
        .select('*')
        .eq('checkout_order_id', checkoutOrderId)
        .maybeSingle();
      
      if (findMappingError) {
        console.error(`[${logId}] Polar Webhook - Error finding existing mapping:`, findMappingError);
      } 
      else if (existingMapping) {
        // Ya existe un mapping para este checkout_order_id
        console.log(`[${logId}] Polar Webhook - Found existing mapping: ${JSON.stringify(existingMapping)}`);
        
        // Actualizar el mapping existente si es necesario
        if (existingMapping.payment_status_id !== paymentId || 
            !existingMapping.payment_order_id || 
            existingMapping.payment_order_id === '') {
          
          console.log(`[${logId}] Polar Webhook - Updating existing mapping with proper values`);
          
          const { error: updateError } = await supabase
            .from('gvt_coach_checkout_mapping')
            .update({ 
              payment_status_id: paymentId,
              payment_order_id: checkoutOrderId  // Siempre usar checkoutOrderId
            })
            .eq('id', existingMapping.id);
            
          if (updateError) {
            console.error(`[${logId}] Polar Webhook - Error updating mapping:`, updateError);
          } else {
            console.log(`[${logId}] Polar Webhook - Successfully updated mapping to use correct values`);
          }
        } else {
          console.log(`[${logId}] Polar Webhook - Mapping already has correct values, no update needed`);
        }
      } 
      else {
        // No existe mapping, crear uno nuevo
        console.log(`[${logId}] Polar Webhook - No existing mapping found, creating new one`);
        
        const { error: createError } = await supabase
          .from('gvt_coach_checkout_mapping')
          .insert(mappingData);
          
        if (createError) {
          console.error(`[${logId}] Polar Webhook - Error creating mapping:`, createError);
        } else {
          console.log(`[${logId}] Polar Webhook - Successfully created new mapping`);
        }
      }
    }
    
    // PASO 6: Si es un evento de order.created y el estado es PAID, actualizar bookings
    if ((eventType === 'order.created' || eventType === 'order.completed') && paymentStatus === PaymentOrderStatus.Paid) {
      console.log(`[${logId}] Polar Webhook - Payment is PAID, updating related bookings`);
      
      // Buscar por checkout_order_id
      const { data: bookings, error: bookingError } = await supabase
        .from('gvt_coach_meetings_bookings')
        .select('*')
        .eq('checkout_order_id', checkoutOrderId);
        
      if (bookingError) {
        console.error(`[${logId}] Polar Webhook - Error finding bookings by checkout_order_id`, bookingError);
      } else if (bookings && bookings.length > 0) {
        console.log(`[${logId}] Polar Webhook - Found ${bookings.length} bookings by checkout_order_id to update`);
        
        // Always update all related bookings to PAID status
        for (const booking of bookings) {
          const { error: updateBookingError } = await supabase
            .from('gvt_coach_meetings_bookings')
            .update({
              payment_status: PaymentOrderStatus.Paid,
              checkout_completed: true,
              payment_confirmed: true,
              status: BookingStatus.Confirmed,
              user_timezone: booking.user_timezone || data.metadata?.timezone || 'UTC'
            })
            .eq('id', booking.id);
            
          if (updateBookingError) {
            console.error(`[${logId}] Polar Webhook - Error updating booking ${booking.id}`, updateBookingError);
          } else {
            console.log(`[${logId}] Polar Webhook - Updated booking ${booking.id} to PAID status`);
            
            // Ahora que el pago está confirmado, crear el Zoom meeting si no existe
            await createZoomMeetingForBooking(booking, logId);
            
            // Verificar nuevamente si se creó el enlace de reunión
            if (!booking.meet_link) {
              console.log(`[${logId}] Polar Webhook - Double-checking Zoom meeting creation for booking ${booking.id}`);
              
              // Obtener la reserva actualizada para verificar si ya tiene meet_link
              const { data: updatedBooking, error: fetchError } = await supabase
                .from('gvt_coach_meetings_bookings')
                .select('*')
                .eq('id', booking.id)
                .single();
                
              if (fetchError) {
                console.error(`[${logId}] Polar Webhook - Error fetching updated booking: ${fetchError.message}`);
              } else if (updatedBooking && !updatedBooking.meet_link) {
                console.log(`[${logId}] Polar Webhook - Booking still has no meet_link, attempting creation again`);
                // Intentar crear el meet_link nuevamente con un pequeño retraso
                setTimeout(async () => {
                  await createZoomMeetingForBooking(updatedBooking, logId);
                }, 1000);
              } else if (updatedBooking && updatedBooking.meet_link) {
                console.log(`[${logId}] Polar Webhook - Zoom meeting link successfully created: ${updatedBooking.meet_link}`);
              }
            }
          }
        }
      } else {
        // Alternative search by email
        console.log(`[${logId}] Polar Webhook - No bookings found with checkout_order_id, trying email: ${userEmail}`);
        
        const { data: emailBookings, error: emailBookingError } = await supabase
          .from('gvt_coach_meetings_bookings')
          .select('*')
          .eq('user_email', userEmail)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (emailBookingError) {
          console.error(`[${logId}] Polar Webhook - Error finding bookings by email`, emailBookingError);
        } else if (emailBookings && emailBookings.length > 0) {
          console.log(`[${logId}] Polar Webhook - Found booking via email: ${emailBookings[0].id}`);
          
          // Update booking and associate with checkoutOrderId
          const booking = emailBookings[0];
          const { error: updateEmailBookingError } = await supabase
            .from('gvt_coach_meetings_bookings')
            .update({ 
              payment_status: PaymentOrderStatus.Paid, 
              checkout_order_id: checkoutOrderId,
              checkout_completed: true,
              payment_confirmed: true,
              status: BookingStatus.Confirmed,
              user_timezone: booking.user_timezone || data.metadata?.timezone || 'UTC'
            })
            .eq('id', booking.id);
            
          if (updateEmailBookingError) {
            console.error(`[${logId}] Polar Webhook - Error updating booking found by email`, updateEmailBookingError);
          } else {
            console.log(`[${logId}] Polar Webhook - Updated booking ${booking.id} via email lookup`);
            
            // Ahora que el pago está confirmado, crear el Zoom meeting si no existe
            await createZoomMeetingForBooking(booking, logId);
            
            // Verificar nuevamente si se creó el enlace de reunión
            if (!booking.meet_link) {
              console.log(`[${logId}] Polar Webhook - Double-checking Zoom meeting creation for booking ${booking.id}`);
              
              // Obtener la reserva actualizada para verificar si ya tiene meet_link
              const { data: updatedBooking, error: fetchError } = await supabase
                .from('gvt_coach_meetings_bookings')
                .select('*')
                .eq('id', booking.id)
                .single();
                
              if (fetchError) {
                console.error(`[${logId}] Polar Webhook - Error fetching updated booking: ${fetchError.message}`);
              } else if (updatedBooking && !updatedBooking.meet_link) {
                console.log(`[${logId}] Polar Webhook - Booking still has no meet_link, attempting creation again`);
                // Intentar crear el meet_link nuevamente con un pequeño retraso
                setTimeout(async () => {
                  await createZoomMeetingForBooking(updatedBooking, logId);
                }, 1000);
              } else if (updatedBooking && updatedBooking.meet_link) {
                console.log(`[${logId}] Polar Webhook - Zoom meeting link successfully created: ${updatedBooking.meet_link}`);
              }
            }
          }
        } else {
          console.log(`[${logId}] Polar Webhook - No bookings found for this email that need payment updates`);
        }
      }
    } else {
      console.log(`[${logId}] Polar Webhook - Not processing bookings for event type ${eventType} or status ${paymentStatus}`);
    }
  } catch (error) {
    console.error('Polar Webhook - Process webhook error:', error);
  }
}

// Función auxiliar para crear Zoom meetings para reservas confirmadas
async function createZoomMeetingForBooking(booking: any, logId: string) {
  try {
    console.log(`[${logId}] Zoom - Starting meeting creation process for booking ${booking.id}`);
    
    // Verificar que la reserva tenga los datos necesarios y no tenga ya un enlace de Zoom
    if (!booking) {
      console.error(`[${logId}] Zoom - Invalid booking object`);
      return;
    }
    
    if (booking.meet_link) {
      console.log(`[${logId}] Zoom - Booking ${booking.id} already has a meet link: ${booking.meet_link}`);
      return;
    }
    
    if (!booking.booking_date) {
      console.error(`[${logId}] Zoom - Booking ${booking.id} has no booking date`);
      return;
    }
    
    console.log(`[${logId}] Zoom - Creating meeting for confirmed booking ${booking.id} on date ${booking.booking_date}`);
    
    // Obtener credenciales Zoom
    const accountId = process.env.GVT_COACH_ZOOM_ACCOUNT_ID;
    const clientId = process.env.GVT_COACH_ZOOM_CLIENT_ID;
    const clientSecret = process.env.GVT_COACH_ZOOM_CLIENT_SECRET;
    
    if (!accountId) {
      console.error(`[${logId}] Zoom - Missing ZOOM_ACCOUNT_ID environment variable`);
      return;
    }
    
    if (!clientId) {
      console.error(`[${logId}] Zoom - Missing ZOOM_CLIENT_ID environment variable`);
      return;
    }
    
    if (!clientSecret) {
      console.error(`[${logId}] Zoom - Missing ZOOM_CLIENT_SECRET environment variable`);
      return;
    }
    
    console.log(`[${logId}] Zoom - Requesting OAuth token with account ID: ${accountId.substring(0, 5)}...`);
    
    // Obtener token Zoom
    try {
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
        console.error(`[${logId}] Zoom - Error getting token (HTTP ${tokenResponse.status}):`, errorText);
        return;
      }
      
      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      
      if (!accessToken) {
        console.error(`[${logId}] Zoom - No access token in response`);
        return;
      }
      
      console.log(`[${logId}] Zoom - Successfully obtained access token`);
      
      // Crear la reunión Zoom
      const meetingTime = new Date(booking.booking_date);
      const durationMinutes = booking.duration || booking.session_minutes || 60;
      
      console.log(`[${logId}] Zoom - Creating meeting for ${meetingTime.toISOString()} with duration ${durationMinutes} minutes`);
      
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
      
      console.log(`[${logId}] Zoom - Sending request to create meeting with data:`, JSON.stringify(meetingData));
      
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
        console.error(`[${logId}] Zoom - Error creating meeting (HTTP ${meetingResponse.status}):`, errorText);
        return;
      }
      
      const meetingDetails = await meetingResponse.json();
      console.log(`[${logId}] Zoom - Meeting created successfully with ID: ${meetingDetails.id}`);
      
      if (meetingDetails.join_url) {
        // Actualizar la reserva con el enlace de la reunión
        console.log(`[${logId}] Zoom - Adding meeting link to booking: ${meetingDetails.join_url}`);
        
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (!supabaseUrl) {
          console.error(`[${logId}] Zoom - Missing NEXT_PUBLIC_SUPABASE_URL environment variable`);
          return;
        }
        
        if (!supabaseKey) {
          console.error(`[${logId}] Zoom - Missing SUPABASE_SERVICE_ROLE_KEY environment variable`);
          return;
        }
        
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        console.log(`[${logId}] Zoom - Updating booking ${booking.id} with meet link`);
        
        const { data, error: updateError } = await supabase
          .from('gvt_coach_meetings_bookings')
          .update({ meet_link: meetingDetails.join_url })
          .eq('id', booking.id)
          .select('id, meet_link')
          .single();
          
        if (updateError) {
          console.error(`[${logId}] Zoom - Error updating booking with meet link:`, updateError);
        } else if (!data) {
          console.error(`[${logId}] Zoom - No data returned after updating booking`);
        } else {
          console.log(`[${logId}] Zoom - Successfully updated booking ${booking.id} with Zoom meeting link: ${data.meet_link}`);
        }
      } else {
        console.error(`[${logId}] Zoom - Meeting created but no join_url in response:`, meetingDetails);
      }
    } catch (tokenError) {
      console.error(`[${logId}] Zoom - Error during token request:`, tokenError);
    }
  } catch (error) {
    console.error(`[${logId}] Zoom - General error creating meeting:`, error);
  }
}

export default POST;