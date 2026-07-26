import { lemonSqueezyService } from './lemonsqueezy';
import { polarService } from './polar';
import { stripeService } from './stripe';
import { disabledPaymentsService } from './disabled';
import { PaymentProviderService } from '@/types/payment';

const PROVIDERS: Record<string, PaymentProviderService> = {
  stripe: stripeService,
  polar: polarService,
  lemonsqueezy: lemonSqueezyService,
  disabled: disabledPaymentsService,
};

export function getPaymentService(provider?: string): PaymentProviderService {
  const fallback = process.env.NEXT_PUBLIC_GVT_COACH_PAYMENT_PROVIDER || 'stripe';
  return PROVIDERS[provider || fallback] || stripeService;
}
