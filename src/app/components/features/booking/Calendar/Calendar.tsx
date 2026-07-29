'use client'

import { Calendar as CalendarPrimitive } from '@/app/components/ui-kit/calendar'
import { CoachId } from '@/config/coaches'
import { useCalendar } from './useCalendar'

interface CalendarProps {
  onSelectDate: (date: Date) => void
  selectedDate: Date | null
  bookedDates: Array<{ date: Date, fullyBooked: boolean }>
  selectedTimezone: string
  selectedCoach: CoachId
}

export function Calendar(props: CalendarProps) {
  const {
    month,
    setMonth,
    earliestMonth,
    selected,
    isDayDisabled,
    handleSelect
  } = useCalendar(props);

  return (
    <CalendarPrimitive
      mode="single"
      month={month}
      onMonthChange={setMonth}
      startMonth={earliestMonth}
      selected={selected}
      onSelect={handleSelect}
      disabled={isDayDisabled}
    />
  )
}
