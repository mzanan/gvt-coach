'use client'

import { Card } from '@/app/components/ui-kit/card'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { Coach, COACHES_CONFIG } from '@/app/config/coaches'
import { useCoachSelector } from './useCoachSelector'
import Image from 'next/image'
import { DateTime } from 'luxon'

interface CoachSelectorProps {
  selectedCoach: Coach | undefined;
  onCoachSelect: (coach: Coach) => void;
}

export const CoachSelector = ({
  selectedCoach,
  onCoachSelect
}: CoachSelectorProps) => {
  const { handleCoachCardClick } = useCoachSelector({ onCoachSelect });
  
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {Object.values(Coach).map((coach) => (
          <Card 
            key={coach}
            className={cn(
              "p-4 cursor-pointer border-2 transition-colors", 
              selectedCoach === coach 
                ? "border-primary" 
                : "border-transparent hover:border-primary/50"
            )}
            onClick={() => handleCoachCardClick(coach)}
          >
            <div className="flex items-start p-2">
              <div className="w-32 h-32 relative mr-4 rounded-full overflow-hidden bg-slate-200">
                {COACHES_CONFIG[coach].photoUrl && (
                  <Image 
                    src={COACHES_CONFIG[coach].photoUrl}
                    alt={COACHES_CONFIG[coach].name}
                    fill
                    sizes="(max-width: 768px) 100px, 128px"
                    priority={true}
                    className="object-cover"
                  />
                )}
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <div className="text-lg font-medium">{COACHES_CONFIG[coach].displayName}</div>

                  {selectedCoach === coach && (
                    <div className="ml-2">
                      <Check className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  </div>
                <div className="text-sm text-muted-foreground mb-2">
                  {COACHES_CONFIG[coach].description}
                </div>
                <div className="text-sm text-muted-foreground">
                  Timezone: {COACHES_CONFIG[coach].timezone} (UTC{DateTime.now().setZone(COACHES_CONFIG[coach].timezone).toFormat('ZZ')})
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  ${COACHES_CONFIG[coach].prices.singleSession}
                </div>
              </div>
              
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}; 