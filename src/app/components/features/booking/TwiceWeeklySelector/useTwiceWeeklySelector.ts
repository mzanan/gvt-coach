'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { DateTime } from 'luxon'
import { TimeSlot } from '@/types/booking'
import { bookingService } from '@/services/bookingService'

// Define props for the hook based on the component's props
interface UseTwiceWeeklySelectorProps {
  firstDate: Date
  onComplete: (firstSlot: TimeSlot, secondSlot: TimeSlot) => void
  duration?: number
  timezone: string
}

export function useTwiceWeeklySelector({
  firstDate,
  onComplete,
  duration = 1,
  timezone
}: UseTwiceWeeklySelectorProps) {
  
  // --- State ---
  const [firstDaySlots, setFirstDaySlots] = useState<TimeSlot[]>([])
  const [secondDaySlots, setSecondDaySlots] = useState<TimeSlot[]>([])
  const [selectedFirstSlot, setSelectedFirstSlot] = useState<TimeSlot | null>(null)
  const [selectedSecondSlot, setSelectedSecondSlot] = useState<TimeSlot | null>(null)
  const [isLoadingSlots, setIsLoadingSlots] = useState(true); // Add loading state

  // --- Memoized values ---
  const secondDate = useMemo(() => 
    DateTime.fromJSDate(firstDate)
      .plus({ days: 3 })
      .toJSDate(),
    [firstDate]
  )

  // --- Effects ---
  useEffect(() => {
    const loadSlots = async () => {
      setIsLoadingSlots(true);
      try {
        const [firstDayGrouped, secondDayGrouped] = await Promise.all([
          bookingService.getAvailableSlots(firstDate, timezone),
          bookingService.getAvailableSlots(secondDate, timezone)
        ]);
        
        const firstSlots = firstDayGrouped.flatMap(group => group.slots);
        const secondSlots = secondDayGrouped.flatMap(group => group.slots);
        
        setFirstDaySlots(firstSlots);
        setSecondDaySlots(secondSlots);
      } catch (error) {
        console.error("Failed to load slots for twice weekly selector:", error);
        // Handle error appropriately, e.g., show toast
      } finally {
        setIsLoadingSlots(false);
      }
    }
    loadSlots()
  }, [firstDate, secondDate, duration, timezone]) // Duration might not be needed here?

  // --- Callbacks ---
  const handleFirstSlotSelect = useCallback((slotId: string | null) => {
    const slot = firstDaySlots.find(s => s.id === slotId) || null;
    setSelectedFirstSlot(slot);
  }, [firstDaySlots]);

  const handleSecondSlotSelect = useCallback((slotId: string | null) => {
    const slot = secondDaySlots.find(s => s.id === slotId) || null;
    setSelectedSecondSlot(slot);
  }, [secondDaySlots]);

  const handleConfirm = useCallback(() => {
    if (selectedFirstSlot && selectedSecondSlot) {
      onComplete(selectedFirstSlot, selectedSecondSlot)
    }
  }, [selectedFirstSlot, selectedSecondSlot, onComplete]);

  // --- Helper functions ---
  const formatTime = useCallback((date: Date) => {
    const dateTime = DateTime.fromJSDate(date).setZone(timezone);
    // Handle midnight case consistently
    return dateTime.hour === 0 && dateTime.minute === 0 ? "00:00" : dateTime.toFormat('hh:mm a');
  }, [timezone]);

  const getEndDateText = useCallback(() => {
    return DateTime.fromJSDate(secondDate).plus({ months: duration }).toFormat('MMMM d, yyyy');
  }, [secondDate, duration]);
  
  const isConfirmDisabled = !selectedFirstSlot || !selectedSecondSlot || isLoadingSlots;

  // --- Return values ---
  return {
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
  };
} 