'use client'

import { Card } from "@/components/ui/card"
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

interface FrequencySelectorProps {
  onFrequencySelect: (frequency: BookingFrequency, duration?: number) => void
}

export function FrequencySelector({ onFrequencySelect }: FrequencySelectorProps) {
  const [selectedFrequency, setSelectedFrequency] = useState<BookingFrequency | null>(null)
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
    if (selectedFrequency && selectedFrequency !== 'once') {
      onFrequencySelect(selectedFrequency, parseInt(duration))
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card 
          className="p-6 cursor-pointer hover:bg-accent transition-colors"
          onClick={() => handleSelect('once')}
        >
          <h3 className="font-semibold mb-2">Single Session</h3>
          <p className="text-sm text-muted-foreground">Book a one-time consultation session</p>
        </Card>

        <Card 
          className="p-6 cursor-pointer hover:bg-accent transition-colors"
          onClick={() => handleSelect('weekly')}
        >
          <h3 className="font-semibold mb-2">Weekly Sessions</h3>
          <p className="text-sm text-muted-foreground">Schedule recurring weekly sessions</p>
        </Card>

        <Card 
          className="p-6 cursor-pointer hover:bg-accent transition-colors"
          onClick={() => handleSelect('twice-weekly')}
        >
          <h3 className="font-semibold mb-2">Twice Weekly</h3>
          <p className="text-sm text-muted-foreground">Schedule two sessions per week</p>
        </Card>
      </div>

      {selectedFrequency && selectedFrequency !== 'once' && (
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