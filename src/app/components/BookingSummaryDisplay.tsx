'use client'

import { DateTime } from 'luxon'
import { BookingFrequency } from '@/app/types/booking'
import { getBookingSummary } from '@/lib/utils'

interface BookingSummaryDisplayProps {
  booking: {
    id?: string
    frequency: BookingFrequency
    duration?: number
    firstSlot?: { date: Date }
    secondSlot?: { date: Date }
    booking_date?: string
    second_booking_date?: string | null
    recurring_day?: string
    recurring_time?: string
    end_date?: string
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
    const secondDate = booking.second_booking_date 
      ? DateTime.fromISO(booking.second_booking_date).setZone(timezone).toJSDate()
      : booking.secondSlot?.date;

    if (!secondDate) return null;

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <p>{getBookingSummary(date, 'twice-weekly', null, true, timezone, secondDate)}</p>
          <p>Duration: {booking.duration} {booking.duration === 1 ? 'month' : 'months'}</p>
          <p>Starting from {DateTime.fromJSDate(date).toFormat('MMMM d, yyyy')}</p>
          <p>Ending on {DateTime.fromJSDate(date).plus({ months: booking.duration || 0 }).toFormat('MMMM d, yyyy')}</p>
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