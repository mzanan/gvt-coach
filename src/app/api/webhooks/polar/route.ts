import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks'
import { PaymentOrderStatus } from '@/types/enums'
import { fulfillPaidBookings } from '@/services/bookingFulfillment'
import {
  getMappingByOrderId,
  getPaymentStatusByOrderId,
  getPaymentStatusById,
  insertPaymentStatus,
  updatePaymentStatus,
  upsertMapping
} from '@/lib/db/payments'

interface PolarWebhookData {
  product_id?: string;
  id?: string;
  checkout_id?: string;
  metadata?: {
    checkoutOrderId?: string;
    [key: string]: unknown;
  };
  customer_email?: string;
  email?: string;
  status?: string;
  customer?: {
    email?: string;
  };
  payment_intent?: string;
  amount?: number;
  currency?: string;
  [key: string]: unknown;
}

interface WebhookPayload {
  type?: string;
  data?: PolarWebhookData | Record<string, unknown>;
  [key: string]: unknown;
}

export async function POST(request: Request) {
  try {
    const webhookSecret = process.env.GVT_COACH_POLAR_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('[ERROR] Polar webhook - Missing GVT_COACH_POLAR_WEBHOOK_SECRET');
      return new Response(JSON.stringify({ error: 'Webhook not configured' }), { status: 500 });
    }

    const rawBody = await request.text();
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    let body: WebhookPayload;
    try {
      body = validateEvent(rawBody, headers, webhookSecret) as WebhookPayload;
    } catch (verificationError) {
      if (verificationError instanceof WebhookVerificationError) {
        console.error('[ERROR] Polar webhook - Signature verification failed');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 403 });
      }
      throw verificationError;
    }

    const response = new Response(JSON.stringify({ message: 'Webhook received' }), {
      status: 202,
    });

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

async function processWebhookEvent(body: WebhookPayload) {
  try {
    const logId = Math.random().toString(36).substring(2, 8);
    const eventType: string = body.type || '';

    const RELEVANT_EVENTS = ['checkout.created', 'order.created', 'order.completed'];
    if (!RELEVANT_EVENTS.includes(eventType)) {
      return;
    }

    const data: PolarWebhookData = body.data || body;

    let productId = '';
    let checkoutId = '';
    let orderId = '';
    let metadataCheckoutOrderId = '';
    let userEmail = '';
    let paymentStatus = PaymentOrderStatus.Pending;

    if (eventType === 'checkout.created') {
      productId = data.product_id ?? '';
      checkoutId = data.id ?? '';
      metadataCheckoutOrderId = data.metadata?.checkoutOrderId ?? '';
      userEmail = data.customer_email ?? data.email ?? '';
      if (data.status === 'open') {
        paymentStatus = PaymentOrderStatus.Pending;
      }
    } else if (eventType === 'order.created' || eventType === 'order.completed') {
      productId = data.product_id ?? '';
      orderId = data.id ?? '';
      checkoutId = data.checkout_id ?? '';
      metadataCheckoutOrderId = data.metadata?.checkoutOrderId ?? '';
      userEmail = data.customer?.email ?? data.email ?? '';
      if (eventType === 'order.created' || eventType === 'order.completed') {
        paymentStatus = PaymentOrderStatus.Paid;
      }
    }

    const checkoutOrderId = checkoutId || orderId || metadataCheckoutOrderId || productId;
    if (!checkoutOrderId) {
      console.error(`[${logId}] Polar Webhook - No valid ID found`);
      return;
    }

    const mappingData = await getMappingByOrderId(checkoutOrderId);

    let existingPayment = null;
    let paymentId: string | null = null;

    if (mappingData?.payment_status_id) {
      existingPayment = await getPaymentStatusById(mappingData.payment_status_id);
      paymentId = mappingData.payment_status_id;
    }

    if (!existingPayment) {
      if (eventType === 'checkout.created' || eventType === 'order.created' || eventType === 'order.completed') {
        try {
          const newPayment = await insertPaymentStatus({
            status: paymentStatus,
            checkout_order_id: checkoutOrderId,
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
          });
          paymentId = newPayment.id;
        } catch (error) {
          if (!String(error).includes('UNIQUE constraint failed')) throw error;

          const concurrentPayment = await getPaymentStatusByOrderId(checkoutOrderId);
          if (!concurrentPayment) throw error;

          const alreadyPaid = concurrentPayment.status === PaymentOrderStatus.Paid && paymentStatus === PaymentOrderStatus.Pending;

          if (!alreadyPaid && concurrentPayment.status !== paymentStatus) {
            const jsonData = (concurrentPayment.json_data && typeof concurrentPayment.json_data === 'object')
              ? concurrentPayment.json_data as Record<string, unknown>
              : {};

            await updatePaymentStatus(concurrentPayment.id, {
              status: paymentStatus,
              json_data: {
                ...jsonData,
                status: paymentStatus,
                provider: 'polar',
                payment_intent: data.payment_intent ?? '',
                amount: data.amount ?? 0,
                currency: data.currency ?? '',
                customer_email: data.customer_email ?? '',
                updated_at: new Date().toISOString()
              }
            });
          }

          paymentId = concurrentPayment.id;
        }
      } else {
        return;
      }
    } else {
      if (existingPayment.status === PaymentOrderStatus.Paid && paymentStatus === PaymentOrderStatus.Pending) {
        return;
      }

      if (existingPayment.status !== paymentStatus) {
        const jsonData = (existingPayment.json_data && typeof existingPayment.json_data === 'object')
          ? existingPayment.json_data as Record<string, unknown>
          : {};

        const updatedJsonData = {
          ...jsonData,
          status: paymentStatus,
          provider: 'polar',
          payment_intent: data.payment_intent ?? '',
          amount: data.amount ?? 0,
          currency: data.currency ?? '',
          customer_email: data.customer_email ?? '',
          updated_at: new Date().toISOString()
        };

        await updatePaymentStatus(existingPayment.id, {
          status: paymentStatus,
          json_data: updatedJsonData
        });
      }

      paymentId = existingPayment.id;
    }

    if (paymentId) {
      await upsertMapping({
        checkout_order_id: checkoutOrderId,
        payment_status_id: paymentId,
        provider: 'polar',
        payment_order_id: checkoutOrderId
      });
    }

    if ((eventType === 'order.created' || eventType === 'order.completed') && paymentStatus === PaymentOrderStatus.Paid) {
      await fulfillPaidBookings(checkoutOrderId, logId);
    }
  } catch (error) {
    console.error('Polar Webhook - Process webhook error:', error);
  }
}
