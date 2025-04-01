'use client'

import { Card } from '@/app/components/ui-kit/card'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { BookingPlan } from '@/types/booking'
import { useFrequencySection } from './useFrequencySection'
import { BookingFrequency } from '@/types/enums'
import { CoachId, COACHES_CONFIG } from '@/config/coaches'

interface FrequencySectionProps {
  bookingPlan: BookingPlan | null
  onFrequencySelect: (frequency: BookingFrequency, duration?: number) => void
  selectedCoach?: CoachId
}

export function FrequencySection({
  bookingPlan,
  onFrequencySelect,
  selectedCoach = CoachId.Matias
}: FrequencySectionProps) {
  const {
    handleFrequencyCardClick
  } = useFrequencySection({ onFrequencySelect })
  
  // Get prices based on selected coach
  const singleSessionPrice = selectedCoach ? COACHES_CONFIG[selectedCoach].prices.singleSession : 0;
  const weeklyPrice = selectedCoach ? COACHES_CONFIG[selectedCoach].prices.weekly : 0;
  const twiceWeeklyPrice = selectedCoach ? COACHES_CONFIG[selectedCoach].prices.twiceWeekly : 0;
  
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">How often would you like to have coaching sessions?</h2>
      <div className="grid gap-4 md:grid-cols-1">
        <Card className={cn("p-4 cursor-pointer border-2 transition-colors", 
          bookingPlan?.frequency === BookingFrequency.Once ? "border-primary" : "border-transparent hover:border-primary/50")}
          onClick={() => handleFrequencyCardClick(BookingFrequency.Once, 60)}>
          <div className="flex justify-between items-center p-2">
            <div>
              <div className="text-lg font-medium">Single Session</div>
              <div className="text-sm text-muted-foreground">One-time coaching call</div>
              <div className="text-sm">60 minutes</div>
            </div>
            <div className="font-semibold text-lg">${singleSessionPrice}</div>
            {bookingPlan?.frequency === BookingFrequency.Once && (
              <div className="ml-2">
                <Check className="h-5 w-5 text-primary" />
              </div>
            )}
          </div>
        </Card>

        <Card className={cn("p-4 cursor-pointer border-2 transition-colors", 
          bookingPlan?.frequency === BookingFrequency.Weekly ? "border-primary" : "border-transparent hover:border-primary/50")}
          onClick={() => handleFrequencyCardClick(BookingFrequency.Weekly, 60)}>
          <div className="flex justify-between items-center p-2">
            <div>
              <div className="text-lg font-medium">Weekly</div>
              <div className="text-sm text-muted-foreground">Regular weekly sessions</div>
              <div className="text-sm">60 minutes</div>
            </div>
            <div className="font-semibold text-lg">${weeklyPrice} <span className="text-sm font-normal text-muted-foreground">/month</span></div>
            {bookingPlan?.frequency === BookingFrequency.Weekly && (
              <div className="ml-2">
                <Check className="h-5 w-5 text-primary" />
              </div>
            )}
          </div>
        </Card>

        <Card className={cn("p-4 cursor-pointer border-2 transition-colors",
          bookingPlan?.frequency === BookingFrequency.TwiceWeekly ? "border-primary" : "border-transparent hover:border-primary/50")}
          onClick={() => handleFrequencyCardClick(BookingFrequency.TwiceWeekly, 60)}>
          <div className="flex justify-between items-center p-2">
            <div>
              <div className="text-lg font-medium">Twice Weekly</div>
              <div className="text-sm text-muted-foreground">Intensive coaching</div>
              <div className="text-sm">60 minutes</div>
            </div>
            <div className="font-semibold text-lg">${twiceWeeklyPrice} <span className="text-sm font-normal text-muted-foreground">/month</span></div>
            {bookingPlan?.frequency === BookingFrequency.TwiceWeekly && (
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