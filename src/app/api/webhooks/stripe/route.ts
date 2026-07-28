import Stripe from 'stripe';
import { PaymentOrderStatus } from '@/types/enums';
import { fulfillPaidBookings } from '@/services/bookingFulfillment';
import { updateBooking, getBookingsByOrderId } from '@/lib/db/bookings';
import {
  getMappingByOrderId,
  getPaymentStatusByOrderId,
  getPaymentStatusById,
  insertPaymentStatus,
  updatePaymentStatus,
  upsertMapping
} from '@/lib/db/payments';

export async function POST(request: Request) {
  const logId = Math.random().toString(36).substring(2, 8);

  try {
    const secretKey = process.env.GVT_COACH_STRIPE_SECRET_KEY;
    const webhookSecret = process.env.GVT_COACH_STRIPE_WEBHOOK_SECRET;

    if (!secretKey || !webhookSecret) {
      console.error(`[${logId}] Stripe Webhook - Missing Stripe credentials in environment`);
      return new Response(JSON.stringify({ error: 'Webhook not configured' }), { status: 500 });
    }

    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), { status: 400 });
    }

    const rawBody = await request.text();
    const stripe = new Stripe(secretKey);

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (verificationError) {
      console.error(`[${logId}] Stripe Webhook - Signature verification failed:`, verificationError);
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(session, logId);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    console.error(`[${logId}] Stripe Webhook - Error processing webhook:`, error);
    return new Response(JSON.stringify({ error: 'Error processing webhook' }), { status: 500 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, logId: string) {
  const checkoutOrderId = session.id;

  const mapping = await getMappingByOrderId(checkoutOrderId);

  const jsonData = {
    event_type: 'checkout.session.completed',
    checkout_order_id: checkoutOrderId,
    customer_email: session.customer_details?.email ?? session.customer_email ?? '',
    amount: session.amount_total ?? 0,
    currency: session.currency ?? '',
    payment_intent: typeof session.payment_intent === 'string' ? session.payment_intent : '',
    status: PaymentOrderStatus.Paid,
    provider: 'stripe',
    updated_at: new Date().toISOString()
  };

  let paymentId: string;

  if (mapping?.payment_status_id) {
    const existingPayment = await getPaymentStatusById(mapping.payment_status_id);

    if (existingPayment && existingPayment.status !== PaymentOrderStatus.Paid) {
      const existingJson = (existingPayment.json_data && typeof existingPayment.json_data === 'object')
        ? existingPayment.json_data as Record<string, unknown>
        : {};
      await updatePaymentStatus(existingPayment.id, {
        status: PaymentOrderStatus.Paid,
        json_data: { ...existingJson, ...jsonData }
      });
    }

    paymentId = mapping.payment_status_id;
  } else {
    try {
      const newPayment = await insertPaymentStatus({
        status: PaymentOrderStatus.Paid,
        checkout_order_id: checkoutOrderId,
        json_data: jsonData
      });
      paymentId = newPayment.id;
    } catch (error) {
      if (!String(error).includes('UNIQUE constraint failed')) throw error;

      const concurrentPayment = await getPaymentStatusByOrderId(checkoutOrderId);
      if (!concurrentPayment) throw error;

      if (concurrentPayment.status !== PaymentOrderStatus.Paid) {
        const existingJson = (concurrentPayment.json_data && typeof concurrentPayment.json_data === 'object')
          ? concurrentPayment.json_data as Record<string, unknown>
          : {};
        await updatePaymentStatus(concurrentPayment.id, {
          status: PaymentOrderStatus.Paid,
          json_data: { ...existingJson, ...jsonData }
        });
      }

      paymentId = concurrentPayment.id;
    }
  }

  await upsertMapping({
    checkout_order_id: checkoutOrderId,
    payment_status_id: paymentId,
    provider: 'stripe',
    payment_order_id: checkoutOrderId
  });

  const bookings = await getBookingsByOrderId(checkoutOrderId);
  for (const booking of bookings) {
    await updateBooking(booking.id, {
      payment_status: PaymentOrderStatus.Paid,
      payment_confirmed: true,
      checkout_completed: true
    });
  }

  await fulfillPaidBookings(checkoutOrderId, logId);
}
