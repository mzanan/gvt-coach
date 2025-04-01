import { lemonSqueezyService } from './lemonsqueezy';
import { polarService } from './polar';
import { PaymentProviderService } from '@/types/payment';

/**
 * Payment service selection based on environment variable
 * NEXT_PUBLIC_GVT_COACH_PAYMENT_PROVIDER can be 'lemonsqueezy' or 'polar'
 */
let selectedPaymentService: PaymentProviderService;

if (process.env.NEXT_PUBLIC_GVT_COACH_PAYMENT_PROVIDER === 'polar') {
  selectedPaymentService = polarService;
  console.log('Using Polar payments provider');
} else {
  // Default to LemonSqueezy
  selectedPaymentService = lemonSqueezyService;
  console.log('Using LemonSqueezy payments provider');
}

export const paymentService = selectedPaymentService; 