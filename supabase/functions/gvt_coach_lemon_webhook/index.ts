import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.181.0/crypto/mod.ts";

// Function to verify webhook signature
async function verifyWebhookSignature(
  signatureHeader: string | null, 
  payload: string, 
  webhookSecret: string
): Promise<boolean> {
  if (!signatureHeader || !webhookSecret) {
    console.error("Missing signature header or webhook secret");
    return false;
  }

  try {
    // Log for debugging purposes
    console.log("Verifying webhook signature:", {
      signatureHeaderExists: !!signatureHeader,
      payloadPreview: payload.substring(0, 100) + "...",
      secretLength: webhookSecret.length,
      webhookSecret: webhookSecret.substring(0, 3) + "..." // Log part of the secret for debugging
    });

    // Create an HMAC using the secret and SHA-256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(webhookSecret.trim()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    // Sign the payload
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    
    // Convert to hex string using Deno's native hex encoder
    const computedSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const providedSignature = signatureHeader;
    
    // Compare with the provided signature
    const signatureMatches = computedSignature === providedSignature;
    
    if (!signatureMatches) {
      console.error("Signature verification failed");
      console.log("Computed signature:", computedSignature);
      console.log("Provided signature:", providedSignature);
    } else {
      console.log("Signature verification succeeded");
    }
    
    return signatureMatches;
  } catch (error) {
    console.error("Error verifying webhook signature:", error);
    return false;
  }
}

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

