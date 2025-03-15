import { BookingFrequency as SuperbaseBookingFrequency } from '@/app/types/enums/booking'
import { BookingFrequency as AppBookingFrequency } from '@/app/types/enums/booking'

/**
 * Helper function to convert between BookingFrequency types
 */
export function convertBookingFrequency(frequency: SuperbaseBookingFrequency): AppBookingFrequency {
  switch (frequency) {
    case SuperbaseBookingFrequency.Once:
      return AppBookingFrequency.Once;
    case SuperbaseBookingFrequency.Weekly:
      return AppBookingFrequency.Weekly;
    case SuperbaseBookingFrequency.TwiceWeekly:
      return AppBookingFrequency.TwiceWeekly;
    default:
      return AppBookingFrequency.Once; // Default fallback
  }
}

/**
 * Get user data from local storage
 */
export function getUserDataFromLocalStorage(): { 
  userEmail: string | null; 
  userName: string | null;
  timezone?: string;
  orderId?: string | null;
} {
  const result: { 
    userEmail: string | null; 
    userName: string | null;
    timezone?: string;
    orderId?: string | null;
  } = {
    userEmail: null,
    userName: null,
    timezone: undefined,
    orderId: undefined
  };
  
  if (typeof window === 'undefined') return result;

  // Get user profile from localStorage
  const userProfileStr = localStorage.getItem('userProfile');
  if (userProfileStr) {
    try {
      const profileData = JSON.parse(userProfileStr);
      const profile = profileData.value; // Profile is inside .value
      
      if (profile && profile.email) {
        result.userEmail = profile.email;
        
        // Set name if available
        if (profile.first_name) {
          const name = `${profile.first_name} ${profile.last_name || ''}`.trim();
          result.userName = name;
        }
        return result;
      }
    } catch (e) {
      console.error("Error parsing user profile:", e);
    }
  }

  // Also check for email in pendingBooking
  const pendingBookingStr = localStorage.getItem('pendingBooking');
  if (pendingBookingStr) {
    try {
      const pendingData = JSON.parse(pendingBookingStr);
      
      if (pendingData.userEmail) {
        result.userEmail = pendingData.userEmail;
      } else if (pendingData.booking && pendingData.booking.user_email) {
        result.userEmail = pendingData.booking.user_email;
      }
      
      // Get timezone and orderId if available
      if (pendingData.selectedTimezone) {
        result.timezone = pendingData.selectedTimezone;
      }
      
      if (pendingData.orderId) {
        result.orderId = pendingData.orderId;
      }
    } catch (e) {
      console.error("Error parsing pending booking:", e);
    }
  }

  return result;
} 