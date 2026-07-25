import { getRequestOrigin } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';
import { Polar } from '@polar-sh/sdk';
import { insertPaymentStatus, upsertMapping } from '@/lib/db/payments';

interface BookingData {
  userEmail?: string;
  booking?: {
    id?: string | number;
  };
  customFields?: Record<string, unknown>;
}

function getPolarClient(apiKey: string, sandbox: boolean = true): Polar {
  return new Polar({
    accessToken: apiKey,
    server: sandbox ? 'sandbox' : undefined
  });
}

export async function POST(req: NextRequest) {
  try {
    // Apply the specific type here, assuming BookingData is correct
    const { variantId, bookingData }: { variantId: string, bookingData: BookingData } = await req.json();

    if (!variantId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const checkoutResult = await createPolarCheckout(variantId, bookingData);
    
    return NextResponse.json({
      checkoutUrl: checkoutResult.checkoutUrl,
      orderId: checkoutResult.orderId
    });
  } catch (error: unknown) { // Use unknown
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
  const isSandbox = process.env.NEXT_PUBLIC_ENV !== 'production';
  const polarAccessToken = isSandbox
    ? process.env.GVT_COACH_POLAR_SANDBOX_ACCESS_TOKEN
    : process.env.GVT_COACH_POLAR_PRODUCTION_ACCESS_TOKEN;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    console.error('Missing NEXT_PUBLIC_APP_URL environment variable.');
    throw new Error('Application URL configuration is missing.');
  }

  if (!polarAccessToken) {
    console.error('Polar Access Token is missing in environment variables.');
    throw new Error('Polar API credentials not configured: Missing access token');
  }
  
  const polarClient = getPolarClient(polarAccessToken, isSandbox);

  try {
    const successUrlTemplate = `${appUrl}/payment/success?checkout_order_id={CHECKOUT_ID}`;
    
    console.log('Preparing Polar checkout with success URL template:', successUrlTemplate);
    
    const safeMetadata: Record<string, string> = {
      product_id: productId,
      user_email: bookingData?.userEmail ?? '', 
    };
    
    if (bookingData?.booking?.id != null) { 
      safeMetadata.booking_id = String(bookingData.booking.id);
    }
    
    const customMetadata: Record<string, string> = {};
    if (bookingData.customFields) {
        Object.assign(customMetadata, bookingData.customFields);
    }
    
    const checkout = await polarClient.checkouts.create({
      successUrl: successUrlTemplate,
      productId: productId,
      allowDiscountCodes: false,
      customerEmail: bookingData?.userEmail ?? '',
      metadata: { ...safeMetadata, ...customMetadata }
    });

    const polarOrderId = checkout.id;
    const checkoutUrl = checkout.url;
    
    console.log('Polar checkout created with ID:', polarOrderId);
    console.log('Returning checkout URL:', checkoutUrl);
    
    try {
      const paymentStatus = await insertPaymentStatus({
        status: 'PENDING',
        json_data: { polar_order_id: polarOrderId, provider: 'polar' }
      });

      await upsertMapping({
        checkout_order_id: polarOrderId,
        payment_status_id: paymentStatus.id,
        provider: 'polar'
      });
    } catch (dbError) {
      console.error('Error creating DB records for Polar order:', dbError);
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
  
  const polarClient = getPolarClient(polarAccessToken, isSandbox);
  const productId = variantId;
  
  console.log('Creating Polar checkout session with product ID:', productId);
  
  try {
    const safeMetadata: Record<string, string> = {
      product_id: productId,
      ...Object.fromEntries(
        Object.entries(metadata).filter(([, v]) => typeof v === 'string' && v.length > 0)
      )
    };
    
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