// Function to get Zoom access token
async function getZoomAccessToken(): Promise<string> {
  const zoomAccountId = Deno.env.get("GVT_COACH_ZOOM_ACCOUNT_ID");
  const zoomClientId = Deno.env.get("GVT_COACH_ZOOM_CLIENT_ID");
  const zoomClientSecret = Deno.env.get("GVT_COACH_ZOOM_CLIENT_SECRET");

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

  // Log all headers for debugging
  console.log("LemonSqueezy webhook received - headers:", JSON.stringify(Object.fromEntries(req.headers.entries())));
  console.log("LemonSqueezy webhook received - URL:", req.url);

  // Clone the request to read the body twice (once for ping check, once for processing)
  const reqClone = req.clone();
  
  try {
    // IMPORTANTE: Solo tratar como ping/test si la solicitud no tiene cuerpo o el cuerpo está vacío
    const rawBody = await reqClone.text();
    const userAgent = req.headers.get("user-agent") || "";
    
    // Verificar si es una solicitud de ping (vacía o sin datos relevantes)
    if ((userAgent.includes("Lemon") || userAgent.includes("lemonsqueezy")) && 
        (!rawBody || rawBody.trim() === "" || rawBody === "{}")) {
      console.log("Detected a ping/test request from LemonSqueezy");
      return new Response(JSON.stringify({ success: true, message: "LemonSqueezy webhook endpoint is active" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Si llegamos aquí, es un webhook real que necesita ser procesado
    
    // Supabase configuration
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get webhook secret
    const webhookSecret = Deno.env.get("GVT_COACH_LEMONSQUEEZY_WEBHOOK_SECRET") || "";
    
    console.log("Webhook configuration:", {
      supabaseUrlExists: !!supabaseUrl,
      supabaseKeyExists: !!supabaseKey,
      hasWebhookSecret: !!webhookSecret,
    });

    // Get request body and signature
    const signature = req.headers.get("X-Signature");
    
    console.log("Received webhook - signature present:", !!signature);
    console.log("Raw webhook body:", rawBody.substring(0, 300) + (rawBody.length > 300 ? "..." : ""));
    
    // Verify signature if webhook secret is provided
    if (webhookSecret) {
      const isValid = await verifyWebhookSignature(signature, rawBody, webhookSecret);
      if (!isValid) {
        console.error("Invalid webhook signature");
        return new Response(JSON.stringify({ error: "Unauthorized - invalid signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    } else {
      console.warn("No webhook secret provided - skipping signature verification");
    }
    
    // Parse JSON payload
    const jsonData: WebhookData = JSON.parse(rawBody);

    console.log("Webhook data received:", JSON.stringify(jsonData));

    // Extract IDs from webhook
    const paymentOrderId = jsonData.data?.id;
    const paymentIdentifierId = jsonData.data?.attributes?.identifier;
    const paymentStatus = jsonData.data?.attributes?.status;
    const userEmail = jsonData.data?.attributes?.user_email;

    console.log("Extracted payment details:", {
      paymentOrderId,
      paymentIdentifierId,
      paymentStatus,
      userEmail
    });

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
      let bookingQuery = supabase.from("gvt_coach_meetings_bookings").select("checkout_order_id, id");
      
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
      
      if (bookings && bookings.length > 0) {
        if (bookings[0].checkout_order_id) {
          checkoutOrderId = bookings[0].checkout_order_id;
          console.log(`Found checkout_order_id in bookings: ${checkoutOrderId}`);
        } else {
          // Si el checkout_order_id es null, actualiza la reserva con el paymentOrderId
          console.log(`Booking found but checkout_order_id is null. Setting it to payment_order_id: ${paymentOrderId}`);
          
          const { error: updateError } = await supabase
            .from("gvt_coach_meetings_bookings")
            .update({ checkout_order_id: paymentOrderId })
            .eq("id", bookings[0].id);
            
          if (updateError) {
            console.error("Error updating booking with checkout_order_id:", updateError);
          } else {
            console.log(`Updated booking ${bookings[0].id} with checkout_order_id ${paymentOrderId}`);
            checkoutOrderId = paymentOrderId;
          }
        }
      } else {
        console.error("Cannot find valid checkout_order_id in bookings!");
        // No usar el paymentOrderId como fallback, son campos distintos
        console.warn("No mapping found for LemonSqueezy webhook, but will continue processing payment");
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
        checkout_order_id: checkoutOrderId || `lemon_order_${paymentOrderId}`, // Use a placeholder if no real checkout_order_id
        payment_order_id: paymentOrderId,
        payment_identifier_id: paymentIdentifierId,
        payment_status_id: paymentStatusId,
        provider: "lemonsqueezy"
      }, {
        onConflict: 'checkout_order_id'
      });

    if (mappingError) {
      console.error("Error updating mapping table:", mappingError);
      // Don't throw - we want to continue even if mapping update fails
    } else {
      console.log(`Updated mapping table for checkout_order_id: ${checkoutOrderId || `lemon_order_${paymentOrderId}`}`);
    }

    // If payment is successful (PAID/ACTIVE), create Zoom meeting and update booking
    if (paymentStatus.toUpperCase() === "PAID" || paymentStatus.toUpperCase() === "ACTIVE") {
      console.log("Payment confirmed, looking for booking to update with Zoom meeting link");

      // First, look for a direct match with checkout_order_id
      let { data: booking, error: bookingError } = await supabase
        .from("gvt_coach_meetings_bookings")
        .select("*")
        .eq("checkout_order_id", checkoutOrderId)
        .maybeSingle();

      // If no direct match, and we're using a placeholder ID, try finding by user email
      if (!booking && userEmail && checkoutOrderId?.startsWith("lemon_order_")) {
        console.log(`No direct match for placeholder ID, looking for booking by user email: ${userEmail}`);
        
        const { data: bookingByEmail, error: emailError } = await supabase
          .from("gvt_coach_meetings_bookings")
          .select("*")
          .eq("user_email", userEmail)
          .order("created_at", { ascending: false })
          .limit(1);
          
        if (emailError) {
          console.error("Error looking up booking by email:", emailError);
        } else if (bookingByEmail && bookingByEmail.length > 0) {
          console.log(`Found booking by email: ${bookingByEmail[0].id}`);
          booking = bookingByEmail[0];
          
          // Update the booking's checkout_order_id to match our mapping
          const { error: updateIdError } = await supabase
            .from("gvt_coach_meetings_bookings")
            .update({ checkout_order_id: checkoutOrderId })
            .eq("id", booking.id);
            
          if (updateIdError) {
            console.error("Error updating booking checkout_order_id:", updateIdError);
          } else {
            console.log(`Updated booking ${booking.id} with checkout_order_id ${checkoutOrderId}`);
          }
        }
      }
        
      if (bookingError) {
        console.error("Error fetching booking:", bookingError);
      } else if (booking) {
        console.log("Found booking:", booking.id);
        
        // Update booking payment status
        const { error: updateStatusError } = await supabase
          .from("gvt_coach_meetings_bookings")
          .update({ 
            payment_status: paymentStatus.toUpperCase(),
            checkout_completed: true,
            payment_confirmed: true,
            updated_at: new Date().toISOString()
          })
          .eq("id", booking.id);
          
        if (updateStatusError) {
          console.error("Error updating booking payment status:", updateStatusError);
        } else {
          console.log("Successfully updated booking payment status");
        }
        
        // Only create Zoom meeting if meet_link doesn't exist yet
        if (!booking.meet_link) {
          try {
            // Obtener el token de Zoom usando la nueva función
            const access_token = await getZoomAccessToken();
            
            console.log("Zoom token acquired successfully, creating meeting...");
            
            // Create Zoom meeting with clear booking details
            const bookingDate = new Date(booking.booking_date || booking.date);
            const meetingDetails = {
              topic: "Coaching Session",
              type: 2, // Scheduled meeting
              start_time: bookingDate.toISOString(),
              duration: booking.frequency === "ONCE" ? 60 : ((booking.duration || 1) * 60), // Default to 60 minutes for "ONCE" frequency
              timezone: booking.timezone || "UTC",
              settings: {
                join_before_host: true,
                waiting_room: false,
                auto_recording: "cloud"
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
            
            const updateBookingObject: Record<string, any> = {
              meet_link: zoomLink,
              updated_at: new Date().toISOString()
            };
            
            const { error: updateBookingError } = await supabase
              .from("gvt_coach_meetings_bookings")
              .update(updateBookingObject)
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
        console.log("No booking found for this order ID:", checkoutOrderId || `lemon_order_${paymentOrderId}`);
        // We don't create a booking here anymore, as it should be created during checkout
      }
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      message: "Payment processed successfully",
      checkout_order_id: checkoutOrderId || `lemon_order_${paymentOrderId}`
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