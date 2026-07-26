import Stripe from 'stripe';
import { BookingFrequency } from '@/types/enums';
import { CoachId } from '@/config/coaches';
import { CoachConfig } from '@/types/coach';
import { getEffectiveCoachesConfig } from '@/config/appConfig';

interface StripeBookingData {
  userEmail?: string;
  bookingPlan?: {
    coach?: CoachId;
    frequency?: BookingFrequency;
  };
}

const FREQUENCY_PRICE_KEY: Record<BookingFrequency, keyof CoachConfig['prices']> = {
  [BookingFrequency.Once]: 'singleSession',
  [BookingFrequency.Weekly]: 'weekly',
  [BookingFrequency.TwiceWeekly]: 'twiceWeekly',
};

const FREQUENCY_LABEL: Record<BookingFrequency, string> = {
  [BookingFrequency.Once]: 'Single Session',
  [BookingFrequency.Weekly]: 'Weekly',
  [BookingFrequency.TwiceWeekly]: 'Twice Weekly',
};

function getStripeClient(): Stripe {
  const secretKey = process.env.GVT_COACH_STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('Stripe API credentials not configured: Missing GVT_COACH_STRIPE_SECRET_KEY');
  }

  return new Stripe(secretKey);
}

export async function createStripeCheckout(bookingData: StripeBookingData): Promise<{ checkoutUrl: string, orderId: string }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error('Application URL configuration is missing. Please set NEXT_PUBLIC_APP_URL.');
  }

  const coach = bookingData.bookingPlan?.coach;
  const coachesConfig = await getEffectiveCoachesConfig();

  if (!coach || !(coach in coachesConfig)) {
    throw new Error(`Invalid or missing coach for Stripe checkout: ${coach}`);
  }

  const frequency = bookingData.bookingPlan?.frequency || BookingFrequency.Once;
  const coachConfig = coachesConfig[coach];
  const price = coachConfig.prices[FREQUENCY_PRICE_KEY[frequency]];

  if (!price || price <= 0) {
    throw new Error(`No price configured for coach ${coach} and frequency ${frequency}`);
  }

  const stripe = getStripeClient();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Coaching Session with ${coachConfig.displayName} (${FREQUENCY_LABEL[frequency]})`,
          },
          unit_amount: price * 100,
        },
        quantity: 1,
      },
    ],
    customer_email: bookingData.userEmail || undefined,
    success_url: `${appUrl}/payment/success?checkout_order_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/payment/cancel`,
    metadata: {
      coach,
      frequency,
      user_email: bookingData.userEmail ?? '',
    },
  });

  if (!session.url) {
    throw new Error('Stripe checkout session created without a URL');
  }

  return {
    checkoutUrl: session.url,
    orderId: session.id,
  };
}
