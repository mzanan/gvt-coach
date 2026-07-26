'use client';

export function setClientCookie(name: string, value: unknown, days = 365) {
  if (typeof window === 'undefined') return;

  try {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    let stringValue = '';

    if (typeof value === 'string') {
      stringValue = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      stringValue = value.toString();
    } else {
      try {
        stringValue = JSON.stringify(value);
      } catch {
        stringValue = String(value);
      }
    }

    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/;`;
    document.cookie = `${name}=${encodeURIComponent(stringValue)};${expires};path=/;`;
  } catch {
  }
}

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
          const parsedValue = JSON.parse(rawValue);
          return parsedValue;
        } catch {
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

export function deleteClientCookie(name: string) {
  if (typeof window === 'undefined') return;

  try {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/;`;
  } catch {
  }
}

export const USER_DATA_COOKIE = 'user_data';

export const setTimezoneCookie = (timezone: string) => {
  if (typeof window === 'undefined') return timezone;

  try {
    const userData = getClientCookie(USER_DATA_COOKIE) || {};
    userData.timezone = timezone;
    setClientCookie(USER_DATA_COOKIE, userData, 365);
    return timezone;
  } catch (error) {
    console.error('Error setting timezone in user_data cookie:', error);
    return timezone;
  }
};

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
