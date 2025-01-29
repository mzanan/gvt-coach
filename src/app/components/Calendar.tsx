'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BookingFrequency } from '../types/booking'
import { Button } from '@/components/ui/button'
import { DateTime } from 'luxon'

interface CalendarProps {
  onSelectDate: (date: Date) => void
  onConfirmDates: (firstDate: Date, secondDate: Date) => void
  selectedDate: Date | null
  bookedDates: Array<{ date: Date, fullyBooked: boolean }>
  frequency?: BookingFrequency
  suggestedDate?: Date | null
  selectedTimezone: string
}

export function Calendar({ 
  onSelectDate, 
  onConfirmDates,
  selectedDate, 
  bookedDates,
  frequency,
  suggestedDate,
  selectedTimezone
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => 
    DateTime.now().setZone(selectedTimezone).startOf('month').toJSDate()
  )

  const getDaysInMonth = (date: Date) => {
    // Convert to DateTime in user's timezone
    const dt = DateTime.fromJSDate(date).setZone(selectedTimezone)
    const year = dt.year
    const month = dt.month

    // Get start and end of month in user's timezone
    const startOfMonth = dt.startOf('month')
    const daysInMonth = dt.daysInMonth || 0
    const firstDayOfMonth = startOfMonth.weekday % 7 // 0-6, Sunday-Saturday

    const days: DateTime[] = []

    // Add days from previous month
    const prevMonth = startOfMonth.minus({ months: 1 })
    const daysInPrevMonth = prevMonth.daysInMonth || 0
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push(prevMonth.set({ day: daysInPrevMonth - i }))
    }

    // Add days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(dt.set({ day }))
    }

    // Add days from next month
    const remainingDays = (7 - (days.length % 7)) % 7
    const extraWeek = 7
    const totalDaysToAdd = remainingDays + extraWeek
    const nextMonth = startOfMonth.plus({ months: 1 })
    
    for (let day = 1; day <= totalDaysToAdd; day++) {
      days.push(nextMonth.set({ day }))
    }

    return days
  }

  const handlePrevMonth = () => {
    setCurrentMonth(DateTime.fromJSDate(currentMonth)
      .setZone(selectedTimezone)
      .minus({ months: 1 })
      .toJSDate()
    )
  }

  const handleNextMonth = () => {
    setCurrentMonth(DateTime.fromJSDate(currentMonth)
      .setZone(selectedTimezone)
      .plus({ months: 1 })
      .toJSDate()
    )
  }

  const isToday = (date: DateTime) => {
    const today = DateTime.now().setZone(selectedTimezone).startOf('day')
    return date.hasSame(today, 'day')
  }

  const isSelected = (date: DateTime) => {
    if (!selectedDate) return false
    const selected = DateTime.fromJSDate(selectedDate)
      .setZone(selectedTimezone)
      .startOf('day')
    const compareDate = date.startOf('day')
    
    return selected.hasSame(compareDate, 'day')
  }

  const isSuggestedDate = (date: DateTime) => {
    if (!suggestedDate) return false
    const suggested = DateTime.fromJSDate(suggestedDate).setZone(selectedTimezone).startOf('day')
    return date.hasSame(suggested, 'day')
  }

  const isDisabled = (date: DateTime) => {
    const today = DateTime.now().setZone(selectedTimezone).startOf('day')
    return date <= today || isFullyBooked(date)
  }

  const isFullyBooked = (date: DateTime) => {
    return bookedDates.some(bookedDate => {
      const bookedDateTime = DateTime.fromJSDate(bookedDate.date)
        .setZone(selectedTimezone)
        .startOf('day')
      return date.hasSame(bookedDateTime, 'day')
    })
  }

  const handleDateSelect = (date: DateTime) => {
    if (!isDisabled(date)) {
      onSelectDate(date.toJSDate())
    }
  }

  const isCurrentMonth = (date: DateTime) => {
    return date.month === DateTime.fromJSDate(currentMonth).setZone(selectedTimezone).month
  }

  const days = getDaysInMonth(currentMonth)

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-accent rounded-md text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="font-semibold text-foreground">
          {DateTime.fromJSDate(currentMonth).setZone(selectedTimezone).toFormat('MMMM yyyy')}
        </h2>
        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-accent rounded-md text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="text-center text-sm font-medium text-muted-foreground p-2"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => (
          <button
            key={date.toISO()}
            onClick={() => handleDateSelect(date)}
            disabled={isDisabled(date)}
            className={cn(
              "p-2 w-full rounded-md text-sm transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              {
                "bg-primary text-primary-foreground": isSelected(date),
                "bg-green-100 text-green-700": isSuggestedDate(date),
                "bg-accent/50": isToday(date),
                "text-muted-foreground cursor-not-allowed": isDisabled(date),
                "text-muted-foreground/50": !isCurrentMonth(date),
                "text-foreground": !isDisabled(date) && !isSelected(date) && !isSuggestedDate(date) && isCurrentMonth(date),
              }
            )}
          >
            {date.day}
          </button>
        ))}
      </div>

      {frequency === 'twice-weekly' && selectedDate && suggestedDate && (
        <Button 
          className="w-full mt-4"
          onClick={() => onConfirmDates(selectedDate, suggestedDate)}
        >
          Confirm Selected Dates
        </Button>
      )}
    </div>
  )
} 