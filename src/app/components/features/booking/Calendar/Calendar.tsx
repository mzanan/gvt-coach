'use client'

import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui-kit/button'
import { DateTime } from 'luxon'
import { CoachId } from '@/config/coaches'
import { useCalendar } from './useCalendar'

interface CalendarProps {
  onSelectDate: (date: Date) => void
  selectedDate: Date | null
  bookedDates: Array<{ date: Date, fullyBooked: boolean }>
  selectedTimezone: string
  selectedCoach: CoachId
}

// Componente de día memoizado para evitar renderizados innecesarios
const CalendarDay = React.memo(({ 
  date, 
  isCurrentMonth, 
  isSelected, 
  isSuggestedDate, 
  isDisabled, 
  onClick 
}: { 
  date: DateTime, 
  isCurrentMonth: boolean, 
  isSelected: boolean, 
  isSuggestedDate: boolean, 
  isDisabled: boolean, 
  onClick: () => void 
}) => (
  <button
    className={cn(
      "h-9 w-9 rounded-md p-0 font-normal flex items-center justify-center mx-auto",
      // Base styles for days from other months
      !isCurrentMonth && "text-muted-foreground",
      // Additional opacity for disabled days from other months
      !isCurrentMonth && isDisabled && "opacity-50",
      // Keep hover effects for enabled days from other months
      !isCurrentMonth && !isDisabled && "hover:bg-accent hover:text-accent-foreground",
      // Selected state overrides other styles
      isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
      isSuggestedDate && "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
      // Disabled state
      isDisabled && "pointer-events-none opacity-50",
      // Hover for current month enabled days
      !isSelected && !isSuggestedDate && !isDisabled && isCurrentMonth && "hover:bg-accent hover:text-accent-foreground"
    )}
    disabled={isDisabled}
    onClick={onClick}
    tabIndex={isDisabled ? -1 : 0} // Allow focus on days outside current month if selectable
  >
    {date.day}
  </button>
));
CalendarDay.displayName = 'CalendarDay';

export function Calendar(props: CalendarProps) {
  // Use the hook to get state and callbacks
  const {
    currentMonth,
    days,
    goToPreviousMonth,
    goToNextMonth,
    isPreviousMonthDisabled,
    isSelected,
    isSuggestedDate,
    isDisabled,
    isCurrentMonth,
    handleDateSelect
  } = useCalendar(props); // Pass all props to the hook

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={goToPreviousMonth}
          disabled={isPreviousMonthDisabled}
          className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Previous month</span>
        </Button>
        <h3 className="text-sm font-medium">
          {currentMonth.toFormat('MMMM yyyy')}
        </h3>
        <Button
          variant="ghost"
          onClick={goToNextMonth}
          className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Next month</span>
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs leading-6 text-muted-foreground">
        <div className="flex items-center justify-center">Sun</div>
        <div className="flex items-center justify-center">Mon</div>
        <div className="flex items-center justify-center">Tue</div>
        <div className="flex items-center justify-center">Wed</div>
        <div className="flex items-center justify-center">Thu</div>
        <div className="flex items-center justify-center">Fri</div>
        <div className="flex items-center justify-center">Sat</div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {days.map((date, index) => (
          <CalendarDay
            key={`${date.toFormat('yyyy-MM-dd')}-${index}`}
            date={date}
            isCurrentMonth={isCurrentMonth(date)}
            isSelected={isSelected(date)}
            isSuggestedDate={isSuggestedDate(date)}
            isDisabled={isDisabled(date)}
            onClick={() => handleDateSelect(date)}
          />
        ))}
      </div>
    </div>
  )
} 