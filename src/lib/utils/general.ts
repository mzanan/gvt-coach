import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { DateTime } from 'luxon'
import { SITE_CONFIG } from '@/config/site'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const bookingSummaryTexts = {
  once: (dateTime: DateTime, time: string) => {
    if (!dateTime || !dateTime.isValid) return "One-time session";
    return `One-time meeting on ${dateTime.toFormat('EEEE, MMMM d, yyyy')} at ${time}`;
  },
}

export function getBookingSummary(
  startDate: Date | string,
  includeTime: boolean = true,
  timezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
): string {
  if (!startDate) {
    return "One-time session";
  }

  let dateTime: DateTime;
  try {
    if (typeof startDate === 'string') {
      dateTime = DateTime.fromISO(startDate);
    } else {
      dateTime = DateTime.fromJSDate(startDate);
    }
    if (timezone) {
      dateTime = dateTime.setZone(timezone);
    }
    if (!dateTime.isValid) throw new Error("Invalid date");
  } catch (error) {
    console.error("Error parsing date:", error);
    return "One-time session";
  }

  if (!includeTime) return '';

  try {
    const time = dateTime.hour === 0 && dateTime.minute === 0 ? "00:00" : dateTime.toFormat('hh:mm a');
    return bookingSummaryTexts.once(dateTime, time);
  } catch (error) {
    console.error("Error formatting booking summary:", error);
    return "One-time session";
  }
}

/**
 * Gets the origin URL based on the server parameter or environment.
 * Prioritizes NEXT_PUBLIC_APP_URL environment variable.
 * Throws an error if NEXT_PUBLIC_APP_URL is not defined and no valid server parameter is provided.
 * @param server Optional server parameter to determine the environment
 * @returns The origin URL for the current environment
 */
export function getRequestOrigin(server = ''): string {
  // Check if a server parameter was provided and use it if valid
  if (server) {
    if (server.includes(SITE_CONFIG.productionHost)) {
      return `https://${server}`;
    }
    // Allow localhost or explicit http/https for the server parameter
    if (server.startsWith('localhost') || server.startsWith('http')) {
      return server.startsWith('http') ? server : `http://${server}`;
    }
    // If server param is provided but not recognized, proceed to env var check
  }
  
  // If no valid server parameter, require NEXT_PUBLIC_APP_URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    console.error('Configuration Error: NEXT_PUBLIC_APP_URL environment variable is not defined.');
    throw new Error('Application URL configuration is missing. Please set NEXT_PUBLIC_APP_URL.');
  }
  
  return appUrl;
}

// Format date without time (moved from Calendar.tsx)
export function formatDateWithoutTime(date: Date): string {
  return DateTime.fromJSDate(date).toFormat('yyyy-MM-dd');
} 