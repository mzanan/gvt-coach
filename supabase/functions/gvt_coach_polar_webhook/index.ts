// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

// Crear un client de Supabase
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Define payment status constants to match the enum in the main app
const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  ACTIVE: 'ACTIVE',
  VOID: 'VOID',
  COMPLETED: 'COMPLETED'
};

// ADD: Function to get Zoom access token (copied from Lemon webhook)
async function getZoomAccessToken(): Promise<string> {
  const zoomAccountId = Deno.env.get("GVT_COACH_ZOOM_ACCOUNT_ID");
  const zoomClientId = Deno.env.get("GVT_COACH_ZOOM_CLIENT_ID");
  const zoomClientSecret = Deno.env.get("GVT_COACH_ZOOM_CLIENT_SECRET");

  if (!zoomAccountId || !zoomClientId || !zoomClientSecret) {
    throw new Error("Faltan credenciales de Zoom en las variables de entorno.");
  }

  console.log("Obteniendo token de Zoom con Account ID:", zoomAccountId);

  const tokenResponse = await fetch("https://zoom.us/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${btoa(`${zoomClientId}:${zoomClientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "account_credentials",
      account_id: zoomAccountId,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("Error en respuesta de Zoom al obtener token:", errorText);
    throw new Error(`Error obteniendo el token de Zoom: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  console.log("Token de Zoom obtenido exitosamente para Polar webhook.");
  return tokenData.access_token;
}

serve(async (req: Request) => {
  try {
    const logId = Math.random().toString(36).substring(2, 8);
    
    // Responder inmediatamente para evitar timeouts
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', 'application/json');
    
    // Procesar la solicitud de manera asíncrona
    processWebhookEvent(req).catch(error => {
      console.error(`[${logId}] Error processing webhook:`, error);
    });
    
    // Responder al cliente rápidamente
    return new Response(JSON.stringify({ message: "Webhook received" }), {
      headers: responseHeaders,
      status: 202
    });
  } catch (error) {
    console.error("Error in webhook:", error);
    return new Response(JSON.stringify({ error: "Error processing webhook" }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

// Procesar el webhook de manera asíncrona
async function processWebhookEvent(req: Request) {
  try {
    // Clonar la request para poder leer el body múltiples veces
    const body = await req.json();

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

    // Extraction de identificadores - CORREGIDO para usar checkout_id en eventos order.created
    let checkoutId = '';
    if (eventType === 'order.created' || eventType === 'order.completed') {
      // Para eventos de orden, el ID del checkout está en data.checkout_id
      checkoutId = data?.checkout_id || data?.id || '';
      console.log(`Usando checkout_id de evento ${eventType}:`, checkoutId);
    } else {
      // Para otros eventos (checkout.created), el ID está en data.id
      checkoutId = data?.id || '';
    }
    
    const orderId = data?.order?.id || '';
    const metadata = data?.metadata || {};
    const metadataProductId = metadata?.product_id || '';
    
    console.log('Event received:', {
      type: eventType,
      checkoutId,
      orderId,
      metadata
    });

    // Determinar el estado del pago basado en el tipo de evento
    let status = PAYMENT_STATUS.PENDING; // Default to pending
    
    if (eventType === 'order.created' || eventType === 'order.completed') {
      status = PAYMENT_STATUS.PAID;
    } else if (data.status === 'paid' || data.status === 'completed') {
      status = PAYMENT_STATUS.PAID;
    }
    
    // Definir las claves a buscar en las tablas
    // Prioridad de búsqueda: checkoutId, productId (desde la URL)
    const keysToSearch = [];
    
    if (checkoutId) keysToSearch.push(checkoutId);
    if (metadataProductId) keysToSearch.push(metadataProductId);
    if (orderId) keysToSearch.push(orderId);
    
    console.log('Keys to search for payment records:', keysToSearch);
    
    // Buscar registros de pago existentes por cualquiera de los IDs
    let paymentRecord = null;
    let existingMappingId = null;

    // Buscar primero en la tabla de checkout_mapping
    if (keysToSearch.length > 0) {
      try {
        // Primera corrección: búsqueda en checkout_mapping
        // Usar la sintaxis correcta para múltiples condiciones OR
        let mappingConditions = [];
        
        for (const key of keysToSearch) {
          const escapedKey = key.replace(/'/g, "''");
          mappingConditions.push(`checkout_order_id.eq.${escapedKey}`);
          mappingConditions.push(`payment_order_id.eq.${escapedKey}`);
        }
        
        const { data: mappings, error: mappingError } = await supabase
          .from('gvt_coach_checkout_mapping')
          .select('id, payment_status_id, checkout_order_id, payment_order_id')
          .or(mappingConditions.join(','));
        
        if (mappingError) {
          console.error('Error searching checkout mappings:', mappingError);
        } else if (mappings && mappings.length > 0) {
          console.log('Found existing mapping:', mappings[0]);
          existingMappingId = mappings[0].id;
          
          // Si encontramos un mapping, buscar el registro de pago asociado
          const { data: payment, error: paymentError } = await supabase
            .from('gvt_coach_payments_status')
            .select('*')
            .eq('id', mappings[0].payment_status_id)
            .limit(1)
            .single();
          
          if (paymentError) {
            console.error('Error fetching payment status:', paymentError);
          } else if (payment) {
            paymentRecord = payment;
            console.log('Found existing payment record:', payment);
          }
        }
        
        // Si no encontramos por mapping, buscar directamente en la tabla de pagos por json_data
        if (!paymentRecord) {
          // Segunda corrección: búsqueda en json_data
          // Usar la sintaxis correcta para múltiples condiciones OR con JSON
          let jsonConditions = [];
          
          for (const key of keysToSearch) {
            const escapedKey = key.replace(/'/g, "''");
            jsonConditions.push(`json_data->>'checkout_id'.eq.${escapedKey}`);
            jsonConditions.push(`json_data->>'product_id'.eq.${escapedKey}`);
          }
          
          const { data: payments, error: paymentsError } = await supabase
            .from('gvt_coach_payments_status')
            .select('*')
            .or(jsonConditions.join(','))
            .order('created_at', { ascending: false })
            .limit(5);
          
          if (paymentsError) {
            console.error(`Error searching payments with keys:`, paymentsError);
          } else if (payments && payments.length > 0) {
            console.log(`Found ${payments.length} payment(s) with keys:`, payments);
            
            // Preferir registros PENDING para actualizar
            const pendingRecord = payments.find(p => p.status === PAYMENT_STATUS.PENDING);
            if (pendingRecord) {
              paymentRecord = pendingRecord;
              console.log('Selected PENDING record for update:', pendingRecord);
            } else {
              // Si no hay PENDING, usar el primero
              paymentRecord = payments[0];
              console.log('Selected most recent record for update:', payments[0]);
            }
          }
        }
      } catch (error) {
        console.error('Error searching for existing payment records:', error);
      }
    }

    // Si el evento es checkout.created y no encontramos un registro existente, no hacemos nada
    // porque el registro debería ser creado por la API booking/create
    if (!paymentRecord && eventType === 'checkout.created') {
      console.log('No existing payment record found for checkout.created event - this is expected if API booking/create is working correctly');
      
      // Sin embargo, vamos a actualizar/crear una entrada en checkout_mapping para mantener la coherencia
      if (checkoutId) {
        try {
          if (existingMappingId) {
            // Actualizar el mapping existente
            const { error: updateError } = await supabase
              .from('gvt_coach_checkout_mapping')
              .update({
                checkout_order_id: checkoutId,
                payment_order_id: orderId || metadataProductId || ''
              })
              .eq('id', existingMappingId);
            
            if (updateError) {
              console.error('Error updating checkout mapping:', updateError);
            } else {
              console.log('Updated existing checkout mapping');
            }
          } else {
            console.log('No mapping found for checkout.created event - we should expect the API to create one');
          }
        } catch (error) {
          console.error('Error updating checkout mapping:', error);
        }
      }
      
      return new Response(JSON.stringify({ success: true, message: 'No action needed for checkout.created event' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Preparar los datos a actualizar
    let jsonData: any = { 
      ...((paymentRecord?.json_data as any) || {}),
      status: status,
      event_type: eventType,
      timestamp: new Date().toISOString()
    };
    
    // Actualizar los IDs en el jsonData
    if (checkoutId) jsonData.checkout_id = checkoutId;
    if (orderId) jsonData.order_id = orderId;
    if (metadataProductId) jsonData.product_id = metadataProductId;
    
    // Añadir toda la metadata
    jsonData.metadata = metadata;
    
    // Si encontramos un registro existente, actualizarlo
    if (paymentRecord) {
      console.log('Updating existing payment record with status:', status);
      
      // No degradar un estado PAID a PENDING
      if (paymentRecord.status === PAYMENT_STATUS.PAID && status === PAYMENT_STATUS.PENDING) {
        console.log('Not downgrading PAID status to PENDING');
        status = PAYMENT_STATUS.PAID;
      }
      
      try {
        const { error: updateError } = await supabase
          .from('gvt_coach_payments_status')
          .update({
            status: status,
            json_data: jsonData
          })
          .eq('id', paymentRecord.id);
        
        if (updateError) {
          console.error('Error updating payment status:', updateError);
          return new Response(JSON.stringify({ error: 'Error updating payment status' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500
          });
        }
        
        // If status is PAID, update the booking status and generate Zoom meeting link
        if (status === PAYMENT_STATUS.PAID) {
          try {
            // Find the booking record associated with this payment
            const { data: bookings, error: bookingError } = await supabase
              .from('gvt_coach_meetings_bookings')
              .select('*')
              .eq('checkout_order_id', checkoutId)
              .limit(1);
            
            if (bookingError) {
              console.error('Error finding booking:', bookingError);
            } else if (bookings && bookings.length > 0) {
              const booking = bookings[0];

              console.log('Found booking for payment:', booking);
              
              // Update booking status to confirmed
              const { error: updateBookingError } = await supabase
                .from('gvt_coach_meetings_bookings')
                .update({
                  payment_status: PAYMENT_STATUS.PAID,
                  checkout_completed: true,
                  payment_confirmed: true
                })
                .eq('id', booking.id);
              
              if (updateBookingError) {
                console.error('Error updating booking status:', updateBookingError);
              } else {
                console.log('Updated booking status to CONFIRMED');
                
                // Generate Zoom meeting link if it doesn't exist
                if (!booking.meet_link) {
                  try {
                    // Get Zoom token directly
                    const access_token = await getZoomAccessToken();
                    console.log("Zoom token acquired successfully for Polar, creating meeting...");

                    // Prepare meeting details
                    const meetingTime = new Date(booking.booking_date);
                    // Use user_name or user_email if available, otherwise a generic topic
                    const userName = booking.user_name || booking.user_email || 'Client';
                    const meetingTopic = `GVT Coaching Session with ${userName}`;
                    const duration = booking.session_minutes || 60; // Use session_minutes or default
                    const timezone = booking.user_timezone || 'UTC'; // Use user_timezone or default

                    const meetingDetails = {
                      topic: meetingTopic,
                      type: 2, // Scheduled meeting
                      start_time: meetingTime.toISOString(),
                      duration: duration,
                      timezone: timezone,
                      settings: {
                        join_before_host: true,
                        waiting_room: false, // Adjust as needed
                        auto_recording: "cloud" // Adjust as needed
                      }
                    };

                    console.log("Polar - Zoom Meeting details:", JSON.stringify(meetingDetails));

                    // Call Zoom API directly
                    const meetingResponse = await fetch("https://api.zoom.us/v2/users/me/meetings", {
                      method: "POST",
                      headers: {
                        "Authorization": `Bearer ${access_token}`,
                        "Content-Type": "application/json"
                      },
                      body: JSON.stringify(meetingDetails)
                    });

                    if (!meetingResponse.ok) {
                      const meetingError = await meetingResponse.text();
                      console.error("Polar - Failed to create Zoom meeting:", meetingError);
                      throw new Error(`Failed to create Zoom meeting: ${meetingResponse.status} - ${meetingError}`);
                    }

                    const meetingData = await meetingResponse.json();
                    const zoomLink = meetingData.join_url;

                    if (!zoomLink) {
                      console.error("Polar - No join URL received from Zoom");
                      throw new Error("No join URL received from Zoom");
                    }

                    console.log("Polar - Created Zoom meeting successfully:", zoomLink);

                    // Update booking with meet link
                    const { error: meetLinkError } = await supabase
                      .from('gvt_coach_meetings_bookings')
                      .update({ meet_link: zoomLink })
                      .eq('id', booking.id);

                    if (meetLinkError) {
                      console.error('Polar - Error updating booking with meet link:', meetLinkError);
                    } else {
                      console.log('Polar - Added Zoom meeting link to booking:', zoomLink);
                    }
                  } catch (zoomError) {
                    console.error('Polar - Error generating Zoom meeting link:', zoomError);
                  }
                } else {
                   console.log('Polar - Booking already has a meet link:', booking.meet_link);
                }
              }
            } else {
               console.log('Polar - No booking found for checkout_id:', checkoutId);
            }
          } catch (bookingError) {
            console.error('Polar - Error processing booking update:', bookingError);
          }
        }
        
        // Actualizar o crear la entrada en checkout_mapping
        if (checkoutId) {
          if (existingMappingId) {
            // Actualizar el mapping existente
            const { error: updateMappingError } = await supabase
              .from('gvt_coach_checkout_mapping')
              .update({
                checkout_order_id: checkoutId,
                payment_order_id: checkoutId
              })
              .eq('id', existingMappingId);
            
            if (updateMappingError) {
              console.error('Error updating checkout mapping:', updateMappingError);
            } else {
              console.log(`Updated checkout mapping with checkout_id: ${checkoutId}`);
            }
          } else {
            // Crear un nuevo mapping
            const { error: createMappingError } = await supabase
              .from('gvt_coach_checkout_mapping')
              .insert({
                payment_status_id: paymentRecord.id,
                checkout_order_id: checkoutId,
                payment_order_id: checkoutId,
                provider: 'polar'
              });
            
            if (createMappingError) {
              console.error('Error creating checkout mapping:', createMappingError);
            } else {
              console.log(`Created new checkout mapping with checkout_id: ${checkoutId}`);
            }
          }
        }
        
        return new Response(JSON.stringify({ success: true, message: 'Payment status updated' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        });
      } catch (error) {
        console.error('Error updating payment record:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 500
        });
      }
    } else {
      // No debería llegar aquí normalmente, porque la API debe crear el registro inicialmente
      console.log('UNEXPECTED: No payment record found. This might indicate that the API booking/create failed.');
      
      return new Response(JSON.stringify({ 
        warning: 'No payment record found',
        message: 'This is unusual and might indicate issues with the booking/create API' 
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    }
  } catch (error) {
    console.error("Unexpected error in Polar webhook processing:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
}
