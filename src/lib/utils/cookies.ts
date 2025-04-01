'use client';

/**
 * Client cookie utility functions using native JavaScript
 */

// Function to set a cookie in the client
export function setClientCookie(name: string, value: unknown, days = 365) {
  if (typeof window === 'undefined') return;
  
  try {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    let stringValue = '';
    
    // Ensure value is properly stringified
    if (typeof value === 'string') {
      stringValue = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      stringValue = value.toString();
    } else {
      try {
        stringValue = JSON.stringify(value);
      } catch {
        // Fallback to simple string if JSON fails
        stringValue = String(value);
      }
    }
    
    // First try to clear any existing cookie with the same name
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/;`;
    
    // Then set the new cookie with proper attributes
    // Note: SameSite=Lax is the default in modern browsers
    document.cookie = `${name}=${encodeURIComponent(stringValue)};${expires};path=/;`;
  } catch {
    // Silent fail
  }
}

// Function to get a cookie in the client
export function getClientCookie(name: string) {
  if (typeof window === 'undefined') return null;
  
  try {
    const cookies = document.cookie.split(';');
    
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      
      if (cookie.indexOf(name + '=') === 0) {
        const encodedValue = cookie.substring(name.length + 1, cookie.length);
        const rawValue = decodeURIComponent(encodedValue);
        
        try {
          // Try to parse as JSON
          const parsedValue = JSON.parse(rawValue);
          return parsedValue;
        } catch {
          // Return as is if it's not JSON
          return rawValue;
        }
      }
    }
    return null;
  } catch (error) {
    console.error(`getClientCookie - Error:`, error);
    return null;
  }
}

// Function to delete a cookie in the client
export function deleteClientCookie(name: string) {
  if (typeof window === 'undefined') return;
  
  try {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/;`;
  } catch {
    // Silent fail - No need for error variable here
  }
}

// Add timezone cookie functions to existing file or create new file

// Cookie name for storing user data which includes timezone
export const USER_DATA_COOKIE = 'user_data';

/**
 * Set timezone in user_data cookie
 */
export const setTimezoneCookie = (timezone: string) => {
  if (typeof window === 'undefined') return timezone;
  
  try {
    // Get existing user_data cookie
    const userData = getClientCookie(USER_DATA_COOKIE) || {};
    
    // Update the timezone
    userData.timezone = timezone;
    
    // Save back to cookie
    setClientCookie(USER_DATA_COOKIE, userData, 365);
    return timezone;
  } catch (error) { 
    console.error('Error setting timezone in user_data cookie:', error);
    return timezone;
  }
};

/**
 * Get timezone from user_data cookie or return null
 */
export const getTimezoneCookie = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const userData = getClientCookie(USER_DATA_COOKIE);
    
    if (userData && userData.timezone) {
      return String(userData.timezone);
    }
    
    return null;
  } catch (error) {
    console.error('Error reading timezone from user_data cookie:', error);
    return null;
  }
}; 