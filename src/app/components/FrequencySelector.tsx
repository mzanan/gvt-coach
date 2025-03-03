'use client'

import { Button } from "@/components/ui/button"
import { BookingFrequency } from "../types/booking"
import { useState } from "react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface FrequencySelectorProps {
  onFrequencySelect: (frequency: BookingFrequency, duration?: number) => void
  selectedFrequency?: BookingFrequency
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
  selectedFrequency 
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
        {frequencies.map((freq) => (
          <button
            key={freq.value}
            onClick={() => handleSelect(freq.value)}
            className={cn(
              "flex flex-col items-start p-6 rounded-lg transition-colors text-left",
              "border border-border hover:border-primary",
              selectedFrequencyState === freq.value 
                ? "bg-white text-black" 
                : "bg-background text-white"
            )}
          >
            <h3 className="font-semibold mb-2 text-foreground">{freq.title}</h3>
            <p className="text-sm text-muted-foreground">{freq.description}</p>
          </button>
        ))}
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