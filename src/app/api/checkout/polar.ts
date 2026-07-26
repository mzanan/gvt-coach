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

export async function createPolarCheckout(productId: string, bookingData: BookingData): Promise<{ checkoutUrl: string, orderId: string }> {
  const isSandbox = process.env.NEXT_PUBLIC_ENV !== 'production';
  const polarAccessToken = isSandbox
    ? process.env.GVT_COACH_POLAR_SANDBOX_ACCESS_TOKEN
    : process.env.GVT_COACH_POLAR_PRODUCTION_ACCESS_TOKEN;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error('Application URL configuration is missing.');
  }

  if (!polarAccessToken) {
    throw new Error('Polar API credentials not configured: Missing access token');
  }

  const polarClient = getPolarClient(polarAccessToken, isSandbox);

  try {
    const successUrlTemplate = `${appUrl}/payment/success?checkout_order_id={CHECKOUT_ID}`;

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
      products: [productId],
      allowDiscountCodes: false,
      customerEmail: bookingData?.userEmail ?? '',
      metadata: { ...safeMetadata, ...customMetadata }
    });

    const polarOrderId = checkout.id;
    const checkoutUrl = checkout.url;

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
