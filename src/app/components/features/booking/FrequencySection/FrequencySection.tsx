'use client'

import { Card } from '@/app/components/ui-kit/card'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { BookingFrequency, BookingPlan } from '@/app/types/booking'
import { useFrequencySection } from './useFrequencySection'

interface FrequencySectionProps {
  bookingPlan: BookingPlan | null
  onFrequencySelect: (frequency: BookingFrequency, duration?: number) => void
}

export function FrequencySection({
  bookingPlan,
  onFrequencySelect
}: FrequencySectionProps) {
  const {
    handleFrequencyCardClick
  } = useFrequencySection({ onFrequencySelect })
  
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">How often would you like to have coaching sessions?</h2>
      <div className="grid gap-4 md:grid-cols-1">
        <Card className={cn("p-4 cursor-pointer border-2 transition-colors", 
          bookingPlan?.frequency === 'once' ? "border-primary" : "border-transparent hover:border-primary/50")}
          onClick={() => handleFrequencyCardClick('once', 60)}>
          <div className="flex justify-between items-center p-2">
            <div>
              <div className="text-lg font-medium">Single Session</div>
              <div className="text-sm text-muted-foreground">One-time coaching call</div>
              <div className="text-sm">60 minutes</div>
            </div>
            <div className="font-semibold text-lg">$250</div>
            {bookingPlan?.frequency === 'once' && (
              <div className="ml-2">
                <Check className="h-5 w-5 text-primary" />
              </div>
            )}
          </div>
        </Card>

        <Card className={cn("p-4 cursor-pointer border-2 transition-colors", 
          bookingPlan?.frequency === 'weekly' ? "border-primary" : "border-transparent hover:border-primary/50")}
          onClick={() => handleFrequencyCardClick('weekly', 60)}>
          <div className="flex justify-between items-center p-2">
            <div>
              <div className="text-lg font-medium">Weekly</div>
              <div className="text-sm text-muted-foreground">Regular weekly sessions</div>
              <div className="text-sm">60 minutes</div>
            </div>
            <div className="font-semibold text-lg">$850 <span className="text-sm font-normal text-muted-foreground">/month</span></div>
            {bookingPlan?.frequency === 'weekly' && (
              <div className="ml-2">
                <Check className="h-5 w-5 text-primary" />
              </div>
            )}
          </div>
        </Card>

        <Card className={cn("p-4 cursor-pointer border-2 transition-colors",
          bookingPlan?.frequency === 'twice-weekly' ? "border-primary" : "border-transparent hover:border-primary/50")}
          onClick={() => handleFrequencyCardClick('twice-weekly', 60)}>
          <div className="flex justify-between items-center p-2">
            <div>
              <div className="text-lg font-medium">Twice Weekly</div>
              <div className="text-sm text-muted-foreground">Intensive coaching</div>
              <div className="text-sm">60 minutes</div>
            </div>
            <div className="font-semibold text-lg">$1,500 <span className="text-sm font-normal text-muted-foreground">/month</span></div>
            {bookingPlan?.frequency === 'twice-weekly' && (
              <div className="ml-2">
                <Check className="h-5 w-5 text-primary" />
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
} 