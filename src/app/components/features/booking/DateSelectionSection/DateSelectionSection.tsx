'use client'

import { Button } from '@/app/components/ui-kit/button'
import { Check } from 'lucide-react'
import { DateTime } from 'luxon'
import { Calendar } from '../../booking/Calendar/Calendar'
import { TimeZoneSelector } from '../TimeZoneSelector/TimeZoneSelector'
import { TimeSlot, BookingPlan, DayGroup } from '@/types/booking'
import { BookingFrequency } from '@/types/enums'
import { CoachId } from '@/config/coaches'

interface DateSelectionSectionProps {
  selectedDate: Date | null
  suggestedDate: Date | null
  selectedTimezone: string
  bookingPlan: BookingPlan | null
  availableSlots: DayGroup[]
  selectedSlot: TimeSlot | null
  bookedDates: Array<{ date: Date, fullyBooked: boolean }>
  onDateSelect: (date: Date) => void
  onTimezoneChange: (timezone: string) => void
  onSlotSelect: (slot: TimeSlot) => void
}

export function DateSelectionSection({
  selectedDate,
  suggestedDate,
  selectedTimezone,
  bookingPlan,
  availableSlots,
  selectedSlot,
  bookedDates,
  onDateSelect,
  onTimezoneChange,
}: DateSelectionSectionProps) {

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-col items-start gap-6">
        <div className="space-y-4 w-full">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Select a Date</h2>
            <TimeZoneSelector 
              currentTimezone={selectedTimezone}
              onTimezoneChange={onTimezoneChange}
            />
          </div>
          <Calendar
            onSelectDate={onDateSelect}
            selectedDate={selectedDate}
            bookedDates={bookedDates}
            suggestedDate={suggestedDate}
            selectedTimezone={selectedTimezone}
            selectedCoach={bookingPlan?.coach as CoachId || 'MATIAS'}
          />
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary"></div>
              <span className="text-sm text-muted-foreground">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <span className="text-sm text-muted-foreground">Suggested</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-muted"></div>
              <span className="text-sm text-muted-foreground">Booked/Unavailable</span>
            </div>
          </div>
        </div>

        {bookingPlan?.frequency === BookingFrequency.TwiceWeekly && selectedDate && (
          <div className="w-full space-y-4 mt-6">
            <h2 className="text-lg font-semibold">Second Weekly Session</h2>
            <div className="text-sm text-muted-foreground mb-4">
              Select a second day of the week for your recurring sessions. This selection sets your regular schedule.
            </div>

            <div className="grid grid-cols-1 gap-3">
              {availableSlots
                .filter(dayGroup => {
                  const selectedDay = DateTime.fromJSDate(selectedDate).weekdayShort;
                  const currentDay = DateTime.fromJSDate(dayGroup.date).weekdayShort;
                  return selectedDay !== currentDay;
                })
                .map((dayGroup, index) => {
                  const dayLabel = DateTime.fromJSDate(dayGroup.date).toFormat('EEEE');
                  const hasAvailableSlots = dayGroup.slots.some((slot: TimeSlot) => slot.available);

                  return (
                    <Button
                      key={index}
                      type="button"
                      variant={bookingPlan?.secondSlot?.date && 
                        DateTime.fromJSDate(bookingPlan.secondSlot.date).weekdayShort === 
                        DateTime.fromJSDate(dayGroup.date).weekdayShort 
                          ? "default" 
                          : "outline"
                      }
                      className="justify-start"
                      disabled={!hasAvailableSlots}
                      onClick={() => {
                        const firstAvailableSlot = dayGroup.slots.find(slot => slot.available);
                        if (selectedSlot && hasAvailableSlots && firstAvailableSlot) {
                          console.log("Second weekly day selected, need slot logic adjustment:", firstAvailableSlot);
                        }
                      }}
                    >
                      {dayLabel}
                      {bookingPlan?.secondSlot?.date && 
                        DateTime.fromJSDate(bookingPlan.secondSlot.date).weekdayShort === 
                        DateTime.fromJSDate(dayGroup.date).weekdayShort && (
                          <Check className="ml-2 h-4 w-4" />
                        )
                      }
                    </Button>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 