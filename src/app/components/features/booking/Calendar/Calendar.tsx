'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BookingFrequency } from '@/app/types/booking'
import { Button } from '@/app/components/ui-kit/button'
import { DateTime } from 'luxon'

interface CalendarProps {
  onSelectDate: (date: Date) => void
  selectedDate: Date | null
  bookedDates: Array<{ date: Date, fullyBooked: boolean }>
  frequency?: BookingFrequency
  suggestedDate?: Date | null
  selectedTimezone: string
  COACH_TIMEZONE: string
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
      !isCurrentMonth && "text-muted-foreground opacity-50",
      isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
      isSuggestedDate && "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
      isDisabled && "pointer-events-none opacity-50",
      !isSelected && !isSuggestedDate && !isDisabled && isCurrentMonth && "hover:bg-accent hover:text-accent-foreground"
    )}
    disabled={isDisabled}
    onClick={onClick}
    tabIndex={!isCurrentMonth || isDisabled ? -1 : 0}
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
  COACH_TIMEZONE
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => 
    DateTime.now().setZone(selectedTimezone)
  );

  // Memoizar el cálculo de días del mes para evitar recálculos innecesarios
  const days = useMemo(() => getDaysInMonth(currentMonth), [currentMonth]);

  const goToPreviousMonth = useCallback(() => {
    setCurrentMonth(prev => prev.minus({ months: 1 }));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth(prev => prev.plus({ months: 1 }));
  }, []);

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
    // Usar la zona horaria del COACH para determinar si la fecha es hoy
    const todayInCoachTimezone = DateTime.now()
      .setZone(COACH_TIMEZONE)
      .startOf('day');
    
    // La fecha del calendario en la zona horaria del coach
    const dateInCoachTimezone = date
      .setZone(selectedTimezone)
      .startOf('day')
      .setZone(COACH_TIMEZONE);
    
    // Deshabilitar si la fecha es hoy o en el pasado, o si está completamente reservada
    return dateInCoachTimezone <= todayInCoachTimezone || isFullyBooked(date);
  }, [selectedTimezone, isFullyBooked, COACH_TIMEZONE]);

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
    
    // Añadir días del mes anterior
    for (let i = 0; i < dayOfWeek; i++) {
      days.push(firstDayOfMonth.minus({ days: dayOfWeek - i }));
    }
    
    // Añadir días del mes actual
    for (let i = 0; i < daysInMonth; i++) {
      days.push(firstDayOfMonth.plus({ days: i }));
    }
    
    // Añadir días del mes siguiente hasta completar la cuadrícula
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
          disabled={currentMonth.startOf('month') <= DateTime.now().startOf('month')}
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