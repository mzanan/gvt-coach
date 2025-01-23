import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { DateTime } from 'luxon'
import { BookingFrequency } from '@/app/types/booking'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getBookingSummary(
  startDate: Date | string,
  frequency: BookingFrequency = 'once',
  duration?: number | null,
  includeTime: boolean = true,
  timezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
) {
  const start = typeof startDate === 'string' 
    ? DateTime.fromISO(startDate).setZone(timezone, { keepLocalTime: true })
    : DateTime.fromJSDate(startDate).setZone(timezone, { keepLocalTime: true })
    
  const endDate = duration 
    ? start.plus({ months: duration }) 
    : null
    
  const time = start.toFormat('hh:mm a')
  const fullDate = start.toFormat('EEEE, MMMM d, yyyy')

  switch (frequency) {
    case 'once':
      return `One-time meeting on ${fullDate}${includeTime ? ` at ${time}` : ''}`
    case 'weekly':
      return endDate 
        ? `Every ${start.toFormat('EEEE')} at ${time} from ${start.toFormat('MMMM d, yyyy')} until ${endDate.toFormat('MMMM d, yyyy')}`
        : `Weekly meetings every ${start.toFormat('EEEE')}${includeTime ? ` at ${time}` : ''}`
    case 'twice-weekly':
      return endDate 
        ? `Every ${start.toFormat('EEEE')} and ${start.plus({ days: 2 }).toFormat('EEEE')} at ${time} from ${start.toFormat('MMMM d, yyyy')} until ${endDate.toFormat('MMMM d, yyyy')}`
        : `Twice-weekly meetings every ${start.toFormat('EEEE')} and ${start.plus({ days: 2 }).toFormat('EEEE')}${includeTime ? ` at ${time}` : ''}`
    default:
      return ''
  }
}
