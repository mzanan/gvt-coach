'use client'

import { useState, useEffect } from 'react'
import { DateTime } from 'luxon'
import { TimeSlot } from '../types/booking'
import { bookingService } from '../services/bookingService'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

interface TwiceWeeklySelectorProps {
  firstDate: Date
  onComplete: (firstSlot: TimeSlot, secondSlot: TimeSlot) => void
  duration?: number
  timezone: string
}

export function TwiceWeeklySelector({ firstDate, onComplete, duration = 1, timezone }: TwiceWeeklySelectorProps) {
  const [firstDaySlots, setFirstDaySlots] = useState<TimeSlot[]>([])
  const [secondDaySlots, setSecondDaySlots] = useState<TimeSlot[]>([])
  const [selectedFirstSlot, setSelectedFirstSlot] = useState<TimeSlot | null>(null)
  const [selectedSecondSlot, setSelectedSecondSlot] = useState<TimeSlot | null>(null)
  const [secondDate, setSecondDate] = useState<Date>(() => {
    const dt = DateTime.fromJSDate(firstDate).plus({ days: 3 })
    return dt.toJSDate()
  })

  useEffect(() => {
    const loadSlots = async () => {
      const firstDayGrouped = await bookingService.getAvailableSlots(firstDate, timezone)
      const secondDayGrouped = await bookingService.getAvailableSlots(secondDate, timezone)
      
      const firstDaySlots = firstDayGrouped.flatMap(group => group.slots)
      const secondDaySlots = secondDayGrouped.flatMap(group => group.slots)
      
      setFirstDaySlots(firstDaySlots)
      setSecondDaySlots(secondDaySlots)
    }
    loadSlots()
  }, [firstDate, secondDate, duration, timezone])

  const handleConfirm = () => {
    if (selectedFirstSlot && selectedSecondSlot) {
      onComplete(selectedFirstSlot, selectedSecondSlot)
    }
  }

  const formatTime = (date: Date) => {
    const dateTime = DateTime.fromJSDate(date).setZone(timezone)
    return dateTime.hour === 0 ? "00:00 AM" : dateTime.toFormat('hh:mm a')
  }

  const getEndDate = () => {
    return DateTime.fromJSDate(firstDate).plus({ months: duration }).toFormat('MMMM d, yyyy')
  }

  return (
    <div className="space-y-6">
      <div className="text-sm space-y-2">
        <p>Your twice-weekly sessions will be scheduled for:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Every {DateTime.fromJSDate(firstDate).toFormat('cccc')} starting {DateTime.fromJSDate(firstDate).toFormat('MMMM d, yyyy')}</li>
          <li>Every {DateTime.fromJSDate(secondDate).toFormat('cccc')} starting {DateTime.fromJSDate(secondDate).toFormat('MMMM d, yyyy')}</li>
        </ul>
        <p>These sessions will continue for {duration} {duration === 1 ? 'month' : 'months'}, ending on {getEndDate()}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h3>{DateTime.fromJSDate(firstDate).toFormat('cccc')} Sessions</h3>
          <Select 
            value={selectedFirstSlot?.id} 
            onValueChange={(value) => {
              const slot = firstDaySlots.find(s => s.id === value)
              if (slot) setSelectedFirstSlot(slot)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select time" />
            </SelectTrigger>
            <SelectContent className="z-50">
              {firstDaySlots.map((slot) => (
                <SelectItem 
                  key={slot.id} 
                  value={slot.id}
                  disabled={!slot.available}
                >
                  {formatTime(slot.date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <h3>{DateTime.fromJSDate(secondDate).toFormat('cccc')} Sessions</h3>
          <Select 
            value={selectedSecondSlot?.id}
            onValueChange={(value) => {
              const slot = secondDaySlots.find(s => s.id === value)
              if (slot) setSelectedSecondSlot(slot)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select time" />
            </SelectTrigger>
            <SelectContent className="z-50">
              {secondDaySlots.map((slot) => (
                <SelectItem 
                  key={slot.id} 
                  value={slot.id}
                  disabled={!slot.available}
                >
                  {formatTime(slot.date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button 
        onClick={handleConfirm} 
        disabled={!selectedFirstSlot || !selectedSecondSlot}
        className="w-full"
      >
        Confirm Schedule
      </Button>
    </div>
  )
} 