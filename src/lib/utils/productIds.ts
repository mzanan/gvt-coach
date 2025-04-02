// src/lib/utils/productIds.ts
import { BookingFrequency } from '@/types/enums';
import { CoachId } from '@/config/coaches';

// Helper function to get the correct Lemon Squeezy variant ID for a coach and frequency
export function getLemonSqueezyVariantId(coachId: CoachId, frequency: BookingFrequency): string | null {
  if (frequency !== BookingFrequency.Once) {
    console.warn(`Lemon Squeezy only supports 'Once' frequency for now. Requested: ${frequency}`);
    return null; // Or handle other frequencies if needed
  }

  switch (coachId) {
    case 'MATIAS':
      return process.env.NEXT_PUBLIC_GVT_COACH_LEMONSQUEEZY_MATIAS_PRODUCT_ID || null;
    case 'GABRIEL':
      return process.env.NEXT_PUBLIC_GVT_COACH_LEMONSQUEEZY_GABRIEL_PRODUCT_ID || null;
    default:
      // Log error if coach ID is unknown or not handled
      console.error(`No Lemon Squeezy variant ID configured for coach: ${coachId}`);
      // Optionally, you could throw an error or return a default/fallback ID
      return null;
  }
}

// Helper function to get the correct Polar product ID for a coach
export function getPolarProductId(coachId: CoachId): string | null {
  // Assuming Polar products might represent the coach directly, not frequency yet
  switch (coachId) {
    case 'MATIAS':
      return process.env.NEXT_PUBLIC_GVT_COACH_POLAR_MATIAS_PRODUCT_ID || null;
    case 'GABRIEL':
      return process.env.NEXT_PUBLIC_GVT_COACH_POLAR_GABRIEL_PRODUCT_ID || null;
    default:
      // Log error if coach ID is unknown or not handled
      console.error(`No Polar product ID configured for coach: ${coachId}`);
      // Optionally, you could throw an error or return a default/fallback ID
      return null;
  }
}