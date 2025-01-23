'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CalendarProps {
  onSelectDate: (date: Date) => void
  selectedDate: Date | null
  bookedDates: Array<{ date: Date, fullyBooked: boolean }>
}

export function Calendar({ onSelectDate, selectedDate, bookedDates }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDayOfMonth = new Date(year, month, 1).getDay()
    
    const days: (Date | null)[] = []
    
    // Agregar días vacíos al inicio
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null)
    }
    
    // Agregar días del mes
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }
    
    return days
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const isToday = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
  }

  const isSelected = (date: Date) => {
    return selectedDate?.getDate() === date.getDate() &&
      selectedDate?.getMonth() === date.getMonth() &&
      selectedDate?.getFullYear() === date.getFullYear()
  }

  const isDisabled = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date <= today || isFullyBooked(date)
  }

  const isFullyBooked = (date: Date) => {
    return bookedDates.some(bookedDate => 
      bookedDate.date.getDate() === date.getDate() &&
      bookedDate.date.getMonth() === date.getMonth() &&
      bookedDate.date.getFullYear() === date.getFullYear()
    )
  }

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
          {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
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
        {getDaysInMonth(currentMonth).map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="p-2" />
          }

          return (
            <button
              key={date.toISOString()}
              onClick={() => {
                if (!isDisabled(date)) {
                  const localDate = new Date(
                    date.getFullYear(),
                    date.getMonth(),
                    date.getDate(),
                    0, 0, 0, 0
                  );
                  onSelectDate(localDate);
                }
              }}
              disabled={isDisabled(date)}
              className={cn(
                "p-2 w-full rounded-md text-sm transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                {
                  "bg-primary text-primary-foreground": isSelected(date),
                  "bg-accent/50": isToday(date) && !isSelected(date),
                  "text-muted-foreground cursor-not-allowed": isDisabled(date),
                  "text-foreground": !isDisabled(date) && !isSelected(date),
                }
              )}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
} 