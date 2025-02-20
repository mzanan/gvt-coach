'use client'

import { DateTime } from 'luxon'
import { BookingFrequency } from '@/app/types/booking'
import { getBookingSummary } from '@/lib/utils'

interface BookingSummaryDisplayProps {
  booking: {
    id?: string
    booking_date: string
    frequency: BookingFrequency
    end_date?: string
    duration?: number
    firstSlot?: { date: Date }
    secondSlot?: { date: Date }
    second_booking_date?: string | null
    recurring_day?: string
    recurring_time?: string
    meet_link?: string
    status?: string
    user_email?: string
  } | null
  timezone: string
}

export function BookingSummaryDisplay({ booking, timezone }: BookingSummaryDisplayProps) {
  if (!booking) return null;

  const date = booking.booking_date 
    ? DateTime.fromISO(booking.booking_date).setZone(timezone).toJSDate()
    : booking.firstSlot?.date;

  if (!date) return null;

  if (booking.frequency === 'twice-weekly') {
    const firstDateTime = DateTime.fromISO(booking.booking_date).setZone(timezone);
    const secondDate = firstDateTime.plus({ days: 3 }).toJSDate();
    const endDate = DateTime.fromISO(booking.end_date!).setZone(timezone);

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <p>{getBookingSummary(
            firstDateTime.toJSDate(), 
            'twice-weekly', 
            booking.duration, 
            true, 
            timezone, 
            secondDate
          )}</p>
          <p>Duration: {booking.duration} {booking.duration === 1 ? 'month' : 'months'}</p>
          <p>Starting from {firstDateTime.toFormat('MMMM d, yyyy')}</p>
          <p>Ending on {endDate.plus({ days: 3 }).toFormat('MMMM d, yyyy')}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {getBookingSummary(date, booking.frequency, booking.duration, true, timezone)}
    </div>
  );
}