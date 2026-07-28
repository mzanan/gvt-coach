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
      "mx-auto flex aspect-square w-full max-w-12 items-center justify-center rounded-md p-0 font-normal",
      !isCurrentMonth && "text-muted-foreground",
      !isCurrentMonth && isDisabled && "opacity-50",
      !isCurrentMonth && !isDisabled && "hover:bg-accent hover:text-accent-foreground",
      isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
      isSuggestedDate && "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
      isDisabled && "pointer-events-none opacity-50",
      !isSelected && !isSuggestedDate && !isDisabled && isCurrentMonth && "hover:bg-accent hover:text-accent-foreground"
    )}
    disabled={isDisabled}
    onClick={onClick}
    tabIndex={isDisabled ? -1 : 0}
  >
    {date.day}
  </button>
));
CalendarDay.displayName = 'CalendarDay';

export function Calendar(props: CalendarProps) {
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
  } = useCalendar(props);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPreviousMonth}
          disabled={isPreviousMonthDisabled}
          className="opacity-60 hover:opacity-100"
        >
          <ChevronLeft />
          <span className="sr-only">Previous month</span>
        </Button>
        <h3 className="text-sm font-medium">
          {currentMonth.toFormat('MMMM yyyy')}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextMonth}
          className="opacity-60 hover:opacity-100"
        >
          <ChevronRight />
          <span className="sr-only">Next month</span>
        </Button>
      </div>
      <div className="-mx-2 grid grid-cols-7 gap-0 text-center text-xs leading-6 text-muted-foreground">
        <div className="flex items-center justify-center">Sun</div>
        <div className="flex items-center justify-center">Mon</div>
        <div className="flex items-center justify-center">Tue</div>
        <div className="flex items-center justify-center">Wed</div>
        <div className="flex items-center justify-center">Thu</div>
        <div className="flex items-center justify-center">Fri</div>
        <div className="flex items-center justify-center">Sat</div>
      </div>
      <div className="-mx-2 grid grid-cols-7 gap-0 text-center text-sm">
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