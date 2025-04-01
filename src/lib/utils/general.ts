import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { DateTime } from 'luxon'
import { BookingFrequency } from '@/types/enums';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const bookingSummaryTexts = {
  once: (dateTime: DateTime, time: string) => {
    if (!dateTime || !dateTime.isValid) return "One-time session";
    return `One-time meeting on ${dateTime.toFormat('EEEE, MMMM d, yyyy')} at ${time}`;
  },
  weekly: (dateTime: DateTime, time: string, duration?: number | null) => {
    if (!dateTime || !dateTime.isValid) return `Weekly sessions`;
    return `Every ${dateTime.toFormat('EEEE')} at ${time} from ${dateTime.toFormat('MMMM d, yyyy')} until ${dateTime.plus({ months: duration! }).toFormat('MMMM d, yyyy')}`;
  },
  twiceWeekly: (firstDateTime: DateTime, secondDateTime: DateTime) => {
    if (!firstDateTime || !firstDateTime.isValid || !secondDateTime || !secondDateTime.isValid) 
      return "Twice-weekly sessions";
    
    const formatTimeWithMidnightCheck = (dt: DateTime) => {
      return dt.hour === 0 && dt.minute === 0 ? "00:00" : dt.toFormat('hh:mm a');
    };
    
    return `Every ${firstDateTime.toFormat('EEEE')} at ${formatTimeWithMidnightCheck(firstDateTime)} and ${secondDateTime.toFormat('EEEE')} at ${formatTimeWithMidnightCheck(secondDateTime)}`;
  }
}

export function getBookingSummary(
  startDate: Date | string,
  frequency: BookingFrequency = BookingFrequency.Once,
  duration?: number | null,
  includeTime: boolean = true,
  timezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
  secondDate?: Date | string
) {
  // Handle null/undefined startDate
  if (!startDate) {
    return frequency === BookingFrequency.Once 
      ? "One-time session" 
      : frequency === BookingFrequency.Weekly
        ? `Weekly sessions`
        : "Twice-weekly sessions";
  }

  let firstDateTime: DateTime;
  
  try {
    // More robust date parsing
    if (typeof startDate === 'string') {
      // Try parsing as ISO first
      firstDateTime = DateTime.fromISO(startDate);
      
      // If that fails, try from other formats
      if (!firstDateTime.isValid) {
        firstDateTime = DateTime.fromFormat(startDate, "yyyy-MM-dd HH:mm:ss");
      }
      
      // If timezone is specified, try to set it only if date is valid
      if (firstDateTime.isValid && timezone) {
        try {
          firstDateTime = firstDateTime.setZone(timezone);
        } catch (e) {
          console.warn("Failed to set timezone, using local timezone instead:", e);
        }
      }
    } else {
      // For JavaScript Date objects
      try {
        // Convert to ISO string first to avoid timezone issues
        const isoString = startDate.toISOString();
        firstDateTime = DateTime.fromISO(isoString);
        
        // Only attempt to set timezone if the date is valid
        if (firstDateTime.isValid && timezone) {
          try {
            firstDateTime = firstDateTime.setZone(timezone);
          } catch (e) {
            console.warn("Failed to set timezone on JS Date, using local timezone instead:", e);
          }
        }
      } catch (e) {
        console.error("Failed to convert JS Date to DateTime:", e);
        firstDateTime = DateTime.local(); // Fallback to current date
        throw new Error("Invalid date");
      }
    }
      
    // Check if the parsed date is valid
    if (!firstDateTime.isValid) {
      console.error("Invalid date parsed:", startDate);
      throw new Error("Invalid date");
    }
  } catch (error) {
    console.error("Error parsing date:", error);
    // Return fallback text based on frequency
    return frequency === BookingFrequency.Once 
      ? "One-time session" 
      : frequency === BookingFrequency.Weekly
        ? `Weekly sessions`
        : "Twice-weekly sessions";
  }

  if (!includeTime) return '';

  try {
    switch (frequency) {
      case BookingFrequency.Once:
        return bookingSummaryTexts.once(
          firstDateTime, 
          firstDateTime.hour === 0 && firstDateTime.minute === 0 ? "00:00" : firstDateTime.toFormat('hh:mm a')
        );
      case BookingFrequency.Weekly:
        return bookingSummaryTexts.weekly(
          firstDateTime, 
          firstDateTime.hour === 0 && firstDateTime.minute === 0 ? "00:00" : firstDateTime.toFormat('hh:mm a'), 
          duration
        );
      case BookingFrequency.TwiceWeekly:
        if (!secondDate) {
          return "Twice-weekly sessions";
        }
        
        let secondDateTime: DateTime;
        try {
          if (typeof secondDate === 'string') {
            // Try parsing as ISO first
            secondDateTime = DateTime.fromISO(secondDate);
            
            // If that fails, try from other formats
            if (!secondDateTime.isValid) {
              secondDateTime = DateTime.fromFormat(secondDate, "yyyy-MM-dd HH:mm:ss");
            }
            
            // Set timezone only if date is valid
            if (secondDateTime.isValid && timezone) {
              try {
                secondDateTime = secondDateTime.setZone(timezone);
              } catch (e) {
                console.warn("Failed to set timezone on second date, using local timezone instead:", e);
              }
            }
          } else {
            // For JavaScript Date objects
            try {
              const isoString = secondDate.toISOString();
              secondDateTime = DateTime.fromISO(isoString);
              
              // Set timezone only if date is valid
              if (secondDateTime.isValid && timezone) {
                try {
                  secondDateTime = secondDateTime.setZone(timezone);
                } catch (e) {
                  console.warn("Failed to set timezone on second JS Date, using local timezone instead:", e);
                }
              }
            } catch (e) {
              console.error("Failed to convert second JS Date to DateTime:", e);
              secondDateTime = firstDateTime.plus({ days: 3 }); // Fallback
              throw new Error("Invalid second date");
            }
          }
            
          if (!secondDateTime.isValid) {
            throw new Error("Invalid second date");
          }
        } catch (error) {
          console.error("Error parsing second date:", error);
          return "Twice-weekly sessions";
        }
        
        return bookingSummaryTexts.twiceWeekly(firstDateTime, secondDateTime);
      default:
        return '';
    }
  } catch (error) {
    console.error("Error formatting booking summary:", error);
    return frequency === BookingFrequency.Once 
      ? "One-time session" 
      : frequency === BookingFrequency.Weekly
        ? `Weekly sessions`
        : "Twice-weekly sessions";
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
    if (server.includes('gvt.academy')) {
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