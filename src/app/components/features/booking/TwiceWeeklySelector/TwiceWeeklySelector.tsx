'use client'

import { DateTime } from 'luxon'
import { TimeSlot } from '@/types/booking'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui-kit/select'
import { Button } from '@/app/components/ui-kit/button'
import { useTwiceWeeklySelector } from './useTwiceWeeklySelector'
import { Loader2 } from 'lucide-react'

interface TwiceWeeklySelectorProps {
  firstDate: Date
  onComplete: (firstSlot: TimeSlot, secondSlot: TimeSlot) => void
  duration?: number
  timezone: string
}

export function TwiceWeeklySelector(props: TwiceWeeklySelectorProps) {
  const {
    firstDaySlots,
    secondDaySlots,
    selectedFirstSlot,
    selectedSecondSlot,
    secondDate,
    isLoadingSlots,
    handleFirstSlotSelect,
    handleSecondSlotSelect,
    handleConfirm,
    formatTime,
    getEndDateText,
    isConfirmDisabled
  } = useTwiceWeeklySelector(props);

  return (
    <div className="space-y-6">
      {isLoadingSlots && (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading available times...</span>
        </div>
      )}

      {!isLoadingSlots && (
        <>
          <div className="text-sm space-y-2">
            <p>Your twice-weekly sessions will be scheduled for:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Every {DateTime.fromJSDate(props.firstDate).toFormat('cccc')} starting {DateTime.fromJSDate(props.firstDate).toFormat('MMMM d, yyyy')}</li>
              <li>Every {DateTime.fromJSDate(secondDate).toFormat('cccc')} starting {DateTime.fromJSDate(secondDate).toFormat('MMMM d, yyyy')}</li>
            </ul>
            <p>These sessions will continue for {props.duration || 1} { (props.duration || 1) === 1 ? 'month' : 'months'}, ending on {getEndDateText()}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3>{DateTime.fromJSDate(props.firstDate).toFormat('cccc')} Sessions</h3>
              <Select 
                value={selectedFirstSlot?.id} 
                onValueChange={handleFirstSlotSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent className="z-50">
                  {firstDaySlots.length === 0 && <SelectItem value="-" disabled>No available slots</SelectItem>}
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
                onValueChange={handleSecondSlotSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent className="z-50">
                   {secondDaySlots.length === 0 && <SelectItem value="-" disabled>No available slots</SelectItem>}
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
            disabled={isConfirmDisabled}
            className="w-full"
          >
            Confirm Schedule
          </Button>
        </>
      )}
    </div>
  )
}