import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"
import { DateTime } from 'luxon'

const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'h': [{ h: ['control', 'control-lg'] }],
      'min-h': [{ 'min-h': ['control'] }],
      'w': [{ w: ['control'] }],
      'max-h': [{ 'max-h': ['dialog-max'] }],
      'size': [{ size: ['control'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return customTwMerge(clsx(inputs))
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
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
