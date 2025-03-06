import { BookingFrequency as SuperbaseBookingFrequency } from '@/app/types/enums/booking'
import { BookingFrequency as AppBookingFrequency } from '@/app/types/booking'

// Helper function to convert between BookingFrequency types
export function convertBookingFrequency(frequency: SuperbaseBookingFrequency): AppBookingFrequency {
  switch (frequency) {
    case SuperbaseBookingFrequency.Once:
      return 'once';
    case SuperbaseBookingFrequency.Weekly:
      return 'weekly';
    case SuperbaseBookingFrequency.TwiceWeekly:
      return 'twice-weekly';
    default:
      return 'once'; // Default fallback
  }
} 