'use client'

import { Button } from "@/app/components/ui-kit/button"
import { BookingFrequency } from "@/app/types/booking"
import { useState } from "react"
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
}

interface FrequencyOption {
  value: BookingFrequency;
  title: string;
  description: string;
}

const frequencies: FrequencyOption[] = [
  {
    value: 'once',
    title: 'Single Session',
    description: 'Book a one-time consultation session'
  },
  {
    value: 'weekly',
    title: 'Weekly Sessions',
    description: 'Schedule recurring weekly sessions'
  },
  {
    value: 'twice-weekly',
    title: 'Twice Weekly',
    description: 'Schedule two sessions per week'
  }
];

export function FrequencySelector({ 
  onFrequencySelect, 
  selectedFrequency,
  disableWeekly = false,
  disableTwiceWeekly = false
}: FrequencySelectorProps) {
  const [selectedFrequencyState, setSelectedFrequency] = useState<BookingFrequency | null>(selectedFrequency || null)
  const [duration, setDuration] = useState<string>("1")

  const handleSelect = (frequency: BookingFrequency) => {
    setSelectedFrequency(frequency)
    if (frequency === 'once') {
      onFrequencySelect(frequency)
    }
  }

  const handleDurationChange = (value: string) => {
    setDuration(value)
  }

  const handleConfirm = () => {
    if (selectedFrequencyState && selectedFrequencyState !== 'once') {
      onFrequencySelect(selectedFrequencyState, parseInt(duration))
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card 
          className={cn(
            "p-6 cursor-pointer hover:border-primary transition-colors",
            selectedFrequency === 'once' && "border-primary"
          )}
          onClick={() => handleSelect('once')}
        >
          <h3 className="text-xl font-semibold mb-2">Single Session</h3>
          <p className="text-muted-foreground">Book a one-time consultation session</p>
        </Card>

        <Card 
          className={cn(
            "p-6 cursor-pointer hover:border-primary transition-colors",
            selectedFrequency === 'weekly' && "border-primary",
            disableWeekly && "opacity-50 cursor-not-allowed hover:border-border"
          )}
          onClick={() => !disableWeekly && handleSelect('weekly')}
        >
          <h3 className="text-xl font-semibold mb-2">Weekly Sessions</h3>
          <p className="text-muted-foreground">Schedule recurring weekly sessions</p>
          {disableWeekly && (
            <p className="text-sm text-muted-foreground mt-2">(Coming soon)</p>
          )}
        </Card>

        <Card 
          className={cn(
            "p-6 cursor-pointer hover:border-primary transition-colors",
            selectedFrequency === 'twice-weekly' && "border-primary",
            disableTwiceWeekly && "opacity-50 cursor-not-allowed hover:border-border"
          )}
          onClick={() => !disableTwiceWeekly && handleSelect('twice-weekly')}
        >
          <h3 className="text-xl font-semibold mb-2">Twice Weekly</h3>
          <p className="text-muted-foreground">Schedule two sessions per week</p>
          {disableTwiceWeekly && (
            <p className="text-sm text-muted-foreground mt-2">(Coming soon)</p>
          )}
        </Card>
      </div>

      {selectedFrequencyState && selectedFrequencyState !== 'once' && (
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