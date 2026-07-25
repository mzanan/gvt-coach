import { lemonSqueezyService } from './lemonsqueezy';
import { polarService } from './polar';
import { stripeService } from './stripe';
import { PaymentProviderService } from '@/types/payment';

const PROVIDERS: Record<string, PaymentProviderService> = {
  stripe: stripeService,
  polar: polarService,
  lemonsqueezy: lemonSqueezyService,
};

const selectedProvider = process.env.NEXT_PUBLIC_GVT_COACH_PAYMENT_PROVIDER || 'stripe';

export const paymentService: PaymentProviderService = PROVIDERS[selectedProvider] || stripeService;
