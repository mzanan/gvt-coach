import { BookingFrequency } from '@/types/enums'
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

  if (booking.booking_date) {
    let formattedDate = '';
    let formattedTime = '';

    try {
      if (booking.booking_date) {
        const bookingDate = typeof booking.booking_date === 'string'
          ? booking.booking_date
          : booking.booking_date.toISOString();

        const userTimezone = booking.user_timezone || timezone;

        let localDateTime;

        try {
          const dateTime = DateTime.fromISO(bookingDate);

          if (dateTime.isValid) {
            localDateTime = dateTime.setZone(userTimezone);
          } else {
            const sqlDateTime = DateTime.fromSQL(bookingDate);

            if (sqlDateTime.isValid) {
              localDateTime = sqlDateTime.setZone(userTimezone);
            } else {
              const utcDateTime = DateTime.fromFormat(bookingDate, "yyyy-MM-dd HH:mm:ss+00", { zone: "UTC" });
              localDateTime = utcDateTime.setZone(userTimezone);
            }
          }
        } catch {
          const jsDate = new Date(bookingDate);
          localDateTime = DateTime.fromJSDate(jsDate).setZone(userTimezone);
        }

        if (!localDateTime || !localDateTime.isValid) {
          throw new Error(`Invalid date: ${bookingDate}`);
        }

        formattedDate = localDateTime.toFormat('EEEE, MMMM d, yyyy');
        formattedTime = localDateTime.hour === 0 && localDateTime.minute === 0
          ? "00:00hs"
          : localDateTime.toFormat('h:mm a');
      }
    } catch {
      try {
        const bookingDate = typeof booking.booking_date === 'string'
          ? booking.booking_date
          : booking.booking_date.toISOString();

        const bookingSummary = getBookingSummary(
          bookingDate,
          true,
          timezone
        );

        const dateParts = bookingSummary?.split(' at ');
        if (dateParts && dateParts.length > 1) {
          formattedDate = dateParts[0].replace('One-time meeting on ', '');
          formattedTime = dateParts[1];
        }
      } catch {
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
              <div>One-time session</div>
            </div>
          )}

          {booking.status && booking.status !== 'CONFIRMED' && (
            <div className="flex">
              <div className="min-w-32 font-medium">Status:</div>
              <div>
                {booking.status === 'PENDING' ? (
                  <Badge variant="warning">
                    Payment pending
                  </Badge>
                ) : booking.status === 'CANCELLED' ? (
                  <Badge variant="destructive">
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

  return (
    <div className="space-y-2">
      <p>Your booking has been confirmed.</p>
      <div className="flex">
        <div className="min-w-32 font-medium">Frequency:</div>
        <div>One-time session</div>
      </div>
      <p>You&apos;ll receive details about your scheduled time via email.</p>
    </div>
  );
}
