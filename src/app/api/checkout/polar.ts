import { getRequestOrigin } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';
import { Polar } from '@polar-sh/sdk';
import { supabase } from '@/lib/supabase/client';

// Define a type for the booking data structure
interface BookingData {
  userEmail?: string;
  booking?: {
    id?: string | number;
  };
  customFields?: Record<string, any>;
  // Add other potential fields if known
}

/**
 * Get a configured Polar client
 */
function getPolarClient(apiKey: string, sandbox: boolean = true): Polar {

  return new Polar({
    accessToken: apiKey,
    server: sandbox ? 'sandbox' : undefined
  });
}

export async function POST(req: NextRequest) {
  try {
    // Apply the specific type here
    const { variantId, bookingData }: { variantId: string, bookingData: BookingData } = await req.json();
    
    if (!variantId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    
    console.log('Creating Polar checkout for variant:', variantId);
    
    const checkoutResult = await createPolarCheckout(variantId, bookingData);
    
    return NextResponse.json({
      checkoutUrl: checkoutResult.checkoutUrl,
      orderId: checkoutResult.orderId
    });
  } catch (error) {
    console.error('Error in Polar checkout endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create Polar checkout', 
        details: error instanceof Error ? error.message : String(error) 
      }, 
      { status: 500 }
    );
  }
}

export async function createPolarCheckout(productId: string, bookingData: BookingData): Promise<{ checkoutUrl: string, orderId: string }> {
  // Usar las variables de entorno existentes
  const isSandbox = process.env.NEXT_PUBLIC_ENV !== 'production';
  const polarAccessToken = isSandbox 
    ? process.env.GVT_COACH_POLAR_SANDBOX_ACCESS_TOKEN 
    : process.env.GVT_COACH_POLAR_PRODUCTION_ACCESS_TOKEN;
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  // Loguear la configuración para debugging
  console.log('Polar checkout configuration:', {
    isSandbox,
    hasToken: !!polarAccessToken,
    tokenPrefix: polarAccessToken?.substring(0, 10),
    environment: process.env.NEXT_PUBLIC_ENV
  });
  
  if (!polarAccessToken) {
    throw new Error('Polar API credentials not configured: Missing access token');
  }
  
  // Inicializar el cliente de Polar con el token y especificando si es sandbox
  const polarClient = getPolarClient(polarAccessToken, isSandbox);

  try {
    // Crear una URL de éxito con el ID de checkout
    // IMPORTANTE: Según la documentación de Polar, el formato correcto es checkout_id={CHECKOUT_ID}
    // El placeholder {CHECKOUT_ID} será reemplazado por Polar con el ID real
    const successUrlTemplate = `${appUrl}/payment/success?checkout_order_id={CHECKOUT_ID}`;
    
    console.log('Preparing Polar checkout with success URL template:', successUrlTemplate);
    
    // Preparar metadatos evitando tipos problemáticos
    const safeMetadata: Record<string, string> = {
      product_id: productId,
      // Use optional chaining and nullish coalescing for safety
      user_email: bookingData?.userEmail ?? '', 
    };
    
    // Si hay ID de booking, asegurarse que sea string con al menos un carácter
    // Use optional chaining and check if id exists and is not null/undefined
    if (bookingData?.booking?.id != null) { 
      safeMetadata.booking_id = String(bookingData.booking.id);
    }
    
    // Add custom metadata if needed
    const customMetadata: Record<string, string> = {};
    if (bookingData.customFields) {
        for (const _key in bookingData.customFields) {
            if (Object.prototype.hasOwnProperty.call(bookingData.customFields, _key)) {
                // const value = bookingData.customFields[_key]; // If value is unused too, remove
            }
        }
    }
    
    const checkout = await polarClient.checkouts.create({
      successUrl: successUrlTemplate,
      productId: productId,
      allowDiscountCodes: false,
      // Use optional chaining and nullish coalescing
      customerEmail: bookingData?.userEmail ?? '',
      metadata: { ...safeMetadata, ...customMetadata }
    });

    // Obtener el ID y URL del checkout
    const polarOrderId = checkout.id;
    const checkoutUrl = checkout.url;
    
    console.log('Polar checkout created with ID:', polarOrderId);
    console.log('Returning checkout URL:', checkoutUrl);
    
    // Add mapping to supabase
    try {
      const { data: paymentStatus, error: paymentStatusError } = await supabase
        .from('gvt_coach_payments_status')
        .insert({
          status: 'PENDING',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          json_data: { polar_order_id: polarOrderId, provider: 'polar' }
        })
        .select('id')
        .single();

      if (paymentStatusError) throw paymentStatusError;

      const { error: mappingError } = await supabase
        .from('gvt_coach_checkout_mapping')
        .insert({
          checkout_order_id: polarOrderId,
          payment_status_id: paymentStatus.id,
          provider: 'polar'
        });

      if (mappingError) throw mappingError;
      
      // Optionally create pending booking here if needed for Polar
      // Example: You might call a function similar to how LemonSqueezy does
      // await createPendingBookingRecord(supabase, polarOrderId, bookingData, paymentStatus.id, 'polar');
      
      // console.log('Database records created for Polar order:', polarOrderId);

    } catch (dbError) {
      console.error('Error creating DB records for Polar order:', dbError);
      // Decide if this should prevent checkout creation
    }

    return {
      checkoutUrl,
      orderId: polarOrderId
    };
  } catch (error) {
    console.error('Error creating Polar checkout:', error);
    throw error;
  }
}

export async function createPolarCheckoutSession({
  variantId,
  server = '',
  metadata = {},
}: {
  variantId: string;
  server?: string;
  metadata?: Record<string, string>;
}) {
  const isSandbox = process.env.NEXT_PUBLIC_ENV !== 'production';
  const polarAccessToken = isSandbox 
    ? process.env.GVT_COACH_POLAR_SANDBOX_ACCESS_TOKEN 
    : process.env.GVT_COACH_POLAR_PRODUCTION_ACCESS_TOKEN;
  
  if (!polarAccessToken) {
    throw new Error('Polar API credentials not configured: Missing access token');
  }
  
  // Inicializar el cliente de Polar con el token y especificando si es sandbox
  const polarClient = getPolarClient(polarAccessToken, isSandbox);
  
  // Use the variant ID directly
  const productId = variantId;
  
  console.log('Creating Polar checkout session with product ID:', productId);
  
  try {
    // Simplificar metadatos para evitar problemas de tipo
    const safeMetadata: Record<string, string> = {
      product_id: productId,
      ...Object.fromEntries(
        Object.entries(metadata).filter(([_key, v]) => typeof v === 'string' && v.length > 0)
      )
    };
    
    // Usar el formato correcto para la URL de éxito con {CHECKOUT_ID}
    const successUrlTemplate = `${getRequestOrigin(server)}/payment/success?checkout_order_id={CHECKOUT_ID}`;
    
    const checkoutSession = await polarClient.checkouts.create({
      productId: productId,
      successUrl: successUrlTemplate,
      allowDiscountCodes: false,
      metadata: safeMetadata
    });
    
    return checkoutSession;
  } catch (error: unknown) {
    if (error instanceof Error && 
        error.message.includes('expired, revoked, malformed, or invalid')) {
      console.error('TOKEN ERROR: Your Polar access token is invalid. Please regenerate a new token.');
      throw new Error('Authentication failed with Polar API - token is invalid. Please contact the administrator.');
    }
    
    console.error('Error creating Polar checkout session:', error);
    throw error;
  }
}