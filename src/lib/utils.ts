import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { DateTime } from 'luxon'
import { BookingFrequency } from '@/app/types/booking'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const bookingSummaryTexts = {
  once: (dateTime: DateTime, time: string) => 
    `One-time meeting on ${dateTime.toFormat('EEEE, MMMM d, yyyy')} at ${time}`,
  weekly: (dateTime: DateTime, time: string, duration?: number | null) => 
    `Every ${dateTime.toFormat('EEEE')} at ${time} from ${dateTime.toFormat('MMMM d, yyyy')} until ${dateTime.plus({ months: duration! }).toFormat('MMMM d, yyyy')}`,
  twiceWeekly: (firstDateTime: DateTime, secondDateTime: DateTime) => 
    `Every ${firstDateTime.toFormat('EEEE')} at ${firstDateTime.toFormat('hh:mm a')} and ${secondDateTime.toFormat('EEEE')} at ${secondDateTime.toFormat('hh:mm a')}`
}

export function getBookingSummary(
  startDate: Date | string,
  frequency: BookingFrequency = 'once',
  duration?: number | null,
  includeTime: boolean = true,
  timezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
  secondDate?: Date | string
) {
  const firstDateTime = typeof startDate === 'string' 
    ? DateTime.fromISO(startDate).setZone(timezone)
    : DateTime.fromJSDate(startDate).setZone(timezone)
  
  if (!includeTime) return '';

  switch (frequency) {
    case 'once':
      return bookingSummaryTexts.once(firstDateTime, firstDateTime.toFormat('hh:mm a'))
    case 'weekly':
      return bookingSummaryTexts.weekly(firstDateTime, firstDateTime.toFormat('hh:mm a'), duration)
    case 'twice-weekly':
      if (!secondDate) return ''
      const secondDateTime = typeof secondDate === 'string'
        ? DateTime.fromISO(secondDate).setZone(timezone)
        : DateTime.fromJSDate(secondDate).setZone(timezone)
      return bookingSummaryTexts.twiceWeekly(firstDateTime, secondDateTime)
    default:
      return ''
  }
}
