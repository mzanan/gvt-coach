'use client'

import { BookingFrequency } from '@/types/enums/booking'
import { getBookingSummary } from '@/lib/utils'
import { Badge } from '@/app/components/ui-kit/badge'
import { DateTime } from 'luxon'

interface BookingSummaryDisplayProps {
  booking: {
    id?: string
    booking_date?: string | Date
    frequency?: BookingFrequency | string
    duration?: number
    status?: string
    user_email?: string
    user_timezone?: string
  } | null
  timezone: string
}

export interface BookingSummaryResult {
  formattedDate: string;
  formattedTime: string;
}

export function BookingSummaryDisplay({ booking, timezone }: BookingSummaryDisplayProps) {
  if (!booking) {
    return (
      <div className="text-center py-4">
        <p>No booking information available.</p>
      </div>
    );
  }

  // If booking has a date, show full details
  if (booking.booking_date) {
    // Extract formatted date and time
    let formattedDate = '';
    let formattedTime = '';
    
    try {
      if (booking.booking_date) {
        const bookingDate = typeof booking.booking_date === 'string' 
          ? booking.booking_date 
          : booking.booking_date.toISOString();

        // PRIORITY: Always use the user's timezone from props or booking
        const userTimezone = booking.user_timezone || timezone;
        
        // Parse date with improved detection for all formats
        let localDateTime;
        
        try {
          // First attempt: handle with DateTime.fromISO which handles most ISO formats
          const dateTime = DateTime.fromISO(bookingDate);
          
          if (dateTime.isValid) {
            // If it parsed correctly and has zone info, convert to user timezone
            localDateTime = dateTime.setZone(userTimezone);
          } else {
            // Second attempt: try SQL format with offset "2025-04-01 18:00:00+00"
            const sqlDateTime = DateTime.fromSQL(bookingDate);
            
            if (sqlDateTime.isValid) {
              localDateTime = sqlDateTime.setZone(userTimezone);
            } else {
              // Third attempt: try parsing as UTC and then convert
              const utcDateTime = DateTime.fromFormat(bookingDate, "yyyy-MM-dd HH:mm:ss+00", { zone: "UTC" });
              localDateTime = utcDateTime.setZone(userTimezone);
            }
          }
        } catch {
          // Final fallback: just parse it as a regular JS date and hope for the best
          const jsDate = new Date(bookingDate);
          localDateTime = DateTime.fromJSDate(jsDate).setZone(userTimezone);
        }
        
        if (!localDateTime || !localDateTime.isValid) {
          throw new Error(`Invalid date: ${bookingDate}`);
        }
        
        // Format date and time in user's timezone
        formattedDate = localDateTime.toFormat('EEEE, MMMM d, yyyy');
        // Check if it's midnight and use "00:00hs" instead of "12:00 AM"
        formattedTime = localDateTime.hour === 0 && localDateTime.minute === 0 
          ? "00:00hs" 
          : localDateTime.toFormat('h:mm a');
      }
    } catch {
      // Fallback to the previous implementation
      try {
        const bookingDate = typeof booking.booking_date === 'string' 
          ? booking.booking_date 
          : booking.booking_date.toISOString();
          
        const bookingSummary = getBookingSummary(
          bookingDate,
          (booking.frequency || BookingFrequency.Once) as BookingFrequency,
          booking.duration,
          true,
          timezone
        );
        
        // Basic formatting for date and time
        const dateParts = bookingSummary?.split(' at ');
        if (dateParts && dateParts.length > 1) {
          formattedDate = dateParts[0].replace('One-time meeting on ', '');
          formattedTime = dateParts[1];
        }
      } catch {
        // Silent error handling
      }
    }
    
    return (
      <div className="space-y-3">
        <div className="flex flex-col space-y-2">
          <div className="flex">
            <div className="min-w-32 font-medium">Date:</div>
            <div data-testid="booking-date">{formattedDate || 'Date not available'}</div>
          </div>
          
          <div className="flex">
            <div className="min-w-32 font-medium">Time:</div>
            <div data-testid="booking-time">{formattedTime || 'Time not available'}</div>
          </div>

          {booking.frequency && (
            <div className="flex">
              <div className="min-w-32 font-medium">Frequency:</div>
              <div>
                {booking.frequency === BookingFrequency.Once ? (
                  <>One-time session</>
                ) : booking.frequency === BookingFrequency.Weekly ? (
                  <>Weekly sessions</>
                ) : (
                  <>Twice weekly sessions</>
                )}
              </div>
            </div>
          )}

          {booking.status && booking.status !== 'CONFIRMED' && (
            <div className="flex">
              <div className="min-w-32 font-medium">Status:</div>
              <div>
                {booking.status === 'PENDING' ? (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-600 hover:bg-yellow-50">
                    Payment pending
                  </Badge>
                ) : booking.status === 'CANCELLED' ? (
                  <Badge variant="outline" className="bg-red-50 text-red-600 hover:bg-red-50">
                    Cancelled
                  </Badge>
                ) : (
                  <>{booking.status}</>
                )}
              </div>
            </div>
          )}
          
          {!booking.user_timezone && (
            <div className="flex">
              <div className="min-w-32 font-medium">Timezone:</div>
              <div data-testid="booking-timezone">
                {timezone || 'Couldn&apos;t determine timezone'}
              </div>
            </div>
          )}
          
          {booking.user_timezone && (
            <div className="flex">
              <div className="min-w-32 font-medium">Timezone:</div>
              <div data-testid="booking-timezone">
                {booking.user_timezone || 'Couldn&apos;t determine timezone'}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // If no date, show minimal info
  return (
    <div className="space-y-2">
      <p>Your booking has been confirmed.</p>
      <div className="flex">
        <div className="min-w-32 font-medium">Frequency:</div>
        <div>
          {booking.frequency === BookingFrequency.Once ? (
            <>One-time session</>
          ) : booking.frequency === BookingFrequency.Weekly ? (
            <>Weekly sessions</>
          ) : (
            <>Twice weekly sessions</>
          )}
        </div>
      </div>
      <p>You&apos;ll receive details about your scheduled time via email.</p>
    </div>
  );
}