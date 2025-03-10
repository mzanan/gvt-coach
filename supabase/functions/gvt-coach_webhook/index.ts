import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface WebhookData {
  meta?: {
    custom_data?: {
      order_id?: string;
    };
    event_name?: string;
  };
  data?: {
    id?: string;
    attributes?: {
      status?: string;
      identifier?: string;
      user_email?: string;
      user_name?: string;
      order_number?: number;
    };
  };
}

// Función para obtener el token de acceso de Zoom
async function getZoomAccessToken(): Promise<string> {
  const zoomAccountId = Deno.env.get("ZOOM_ACCOUNT_ID");
  const zoomClientId = Deno.env.get("ZOOM_CLIENT_ID");
  const zoomClientSecret = Deno.env.get("ZOOM_CLIENT_SECRET");

  if (!zoomAccountId || !zoomClientId || !zoomClientSecret) {
    throw new Error("Faltan credenciales de Zoom");
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
    console.error("Error en respuesta de Zoom:", errorText);
    throw new Error(`Error obteniendo el token de Zoom: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  console.log("Token de Zoom obtenido exitosamente");
  return tokenData.access_token;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Supabase configuration
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const rawBody = await req.text();
    const jsonData: WebhookData = JSON.parse(rawBody);

    console.log("Webhook data received:", JSON.stringify(jsonData));

    // Extract IDs from webhook
    const paymentOrderId = jsonData.data?.id;
    const paymentIdentifierId = jsonData.data?.attributes?.identifier;
    const paymentStatus = jsonData.data?.attributes?.status;
    const userEmail = jsonData.data?.attributes?.user_email;

    if (!paymentOrderId || !paymentStatus) {
      return new Response(JSON.stringify({ error: "Missing payment_order_id or status" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // First check if we already have a payment record with this payment_order_id
    let { data: existingMapping, error: existingMappingError } = await supabase
      .from("gvt_coach_checkout_mapping")
      .select("checkout_order_id, payment_status_id")
      .eq("payment_order_id", paymentOrderId)
      .maybeSingle();

    let checkoutOrderId: string | null = null;
    let paymentStatusId: string | null = null;

    if (existingMapping && existingMapping.checkout_order_id) {
      // Found a mapping with this payment_order_id
      checkoutOrderId = existingMapping.checkout_order_id;
      paymentStatusId = existingMapping.payment_status_id;
      console.log(`Found existing mapping with checkout_order_id: ${checkoutOrderId}`);
    } else {
      // If we couldn't find a mapping, look for the booking with this payment identifier or user email
      console.log("No mapping found, looking for booking in meetings_bookings table...");
      
      // Intentar encontrar por el email del usuario si está disponible
      let bookingQuery = supabase.from("gvt_coach_meetings_bookings").select("checkout_order_id");
      
      if (userEmail) {
        console.log(`Looking for booking with user_email: ${userEmail}`);
        bookingQuery = bookingQuery.eq("user_email", userEmail);
      }
      
      const { data: bookings, error: bookingsError } = await bookingQuery
        .order("created_at", { ascending: false })
        .limit(1);
      
      if (bookingsError) {
        console.error("Error finding booking:", bookingsError);
        throw bookingsError;
      }
      
      if (bookings && bookings.length > 0 && bookings[0].checkout_order_id) {
        checkoutOrderId = bookings[0].checkout_order_id;
        console.log(`Found checkout_order_id in bookings: ${checkoutOrderId}`);
      } else {
        console.error("Cannot find valid checkout_order_id in bookings!");
        // En último caso, usar el paymentOrderId pero registrar que esto no es lo ideal
        checkoutOrderId = paymentOrderId;
        console.warn(`FALLBACK: Using payment_order_id as checkout_order_id: ${checkoutOrderId}`);
      }
      
      // Buscar si ya existe un registro PENDING en payments_status
      const { data: pendingStatus, error: pendingStatusError } = await supabase
        .from("gvt_coach_payments_status")
        .select("id, status")
        .eq("status", "PENDING")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (pendingStatusError) {
        console.error("Error finding pending payment status:", pendingStatusError);
      }
      
      if (pendingStatus && pendingStatus.id) {
        // Si encontramos un estado PENDING, usamos ese ID para actualizar
        paymentStatusId = pendingStatus.id;
        console.log(`Found existing PENDING payment status with ID: ${paymentStatusId}`);
      } else {
        // Si no encontramos un estado PENDING, creamos uno nuevo
        const { data: newPaymentStatus, error: newPaymentError } = await supabase
          .from("gvt_coach_payments_status")
          .insert({
            status: paymentStatus.toUpperCase(),
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            json_data: jsonData
          })
          .select("id")
          .single();

        if (newPaymentError) {
          console.error("Error creating payment record:", newPaymentError);
          throw newPaymentError;
        }
        
        paymentStatusId = newPaymentStatus.id;
        console.log(`Created new payment record with ID: ${paymentStatusId}`);
      }
    }
    
    // If we have an existing payment status ID, update it
    if (paymentStatusId) {
      const { error: updateError } = await supabase
        .from("gvt_coach_payments_status")
        .update({
          status: paymentStatus.toUpperCase(),
          updated_at: new Date().toISOString(),
          json_data: jsonData
        })
        .eq("id", paymentStatusId);
        
      if (updateError) {
        console.error("Error updating payment status:", updateError);
        // Continue execution even if there's an error updating the payment status
      } else {
        console.log(`Updated payment status with ID: ${paymentStatusId}`);
      }
    }

    // Always update the mapping table to ensure it's correct
    const { error: mappingError } = await supabase
      .from("gvt_coach_checkout_mapping")
      .upsert({
        checkout_order_id: checkoutOrderId,
        payment_order_id: paymentOrderId,
        payment_identifier_id: paymentIdentifierId,
        payment_status_id: paymentStatusId
      }, {
        onConflict: 'checkout_order_id'
      });

    if (mappingError) {
      console.error("Error updating mapping table:", mappingError);
      // Don't throw - we want to continue even if mapping update fails
    } else {
      console.log(`Updated mapping table for checkout_order_id: ${checkoutOrderId}`);
    }

    // If payment is successful (PAID/ACTIVE), create Zoom meeting and update booking
    if (paymentStatus.toUpperCase() === "PAID" || paymentStatus.toUpperCase() === "ACTIVE") {
      console.log("Payment confirmed, looking for booking to update with Zoom meeting link");
      
      // Find the booking for this order
      const { data: booking, error: bookingError } = await supabase
        .from("gvt_coach_meetings_bookings")
        .select("*")
        .eq("checkout_order_id", checkoutOrderId)
        .maybeSingle();
        
      if (bookingError) {
        console.error("Error fetching booking:", bookingError);
      } else if (booking) {
        console.log("Found booking:", booking.id);
        
        // Also update booking status to CONFIRMED
        const { error: updateStatusError } = await supabase
          .from("gvt_coach_meetings_bookings")
          .update({ 
            status: "CONFIRMED",
            payment_status: paymentStatus.toUpperCase(),
            checkout_completed: true,
            payment_confirmed: true,
            updated_at: new Date().toISOString()
          })
          .eq("id", booking.id);
          
        if (updateStatusError) {
          console.error("Error updating booking status:", updateStatusError);
        } else {
          console.log("Successfully updated booking status to CONFIRMED");
        }
        
        // Only create Zoom meeting if meet_link doesn't exist yet
        if (!booking.meet_link) {
          try {
            // Obtener el token de Zoom usando la nueva función
            const access_token = await getZoomAccessToken();
            
            console.log("Zoom token acquired successfully, creating meeting...");
            
            // Create Zoom meeting with clear booking details
            const bookingDate = new Date(booking.booking_date);
            const meetingDetails = {
              topic: "Coaching Session",
              type: 2, // Scheduled meeting
              start_time: bookingDate.toISOString(),
              duration: 60,
              timezone: booking.user_timezone || "UTC",
              settings: {
                join_before_host: true,
                waiting_room: false
              }
            };
            
            console.log("Meeting details:", JSON.stringify(meetingDetails));
            
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
              console.error("Failed to create Zoom meeting:", meetingError);
              throw new Error(`Failed to create Zoom meeting: ${meetingResponse.status} - ${meetingError}`);
            }
            
            const meetingData = await meetingResponse.json();
            const zoomLink = meetingData.join_url;
            
            if (!zoomLink) {
              console.error("No join URL received from Zoom");
              throw new Error("No join URL received from Zoom");
            }
            
            console.log("Created Zoom meeting successfully:", zoomLink);
            
            // Update booking with Zoom link
            const { error: updateBookingError } = await supabase
              .from("gvt_coach_meetings_bookings")
              .update({ 
                meet_link: zoomLink,
                updated_at: new Date().toISOString()
              })
              .eq("id", booking.id);
              
            if (updateBookingError) {
              console.error("Error updating booking with Zoom link:", updateBookingError);
              throw updateBookingError;
            } else {
              console.log(`Successfully updated booking (ID: ${booking.id}) with Zoom link: ${zoomLink}`);
            }
          } catch (zoomError) {
            console.error("Error creating or updating Zoom meeting:", zoomError);
            throw zoomError;
          }
        } else {
          console.log("Booking already has a Zoom link:", booking.meet_link);
        }
      } else {
        console.log("No booking found for this order ID:", checkoutOrderId);
        // We don't create a booking here anymore, as it should be created during checkout
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: "Payment processed successfully",
      checkout_order_id: checkoutOrderId
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});