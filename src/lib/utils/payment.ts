import { getClientCookie } from './cookies'

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

  const userData = getClientCookie('user_data');
  if (userData) {
    try {
      if (userData && userData.email) {
        result.userEmail = userData.email;

        if (userData.first_name && userData.last_name) {
          result.userName = `${userData.first_name} ${userData.last_name}`.trim();
        } else if (userData.name) {
          result.userName = userData.name;
        } else {
          result.userName = userData.email.split('@')[0];
        }

        if (userData.timezone) {
          result.timezone = userData.timezone;
        }

        if (userData.orderId) {
          result.orderId = userData.orderId;
        }

        return result;
      }
    } catch (e) {
      console.error('Error parsing user profile:', e);
    }
  }

  const pendingBookingData = getClientCookie('pending_booking');
  if (pendingBookingData) {
    try {
      if (pendingBookingData.userEmail) {
        result.userEmail = pendingBookingData.userEmail;
      } else if (pendingBookingData.booking && pendingBookingData.booking.user_email) {
        result.userEmail = pendingBookingData.booking.user_email;
      }

      if (pendingBookingData.selectedTimezone) {
        result.timezone = pendingBookingData.selectedTimezone;
      }

      if (pendingBookingData.orderId) {
        result.orderId = pendingBookingData.orderId;
      }
    } catch (e) {
      console.error('Error parsing pending booking:', e);
    }
  }

  return result;
}
