'use client'

import { useState, useEffect } from 'react'
import { DateTime } from 'luxon'
import { TimeSlot } from '../types/booking'
import { bookingService } from '../services/bookingService'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface TwiceWeeklySelectorProps {
  firstDate: Date
  onComplete: (firstSlot: TimeSlot, secondSlot: TimeSlot) => void
  duration?: number
}

export function TwiceWeeklySelector({ firstDate, onComplete, duration = 1 }: TwiceWeeklySelectorProps) {
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
      const firstDayAvailableSlots = await bookingService.getAvailableSlots(firstDate)
      const secondDayAvailableSlots = await bookingService.getAvailableSlots(secondDate)
      setFirstDaySlots(firstDayAvailableSlots)
      setSecondDaySlots(secondDayAvailableSlots)
    }
    loadSlots()
  }, [firstDate, secondDate])

  const handleConfirm = () => {
    if (selectedFirstSlot && selectedSecondSlot) {
      onComplete(selectedFirstSlot, selectedSecondSlot)
    }
  }

  const formatTime = (date: Date) => {
    return DateTime.fromJSDate(date).toFormat('hh:mm a')
  }

  const getEndDate = () => {
    return DateTime.fromJSDate(firstDate).plus({ months: duration }).toFormat('MMMM d, yyyy')
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground space-y-2">
        <p>
          Your twice-weekly sessions will be scheduled for:
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>Every {DateTime.fromJSDate(firstDate).toFormat('cccc')} starting {DateTime.fromJSDate(firstDate).toFormat('MMMM d, yyyy')}</li>
          <li>Every {DateTime.fromJSDate(secondDate).toFormat('cccc')} starting {DateTime.fromJSDate(secondDate).toFormat('MMMM d, yyyy')}</li>
        </ul>
        <p className="mt-2">
          These sessions will continue for {duration} {duration === 1 ? 'month' : 'months'}, ending on {getEndDate()}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="font-medium mb-4">
            {DateTime.fromJSDate(firstDate).toFormat('cccc')} Sessions
          </h3>
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
            <SelectContent>
              {firstDaySlots
                .filter(slot => slot.available)
                .map(slot => (
                  <SelectItem key={slot.id} value={slot.id}>
                    {formatTime(slot.date)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Card>

        <Card className="p-4">
          <h3 className="font-medium mb-4">
            {DateTime.fromJSDate(secondDate).toFormat('cccc')} Sessions
          </h3>
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
            <SelectContent>
              {secondDaySlots
                .filter(slot => slot.available)
                .map(slot => (
                  <SelectItem key={slot.id} value={slot.id}>
                    {formatTime(slot.date)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Card>
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