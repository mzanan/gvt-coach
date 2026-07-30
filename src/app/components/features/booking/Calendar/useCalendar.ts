'use client'

import { useState, useMemo, useCallback } from 'react'
import { DateTime } from 'luxon'
import { CoachId } from '@/config/coaches'
import { useAppConfig } from '@/app/components/core/AppConfigProvider'

interface UseCalendarProps {
  onSelectDate: (date: Date) => void
  selectedDate: Date | null
  selectedTimezone: string
  selectedCoach: CoachId
}

export function useCalendar({
  onSelectDate,
  selectedDate,
  selectedTimezone,
  selectedCoach
}: UseCalendarProps) {
  const { coaches } = useAppConfig();

  const [month, setMonth] = useState<Date>(() =>
    DateTime.now().setZone(selectedTimezone).startOf('month').toJSDate()
  );

  const earliestMonth = useMemo(
    () => DateTime.now().setZone(selectedTimezone).startOf('month').toJSDate(),
    [selectedTimezone]
  );

  const firstSelectableDay = useMemo(() => {
    const coachTimezone = coaches[selectedCoach].timezone;
    return DateTime.now().setZone(coachTimezone).startOf('day').plus({ days: 1 });
  }, [selectedCoach, coaches]);

  const isDayDisabled = useCallback((date: Date) => {
    const calendarDay = DateTime.fromJSDate(date).startOf('day').setZone(selectedTimezone, { keepLocalTime: true });
    return calendarDay < firstSelectableDay;
  }, [selectedTimezone, firstSelectableDay]);

  const selected = useMemo(() => {
    if (!selectedDate) return undefined;
    const local = DateTime.fromJSDate(selectedDate).setZone(selectedTimezone);
    return DateTime.local(local.year, local.month, local.day).toJSDate();
  }, [selectedDate, selectedTimezone]);

  const handleSelect = useCallback((date: Date | undefined) => {
    if (!date || isDayDisabled(date)) return;

    const clicked = DateTime.fromJSDate(date);
    onSelectDate(
      DateTime.local(clicked.year, clicked.month, clicked.day, { zone: selectedTimezone }).toJSDate()
    );
  }, [isDayDisabled, onSelectDate, selectedTimezone]);

  return {
    month,
    setMonth,
    earliestMonth,
    selected,
    isDayDisabled,
    handleSelect
  };
}
