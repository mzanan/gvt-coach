'use client'

import { Button } from "@/app/components/ui-kit/button"
import { BookingFrequency } from '@/types/enums'
import { useState, useEffect } from "react"
import { Label } from "@/app/components/ui-kit/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui-kit/select"
import { cn } from "@/lib/utils"
import { Card } from "@/app/components/ui-kit/card"

interface FrequencySelectorProps {
  onFrequencySelect: (frequency: BookingFrequency, duration?: number) => void
  selectedFrequency?: BookingFrequency
  disableWeekly?: boolean
  disableTwiceWeekly?: boolean
  singleSessionPrice?: number
}

export function FrequencySelector({ 
  onFrequencySelect, 
  selectedFrequency,
  disableWeekly = false,
  disableTwiceWeekly = false,
  singleSessionPrice = 100
}: FrequencySelectorProps) {
  const [selectedFrequencyState, setSelectedFrequency] = useState<BookingFrequency | null>(selectedFrequency || BookingFrequency.Once)
  const [duration, setDuration] = useState<string>("1")

  // Auto-select BookingFrequency.Once when component mounts
  useEffect(() => {
    if (!selectedFrequencyState) {
      setSelectedFrequency(BookingFrequency.Once)
      onFrequencySelect(BookingFrequency.Once)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Dependencies removed as this should only run once on mount

  const handleSelect = (frequency: BookingFrequency) => {
    // Only allow BookingFrequency.Once frequency for now
    if (frequency === BookingFrequency.Once) {
      setSelectedFrequency(frequency)
      onFrequencySelect(frequency)
      return
    }

    // For other frequencies, check if they're disabled
    if (disableWeekly && frequency === BookingFrequency.Weekly) return
    if (disableTwiceWeekly && frequency === BookingFrequency.TwiceWeekly) return

    setSelectedFrequency(frequency)
    onFrequencySelect(frequency)
  }

  const handleDurationChange = (value: string) => {
    setDuration(value)
  }

  const handleConfirm = () => {
    if (selectedFrequencyState && selectedFrequencyState !== BookingFrequency.Once) {
      onFrequencySelect(selectedFrequencyState, parseInt(duration))
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card 
          className={cn(
            "p-6 cursor-pointer hover:border-primary transition-colors",
            selectedFrequency === BookingFrequency.Once && "border-primary"
          )}
          onClick={() => handleSelect(BookingFrequency.Once)}
        >
          <h3 className="text-xl font-semibold mb-2">Single Session</h3>
          <p className="text-muted-foreground">Book a one-time consultation session</p>
          <p className="mt-2 font-medium">${singleSessionPrice}</p>
        </Card>

        <Card 
          className={cn(
            "p-6 cursor-pointer hover:border-primary transition-colors",
            disableWeekly ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
            selectedFrequency === BookingFrequency.Weekly && "border-primary"
          )}
          onClick={() => !disableWeekly && handleSelect(BookingFrequency.Weekly)}
        >
          <h3 className="text-xl font-semibold mb-2">Weekly Sessions</h3>
          <p className="text-muted-foreground">Schedule recurring weekly sessions</p>
          {/* <p className="mt-2 font-medium">$100</p> */}
          {disableWeekly && (
            <p className="text-sm text-muted-foreground mt-2 font-medium">(Coming Soon)</p>
          )}
        </Card>

        <Card 
          className={cn(
            "p-6 cursor-pointer hover:border-primary transition-colors",
            disableTwiceWeekly ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
            selectedFrequency === BookingFrequency.TwiceWeekly && "border-primary"
          )}
          onClick={() => !disableTwiceWeekly && handleSelect(BookingFrequency.TwiceWeekly)}
        >
          <h3 className="text-xl font-semibold mb-2">Twice Weekly</h3>
          <p className="text-muted-foreground">Schedule two sessions per week</p>
          {/* <p className="mt-2 font-medium">$100</p> */}
          {disableTwiceWeekly && (
            <p className="text-sm text-muted-foreground mt-2 font-medium">(Coming Soon)</p>
          )}
        </Card>
      </div>

      {selectedFrequencyState && selectedFrequencyState !== BookingFrequency.Once && (
        <div className="space-y-4 w-full">
          <div className="space-y-2 md:w-1/3">
            <Label>Duration (months)</Label>
            <Select value={duration} onValueChange={handleDurationChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <SelectItem key={month} value={month.toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleConfirm} className="w-full">
            Continue
          </Button>
        </div>
      )}
    </div>
  )
}