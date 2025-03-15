import { NextRequest, NextResponse } from 'next/server';
import { createLemonSqueezyCheckout } from './lemonsqueezy';
import { createPolarCheckout } from './polar';
import { createClient } from '@/lib/supabase/server';
import { BookingFrequency, PaymentOrderStatus } from '@/app/types/enums/booking';
import { DateTime } from 'luxon';

// Helper function for consistent date handling
function processBookingDate(dateString: string, userTimezone: string): Date {
  console.log(`Processing date: ${dateString} with timezone: ${userTimezone}`);
  
  const dateTime = DateTime.fromISO(dateString);
  
  if (!dateTime.isValid) {
    console.log(`Invalid date format: ${dateString}`);
    return new Date();
  }
  
  // Handle dates with 'Z' suffix (already in UTC)
  if (dateString.endsWith('Z')) {
    console.log(`Date is already in UTC format with Z suffix: ${dateString}`);
    return new Date(dateString);
  }
  
  // Check if the string has explicit timezone info in ISO format
  const hasTimezoneOffset = dateString.includes('+') || dateString.includes('-') && dateString.indexOf('T') < dateString.indexOf('-');
  
  if (hasTimezoneOffset || dateTime.zoneName) {
    console.log(`Date has timezone info, using it directly: ${dateString}`);
    const utcDateTime = dateTime.toUTC();
    console.log(`Converted to UTC: ${utcDateTime.toString()}`);
    return utcDateTime.toJSDate();
  } 
  
  // Otherwise, assume it's in the user's timezone
  // This ensures we correctly handle the user's local time selection
  console.log(`Date has no timezone info, assuming ${userTimezone}: ${dateString}`);
  const localDateTime = dateTime.setZone(userTimezone);
  const utcDateTime = localDateTime.toUTC();
  
  console.log(`Converted local time to UTC: ${utcDateTime.toString()}`);
  return utcDateTime.toJSDate();
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { variantId, bookingData, provider: requestedProvider = 'lemonsqueezy', storePendingBooking } = body;
    
    // Validate required fields
    if (!variantId) {
      return NextResponse.json(
        { error: 'Missing variant ID' },
        { status: 400 }
      );
    }
    
    console.log('Checkout API: Processing request for variant', variantId, 'with provider', requestedProvider);
    
    // Normalize provider name to prevent case issues
    const paymentProvider = String(requestedProvider).toLowerCase().trim();
    
    let checkoutUrl = '';
    let orderId = '';
    
    // Based on the requested provider, create checkout
    if (paymentProvider === 'polar') {
      // Create Polar checkout
      const polarResponse = await createPolarCheckout(variantId, bookingData);
      checkoutUrl = polarResponse.checkoutUrl;
      orderId = polarResponse.orderId;
    } else {
      // Default: Create LemonSqueezy checkout
      const lemonResponse = await createLemonSqueezyCheckout(variantId, bookingData);
      checkoutUrl = lemonResponse.checkoutUrl;
      orderId = lemonResponse.orderId;
      
      // For LemonSqueezy, create a pending booking record immediately
      if (bookingData && bookingData.userEmail) {
        try {
          const supabase = await createClient();
          
          // Extract booking data
          const userEmail = bookingData.userEmail;
          const frequency = bookingData.bookingPlan?.frequency || BookingFrequency.Once;
          const userTimezone = bookingData.selectedTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
          
          console.log('Checkout API: Creating pending booking record for LemonSqueezy', {
            userEmail,
            frequency,
            orderId,
            hasBookingDate: !!bookingData.selectedDate
          });
          
          // Create a payments status record first
          const { data: paymentStatus, error: paymentStatusError } = await supabase
            .from('gvt_coach_payments_status')
            .insert({
              status: PaymentOrderStatus.Pending,
              updated_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              json_data: { checkout_order_id: orderId, provider: 'lemonsqueezy' }
            })
            .select('id')
            .single();
            
          if (paymentStatusError) {
            console.error('Checkout API: Error creating payment status record:', paymentStatusError);
          } else if (paymentStatus) {
            console.log('Checkout API: Created payment status record:', paymentStatus.id);
            
            // Create a mapping between the checkout order ID and payment status
            const { error: mappingError } = await supabase
              .from('gvt_coach_checkout_mapping')
              .insert({
                checkout_order_id: orderId,
                payment_status_id: paymentStatus.id,
                provider: 'lemonsqueezy'
              });
              
            if (mappingError) {
              console.error('Checkout API: Error creating checkout mapping:', mappingError);
            } else {
              console.log('Checkout API: Created checkout mapping');
            }
            
            // Only create a booking record if we have a booking date
            if (bookingData.selectedDate) {
              // Handle date conversion in a consistent way
              let bookingDateTime: Date;
              
              // Logging detallado para diagnóstico
              console.log('🔎 Checkout API - Datos de fecha recibidos:', {
                selectedDate: bookingData.selectedDate,
                utcDate: bookingData.utcDate,
                timezone: userTimezone,
                formato_selectedDate: bookingData.selectedDate ? 
                  (bookingData.selectedDate.endsWith('Z') ? 'UTC' : 
                   (bookingData.selectedDate.includes('+') || bookingData.selectedDate.includes('-') ? 'Con offset' : 'Sin zona')
                  ) : 'No hay fecha',
                formato_utcDate: bookingData.utcDate ? 
                  (bookingData.utcDate.endsWith('Z') ? 'UTC' : 
                   (bookingData.utcDate.includes('+') || bookingData.utcDate.includes('-') ? 'Con offset' : 'Sin zona')
                  ) : 'No hay fecha UTC'
              });
              
              if (bookingData.utcDate) {
                // Si tenemos una fecha UTC, priorizar esta
                console.log(`✓ Checkout API: Encontrada fecha UTC: ${bookingData.utcDate}`);
                
                // Validar y convertir a UTC si es necesario
                const utcDateTime = DateTime.fromISO(bookingData.utcDate);
                
                if (!utcDateTime.isValid) {
                  console.error(`❌ Error: Formato inválido de fecha UTC: ${bookingData.utcDate}`);
                  bookingDateTime = new Date(); // Fallback a fecha actual
                } 
                // Si ya tiene Z al final, está en UTC
                else if (bookingData.utcDate.endsWith('Z')) {
                  console.log(`👉 Usando fecha UTC directamente: ${bookingData.utcDate}`);
                  bookingDateTime = utcDateTime.toJSDate();
                } 
                // Si tiene offset explícito, convertir a UTC
                else if (bookingData.utcDate.includes('+') || 
                        (bookingData.utcDate.includes('-') && bookingData.utcDate.indexOf('T') < bookingData.utcDate.lastIndexOf('-'))) {
                  console.log(`👉 Convirtiendo fecha con offset a UTC: ${bookingData.utcDate}`);
                  bookingDateTime = utcDateTime.toUTC().toJSDate();
                }
                // Sin zona horaria, asumir UTC
                else {
                  console.log(`👉 Fecha sin zona, asumiendo UTC: ${bookingData.utcDate}`);
                  bookingDateTime = utcDateTime.toJSDate();
                }
              } 
              // Si no hay fecha UTC pero hay selectedDate
              else if (bookingData.selectedDate) {
                console.log(`⚠️ No hay fecha UTC, usando selectedDate: ${bookingData.selectedDate}`);
                
                try {
                  // Convertir a formato ISO si es posible
                  const dateTime = DateTime.fromISO(bookingData.selectedDate);
                  
                  if (!dateTime.isValid) {
                    throw new Error(`Formato inválido: ${bookingData.selectedDate}`);
                  }
                  
                  // Si tiene offset explícito o Z, normalizar a UTC
                  if (bookingData.selectedDate.endsWith('Z')) {
                    console.log(`👉 La fecha seleccionada ya está en UTC: ${bookingData.selectedDate}`);
                    bookingDateTime = dateTime.toJSDate();
                  }
                  else if (bookingData.selectedDate.includes('+') || 
                         (bookingData.selectedDate.includes('-') && bookingData.selectedDate.indexOf('T') < bookingData.selectedDate.lastIndexOf('-'))) {
                    console.log(`👉 Convirtiendo fecha con offset a UTC: ${bookingData.selectedDate}`);
                    bookingDateTime = dateTime.toUTC().toJSDate();
                  }
                  // Sin offset, asumir que está en la zona horaria del usuario
                  else {
                    console.log(`👉 Convirtiendo fecha sin zona a UTC desde ${userTimezone}: ${bookingData.selectedDate}`);
                    const localDateTime = dateTime.setZone(userTimezone);
                    bookingDateTime = localDateTime.toUTC().toJSDate();
                  }
                } catch (error) {
                  console.error(`❌ Error procesando fecha seleccionada: ${error}`);
                  bookingDateTime = new Date(); // Fallback a fecha actual
                }
              } 
              // No hay fechas, crear fecha actual
              else {
                console.log(`❌ Sin datos de fecha, usando fecha actual`);
                bookingDateTime = new Date();
              }
              
              // Log final para verificación
              const finalDateTime = DateTime.fromJSDate(bookingDateTime).toUTC();
              console.log('✅ Checkout API - Fecha final (UTC):', {
                iso: bookingDateTime.toISOString(),
                formateada: finalDateTime.toFormat('yyyy-MM-dd HH:mm:ss'),
                hora: finalDateTime.hour,
                minuto: finalDateTime.minute,
                dia: finalDateTime.day, 
                mes: finalDateTime.month,
                unix_timestamp: finalDateTime.toMillis()
              });
              
              // Ensure the ISO string ends with 'Z' to explicitly indicate UTC
              const bookingDateISOString = bookingDateTime.toISOString();
              
              const { error: bookingError } = await supabase
                .from('gvt_coach_meetings_bookings')
                .insert({
                  user_email: userEmail,
                  frequency: frequency,
                  booking_date: bookingDateISOString, // This will include the Z suffix
                  checkout_order_id: orderId,
                  payment_status: PaymentOrderStatus.Pending,
                  checkout_completed: false,
                  payment_confirmed: false,
                  user_timezone: userTimezone,
                  duration: 1 // Default to 1 hour
                });
                
              if (bookingError) {
                console.error('Checkout API: Error creating booking record:', bookingError);
              } else {
                console.log('Checkout API: Created pending booking record with checkout_order_id:', orderId);
              }
            } else {
              console.log('Checkout API: No booking date provided, skipping booking record creation');
            }
          }
        } catch (dbError) {
          console.error('Checkout API: Error creating database records:', dbError);
          // Don't fail the checkout process if database operations fail
        }
      }
    }
    
    // If the request includes the storePendingBooking flag, include booking data
    // This enables the success page to recover booking information if needed
    if (bookingData && storePendingBooking) {
      // Add the orderId to the response to store in localStorage
      const responseDataWithId = {
        checkoutUrl,
        orderId,
        provider: paymentProvider,
        checkoutOrderId: orderId // Include the temp ID for LemonSqueezy
      };
      
      // Return success with the checkout URL
      return NextResponse.json(responseDataWithId);
    } else {
      // Return success with just the checkout URL
      return NextResponse.json({
        checkoutUrl,
        orderId,
        provider: paymentProvider
      });
    }
  } catch (error) {
    console.error('Checkout API: Unexpected error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 