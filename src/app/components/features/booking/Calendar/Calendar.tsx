'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BookingFrequency } from '@/types/enums/booking'
import { Button } from '@/app/components/ui-kit/button'
import { DateTime } from 'luxon'
import { Coach, COACHES_CONFIG } from '@/app/config/coaches'

interface CalendarProps {
  onSelectDate: (date: Date) => void
  selectedDate: Date | null
  bookedDates: Array<{ date: Date, fullyBooked: boolean }>
  frequency?: BookingFrequency
  suggestedDate?: Date | null
  selectedTimezone: string
  selectedCoach: Coach
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

export function Calendar({ 
  onSelectDate, 
  selectedDate, 
  bookedDates,
  suggestedDate,
  selectedTimezone,
  selectedCoach
}: CalendarProps) {
  // Initialize current month based purely on user's perspective
  const [currentMonth, setCurrentMonth] = useState(() => {
    // Get current date in user's timezone
    const userNow = DateTime.now().setZone(selectedTimezone);
    return userNow;
  });

  // Memoize days calculation to avoid unnecessary recalculations
  const days = useMemo(() => getDaysInMonth(currentMonth), [currentMonth]);
  
  const goToPreviousMonth = useCallback(() => {
    setCurrentMonth(prev => prev.minus({ months: 1 }));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth(prev => prev.plus({ months: 1 }));
  }, []);

  // Calculate the earliest month the user can navigate back to (current month)
  const earliestMonth = useMemo(() => {
    return DateTime.now().setZone(selectedTimezone).startOf('month');
  }, [selectedTimezone]);

  const isPreviousMonthDisabled = useMemo(() => {
    return currentMonth.startOf('month') <= earliestMonth;
  }, [currentMonth, earliestMonth]);

  const isSelected = useCallback((date: DateTime) => {
    if (!selectedDate) return false;
    const selected = DateTime.fromJSDate(selectedDate)
      .setZone(selectedTimezone)
      .startOf('day');
    const compareDate = date.startOf('day');
    
    return selected.hasSame(compareDate, 'day');
  }, [selectedDate, selectedTimezone]);

  const isSuggestedDate = useCallback((date: DateTime) => {
    if (!suggestedDate) return false;
    const suggested = DateTime.fromJSDate(suggestedDate).setZone(selectedTimezone).startOf('day');
    return date.hasSame(suggested, 'day');
  }, [suggestedDate, selectedTimezone]);

  const isFullyBooked = useCallback((date: DateTime) => {
    return bookedDates.some(bookedDate => {
      const bookedDateTime = DateTime.fromJSDate(bookedDate.date)
        .setZone(selectedTimezone)
        .startOf('day');
      return date.hasSame(bookedDateTime, 'day');
    });
  }, [bookedDates, selectedTimezone]);

  const isDisabled = useCallback((date: DateTime) => {
    // Get current time in coach's timezone (with time, not just date)
    const coachTimezone = COACHES_CONFIG[selectedCoach].timezone;
    const coachNow = DateTime.now().setZone(coachTimezone);
    
    // Convert the calendar date to a datetime in coach timezone for comparison
    const calendarDateInUserTZ = date.setZone(selectedTimezone).startOf('day');
    const calendarDateInCoachTZ = calendarDateInUserTZ.setZone(coachTimezone);
    
    // Check if the date is fully booked
    const isBooked = isFullyBooked(date);
    
    // For any future date beyond today in coach's timezone, it should be enabled
    // This ensures we compare dates properly across timezone boundaries
    const coachToday = coachNow.startOf('day');
    
    // If the date is tomorrow or later in coach timezone, it's bookable (unless booked)
    if (calendarDateInCoachTZ > coachToday) {
      return isBooked;
    }
    
    // Disable today and past dates in coach timezone
    return true;
  }, [selectedTimezone, selectedCoach, isFullyBooked]);

  const isCurrentMonth = useCallback((date: DateTime) => {
    return date.month === currentMonth.month;
  }, [currentMonth]);

  const handleDateSelect = useCallback((date: DateTime) => {
    if (!isDisabled(date)) {
      onSelectDate(date.toJSDate());
    }
  }, [isDisabled, onSelectDate]);

  function getDaysInMonth(date: DateTime) {
    const year = date.year;
    const month = date.month;
    
    const firstDayOfMonth = DateTime.local(year, month, 1);
    const lastDayOfMonth = DateTime.local(year, month, 1).endOf('month');
    
    const daysInMonth = lastDayOfMonth.day;
    const dayOfWeek = firstDayOfMonth.weekday % 7;
    
    const days: DateTime[] = [];
    
    // Add days from previous month
    for (let i = 0; i < dayOfWeek; i++) {
      days.push(firstDayOfMonth.minus({ days: dayOfWeek - i }));
    }
    
    // Add days from current month
    for (let i = 0; i < daysInMonth; i++) {
      days.push(firstDayOfMonth.plus({ days: i }));
    }
    
    // Add days from next month to complete the grid
    const remainingDays = 42 - days.length;
    for (let i = 0; i < remainingDays; i++) {
      days.push(lastDayOfMonth.plus({ days: i + 1 }));
    }
    
    return days;
  }

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

// Get coach timezone in a specific format
export function getCoachTimezone() {
  const COACH_TIMEZONE = process.env.NEXT_PUBLIC_COACH_TIMEZONE || 'Asia/Saigon';
  return COACH_TIMEZONE;
}

// Format date without time
export function formatDateWithoutTime(date: Date): string {
  return DateTime.fromJSDate(date).toFormat('yyyy-MM-dd');
} 