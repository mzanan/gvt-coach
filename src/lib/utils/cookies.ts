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
      } catch (e) {
        // Fallback to simple string if JSON fails
        stringValue = String(value);
      }
    }
    
    // First try to clear any existing cookie with the same name
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/;`;
    
    // Then set the new cookie with proper attributes
    // Note: SameSite=Lax is the default in modern browsers
    document.cookie = `${name}=${encodeURIComponent(stringValue)};${expires};path=/;`;
  } catch (error) {
    // Silent fail
  }
}

// Function to get a cookie in the client
export function getClientCookie(name: string) {
  if (typeof window === 'undefined') return null;
  
  try {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      let cookie = cookies[i].trim();
      if (cookie.indexOf(name + '=') === 0) {
        const encodedValue = cookie.substring(name.length + 1, cookie.length);
        const rawValue = decodeURIComponent(encodedValue);
        
        try {
          // Try to parse as JSON
          return JSON.parse(rawValue);
        } catch (e) {
          // Return as is if it's not JSON
          return rawValue;
        }
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Function to delete a cookie in the client
export function deleteClientCookie(name: string) {
  if (typeof window === 'undefined') return;
  
  try {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/;`;
  } catch (error) {
    // Silent fail
  }
} 