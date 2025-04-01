import { DateTime } from 'luxon'
import { TimeSlot } from '@/types/booking'

interface UseDateSelectionSectionProps {
  onSlotSelect: (slot: TimeSlot) => void
}

export function useDateSelectionSection({
  onSlotSelect
}: UseDateSelectionSectionProps) {
  
  const handleSecondWeeklyDaySelect = (selectedSlot: TimeSlot, dayGroupDate: Date) => {
    const slotTime = DateTime.fromJSDate(selectedSlot.date)
    const newDate = DateTime.fromJSDate(dayGroupDate)
      .set({
        hour: slotTime.hour,
        minute: slotTime.minute
      }).toJSDate()
      
    const newSlot = {
      ...selectedSlot,
      date: newDate,
      id: newDate.getTime().toString()
    }
    
    onSlotSelect(newSlot)
  }

  return {
    handleSecondWeeklyDaySelect
  }
} 