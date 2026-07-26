'use client'

import { Card } from '@/app/components/ui-kit/card'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import type { CoachId } from '@/config/coaches'
import { useAppConfig } from '@/app/components/core/AppConfigProvider'
import { useCoachSelector } from './useCoachSelector'
import Image from 'next/image'
import { DateTime } from 'luxon'

interface CoachSelectorProps {
  selectedCoach: CoachId | undefined;
  onCoachSelect: (coach: CoachId) => void;
}

export const CoachSelector = ({
  selectedCoach,
  onCoachSelect
}: CoachSelectorProps) => {
  const { coaches } = useAppConfig();
  const { handleCoachCardClick } = useCoachSelector({ onCoachSelect });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {(Object.keys(coaches) as CoachId[]).map((coachId) => (
          <Card
            key={coachId}
            className={cn(
              "p-4 cursor-pointer border-2 transition-colors",
              selectedCoach === coachId
                ? "border-primary"
                : "border-transparent hover:border-primary/50"
            )}
            onClick={() => handleCoachCardClick(coachId)}
          >
            <div className="flex items-start p-2">
              <div className="w-32 h-32 relative mr-4 rounded-full overflow-hidden bg-slate-200">
                {coaches[coachId].photoUrl && (
                  <Image
                    src={coaches[coachId].photoUrl}
                    alt={coaches[coachId].name}
                    fill
                    sizes="(max-width: 768px) 100px, 128px"
                    priority={true}
                    className="object-cover"
                  />
                )}
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <div className="text-lg font-medium">{coaches[coachId].displayName}</div>

                  {selectedCoach === coachId && (
                    <div className="ml-2">
                      <Check className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  </div>
                <div className="text-sm text-muted-foreground mb-2">
                  {coaches[coachId].description}
                </div>
                <div className="text-sm text-muted-foreground">
                  Timezone: {coaches[coachId].timezone} (UTC{DateTime.now().setZone(coaches[coachId].timezone).toFormat('ZZ')})
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  ${coaches[coachId].prices.singleSession}
                </div>
              </div>

            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
