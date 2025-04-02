'use client'

import { useState, useMemo, useCallback } from 'react'
import { DateTime } from 'luxon'
import { CoachId, COACHES_CONFIG } from '@/config/coaches'

interface UseCalendarProps {
  onSelectDate: (date: Date) => void
  selectedDate: Date | null
  suggestedDate?: Date | null
  selectedTimezone: string
  selectedCoach: CoachId
}

export function useCalendar({
  onSelectDate,
  selectedDate,
  suggestedDate,
  selectedTimezone,
  selectedCoach
}: UseCalendarProps) {
  
  // --- State ---
  const [currentMonth, setCurrentMonth] = useState(() => {
    const userNow = DateTime.now().setZone(selectedTimezone);
    return userNow;
  });

  // --- Memoized calculations and Callbacks (Moved from Calendar.tsx) ---
  const getDaysInMonth = useCallback((date: DateTime): DateTime[] => {
    const year = date.year;
    const month = date.month;
    const firstDayOfMonth = DateTime.local(year, month, 1);
    const lastDayOfMonth = firstDayOfMonth.endOf('month');
    const daysInMonth = lastDayOfMonth.day;
    const dayOfWeek = (firstDayOfMonth.weekday === 7) ? 0 : firstDayOfMonth.weekday; // Adjust Sunday to 0
    
    const days: DateTime[] = [];
    
    // Add days from previous month
    for (let i = 0; i < dayOfWeek; i++) {
      days.push(firstDayOfMonth.minus({ days: dayOfWeek - i }));
    }
    
    // Add days from current month
    for (let i = 0; i < daysInMonth; i++) {
      days.push(firstDayOfMonth.plus({ days: i }));
    }
    
    // Add days from next month to complete the grid (usually 6 rows = 42 days)
    const totalCells = days.length > 35 ? 42 : 35; // Adjust grid size if needed
    const remainingDays = totalCells - days.length;
    for (let i = 0; i < remainingDays; i++) {
      days.push(lastDayOfMonth.plus({ days: i + 1 }));
    }
    
    return days;
  }, []);

  const days = useMemo(() => getDaysInMonth(currentMonth), [currentMonth, getDaysInMonth]);

  const goToPreviousMonth = useCallback(() => {
    setCurrentMonth(prev => prev.minus({ months: 1 }));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth(prev => prev.plus({ months: 1 }));
  }, []);

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
    return date.startOf('day').hasSame(selected, 'day');
  }, [selectedDate, selectedTimezone]);

  const isSuggestedDate = useCallback((date: DateTime) => {
    if (!suggestedDate) return false;
    const suggested = DateTime.fromJSDate(suggestedDate).setZone(selectedTimezone).startOf('day');
    return date.startOf('day').hasSame(suggested, 'day');
  }, [suggestedDate, selectedTimezone]);

  const isDisabled = useCallback((date: DateTime) => {
    const coachTimezone = COACHES_CONFIG[selectedCoach].timezone;
    const coachNow = DateTime.now().setZone(coachTimezone);
    const calendarDateInUserTZ = date.setZone(selectedTimezone).startOf('day');
    const calendarDateInCoachTZ = calendarDateInUserTZ.setZone(coachTimezone);
    const coachTomorrow = coachNow.startOf('day').plus({ days: 1 }); 

    // Check if the calendar date (in coach's TZ) is ON OR AFTER the coach's tomorrow
    if (calendarDateInCoachTZ >= coachTomorrow) {
      return false; 
    }
    
    // Otherwise (it's today or earlier in coach's timezone)
    return true; // Disable past dates and coach's current day
  }, [selectedTimezone, selectedCoach]);

  const isCurrentMonth = useCallback((date: DateTime) => {
    return date.hasSame(currentMonth, 'month');
  }, [currentMonth]);

  const handleDateSelect = useCallback((date: DateTime) => {
    const correctDateInSelectedTZ = DateTime.local(
      date.year,
      date.month,
      date.day, 
      { zone: selectedTimezone }
    );

    if (!isDisabled(date)) { 
      onSelectDate(correctDateInSelectedTZ.toJSDate());
    }
  }, [isDisabled, onSelectDate, selectedTimezone]);


  // --- Return values ---
  return {
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
  };
} 