'use client'

import { useState, useMemo, useCallback } from 'react'
import { DateTime } from 'luxon'
import { CoachId } from '@/config/coaches'
import { useAppConfig } from '@/app/components/core/AppConfigProvider'

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
  const { coaches } = useAppConfig();

  const [currentMonth, setCurrentMonth] = useState(() => {
    const userNow = DateTime.now().setZone(selectedTimezone);
    return userNow;
  });

  const getDaysInMonth = useCallback((date: DateTime): DateTime[] => {
    const year = date.year;
    const month = date.month;
    const firstDayOfMonth = DateTime.local(year, month, 1);
    const lastDayOfMonth = firstDayOfMonth.endOf('month');
    const daysInMonth = lastDayOfMonth.day;
    const dayOfWeek = (firstDayOfMonth.weekday === 7) ? 0 : firstDayOfMonth.weekday;

    const days: DateTime[] = [];

    for (let i = 0; i < dayOfWeek; i++) {
      days.push(firstDayOfMonth.minus({ days: dayOfWeek - i }));
    }

    for (let i = 0; i < daysInMonth; i++) {
      days.push(firstDayOfMonth.plus({ days: i }));
    }

    const totalCells = days.length > 35 ? 42 : 35;
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
    const coachTimezone = coaches[selectedCoach].timezone;
    const coachNow = DateTime.now().setZone(coachTimezone);
    const calendarDateInUserTZ = date.setZone(selectedTimezone).startOf('day');
    const calendarDateInCoachTZ = calendarDateInUserTZ.setZone(coachTimezone);
    const coachTomorrow = coachNow.startOf('day').plus({ days: 1 });

    if (calendarDateInCoachTZ >= coachTomorrow) {
      return false;
    }

    return true;
  }, [selectedTimezone, selectedCoach, coaches]);

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
