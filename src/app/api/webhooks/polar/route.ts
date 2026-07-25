import { sendBookingConfirmation } from '@/services/mailer'
import { CoachId, COACHES_CONFIG } from '@/config/coaches'
import { PaymentOrderStatus } from '@/types/enums'
import { BookingDB } from '@/types/booking'
import { getBookingsByOrderId, updateBooking } from '@/lib/db/bookings'
import {
  getMappingByOrderId,
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
    const clonedRequest = request.clone();
    const body = await clonedRequest.json();

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
      if (eventType === 'order.created') {
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
      if (eventType === 'checkout.created' || eventType === 'order.created') {
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
      const bookings = await getBookingsByOrderId(checkoutOrderId);

      if (bookings.length > 0) {
        for (const booking of bookings) {
          await createZoomMeetingForBooking(booking, logId);

          try {
            const coachKey = booking.coach as string;
            const coachValue: CoachId | undefined =
              coachKey && Object.prototype.hasOwnProperty.call(COACHES_CONFIG, coachKey)
                ? coachKey as CoachId
                : undefined;

            await sendBookingConfirmation(
              booking.user_email,
              {
                start_time: booking.booking_date,
                end_time: new Date(new Date(booking.booking_date).getTime() + (booking.duration || 60) * 60000),
                zoom_link: booking.meet_link,
                user_name: booking.user_name,
                booking_id: booking.id,
                user_timezone: booking.user_timezone,
                coach: coachValue
              }
            );
          } catch (emailError) {
            console.error(`[${logId}] Error sending confirmation email for booking ${booking.id}:`, emailError);
          }
        }
      } else {
        console.log(`[${logId}] Polar Webhook - No booking record found with checkout_order_id ${checkoutOrderId}`);
      }
    }
  } catch (error) {
    console.error('Polar Webhook - Process webhook error:', error);
  }
}

async function createZoomMeetingForBooking(booking: BookingDB, logId: string) {
  try {
    if (!booking) {
      console.error(`[${logId}] Zoom - Invalid booking object`);
      return;
    }

    if (booking.meet_link) {
      return;
    }

    if (!booking.booking_date || typeof booking.booking_date !== 'string') {
      console.error(`[${logId}] Zoom - Booking ${booking.id} has invalid booking date`);
      return;
    }

    const accountId = process.env.GVT_COACH_ZOOM_ACCOUNT_ID;
    const clientId = process.env.GVT_COACH_ZOOM_CLIENT_ID;
    const clientSecret = process.env.GVT_COACH_ZOOM_CLIENT_SECRET;

    if (!accountId || !clientId || !clientSecret) {
      console.error(`[${logId}] Zoom - Missing Zoom credentials in environment`);
      return;
    }

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

    let meetingTime: Date;
    try {
      meetingTime = new Date(booking.booking_date);
    } catch (dateError) {
      console.error(`[${logId}] Zoom - Error parsing booking date: ${booking.booking_date}`, dateError);
      return;
    }

    const durationMinutes = booking.duration || 60;

    const meetingData = {
      topic: `GVT Coaching Session with ${booking.user_email}`,
      type: 2,
      start_time: meetingTime.toISOString(),
      duration: durationMinutes,
      timezone: booking.user_timezone || 'UTC',
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: true,
        waiting_room: false,
        mute_upon_entry: false,
        auto_recording: 'none',
      },
    };

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

    if (meetingDetails.join_url) {
      const updated = await updateBooking(booking.id, { meet_link: meetingDetails.join_url });

      if (!updated) {
        console.error(`[${logId}] Zoom - Error updating booking with meet link`);
      }
    } else {
      console.error(`[${logId}] Zoom - Meeting created but no join_url in response:`, meetingDetails);
    }
  } catch (error) {
    console.error(`[${logId}] Zoom - General error creating meeting:`, error);
  }
}
