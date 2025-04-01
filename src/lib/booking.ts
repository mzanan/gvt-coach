import { BookingFrequency as SuperbaseBookingFrequency } from '@/types/enums'
import { BookingFrequency as AppBookingFrequency } from '@/types/enums'

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