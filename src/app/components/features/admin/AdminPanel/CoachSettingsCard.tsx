'use client'

import { Card } from '@/app/components/ui-kit/card'
import { Input } from '@/app/components/ui-kit/input'
import { Label } from '@/app/components/ui-kit/label'
import { CoachId } from '@/config/coaches'
import { CoachConfig } from '@/types/coach'

interface CoachSettingsCardProps {
  coachId: CoachId;
  coach: CoachConfig;
  onChange: (coachId: CoachId, coach: CoachConfig) => void;
}

export function CoachSettingsCard({ coachId, coach, onChange }: CoachSettingsCardProps) {
  const setField = (field: keyof CoachConfig, value: string) => {
    onChange(coachId, { ...coach, [field]: value })
  }

  const setPrice = (field: keyof CoachConfig['prices'], value: string) => {
    onChange(coachId, {
      ...coach,
      prices: { ...coach.prices, [field]: Number(value) || 0 }
    })
  }

  const setWorkingHour = (shift: 'morning' | 'afternoon', bound: 'start' | 'end', value: string) => {
    onChange(coachId, {
      ...coach,
      workingHours: {
        ...coach.workingHours,
        [shift]: { ...coach.workingHours[shift], [bound]: Number(value) || 0 }
      }
    })
  }

  return (
    <Card className="p-6 space-y-4">
      <h2 className="text-lg font-medium">Coach: {coachId}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${coachId}-displayName`}>Display name</Label>
          <Input
            id={`${coachId}-displayName`}
            value={coach.displayName}
            onChange={e => setField('displayName', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${coachId}-email`}>Email</Label>
          <Input
            id={`${coachId}-email`}
            type="email"
            value={coach.email}
            onChange={e => setField('email', e.target.value)}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor={`${coachId}-description`}>Description</Label>
          <Input
            id={`${coachId}-description`}
            value={coach.description}
            onChange={e => setField('description', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${coachId}-photoUrl`}>Photo URL</Label>
          <Input
            id={`${coachId}-photoUrl`}
            value={coach.photoUrl}
            onChange={e => setField('photoUrl', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${coachId}-timezone`}>Timezone</Label>
          <Input
            id={`${coachId}-timezone`}
            value={coach.timezone}
            onChange={e => setField('timezone', e.target.value)}
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Prices (USD)</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={`${coachId}-price-single`}>Single session</Label>
            <Input
              id={`${coachId}-price-single`}
              type="number"
              min={0}
              value={coach.prices.singleSession}
              onChange={e => setPrice('singleSession', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${coachId}-price-weekly`}>Weekly</Label>
            <Input
              id={`${coachId}-price-weekly`}
              type="number"
              min={0}
              value={coach.prices.weekly}
              onChange={e => setPrice('weekly', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${coachId}-price-twice`}>Twice weekly</Label>
            <Input
              id={`${coachId}-price-twice`}
              type="number"
              min={0}
              value={coach.prices.twiceWeekly}
              onChange={e => setPrice('twiceWeekly', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Working hours (UTC, 0-23)</h3>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor={`${coachId}-morning-start`}>Morning start</Label>
            <Input
              id={`${coachId}-morning-start`}
              type="number"
              min={0}
              max={23}
              value={coach.workingHours.morning.start}
              onChange={e => setWorkingHour('morning', 'start', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${coachId}-morning-end`}>Morning end</Label>
            <Input
              id={`${coachId}-morning-end`}
              type="number"
              min={0}
              max={23}
              value={coach.workingHours.morning.end}
              onChange={e => setWorkingHour('morning', 'end', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${coachId}-afternoon-start`}>Afternoon start</Label>
            <Input
              id={`${coachId}-afternoon-start`}
              type="number"
              min={0}
              max={23}
              value={coach.workingHours.afternoon.start}
              onChange={e => setWorkingHour('afternoon', 'start', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${coachId}-afternoon-end`}>Afternoon end</Label>
            <Input
              id={`${coachId}-afternoon-end`}
              type="number"
              min={0}
              max={23}
              value={coach.workingHours.afternoon.end}
              onChange={e => setWorkingHour('afternoon', 'end', e.target.value)}
            />
          </div>
        </div>
      </div>
    </Card>
  )
}
