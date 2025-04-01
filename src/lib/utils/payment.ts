import { getClientCookie } from './cookies'


/**
 * Get user data from cookies
 */
export function getUserDataFromCookies(): { 
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

  // Get user profile from cookies
  const userData = getClientCookie('user_data');
  if (userData) {
    try {
      if (userData && userData.email) {
        result.userEmail = userData.email;
        
        // Set name using different possible formats
        if (userData.first_name && userData.last_name) {
          result.userName = `${userData.first_name} ${userData.last_name}`.trim();
        } else if (userData.name) {
          result.userName = userData.name;
        } else {
          // Fallback to email username
          result.userName = userData.email.split('@')[0];
        }
        
        // Get timezone if available
        if (userData.timezone) {
          result.timezone = userData.timezone;
        }
        
        // Get orderId if available - new field we added
        if (userData.orderId) {
          result.orderId = userData.orderId;
          console.log("Retrieved orderId from user_data cookie:", userData.orderId);
        }
        
        return result;
      }
    } catch (e) {
      console.error("Error parsing user profile:", e);
    }
  }

  // Also check for booking data in a cookie
  const pendingBookingData = getClientCookie('pending_booking');
  if (pendingBookingData) {
    try {
      if (pendingBookingData.userEmail) {
        result.userEmail = pendingBookingData.userEmail;
      } else if (pendingBookingData.booking && pendingBookingData.booking.user_email) {
        result.userEmail = pendingBookingData.booking.user_email;
      }
      
      // Get timezone and orderId if available
      if (pendingBookingData.selectedTimezone) {
        result.timezone = pendingBookingData.selectedTimezone;
      }
      
      if (pendingBookingData.orderId) {
        result.orderId = pendingBookingData.orderId;
        console.log("Retrieved orderId from pending_booking cookie:", pendingBookingData.orderId);
      }
    } catch (e) {
      console.error("Error parsing pending booking:", e);
    }
  }

  return result;
} 