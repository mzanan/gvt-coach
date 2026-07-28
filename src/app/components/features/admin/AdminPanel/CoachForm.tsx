'use client'

import Image from 'next/image'
import { Trash2, User } from 'lucide-react'
import { Button } from '@/app/components/ui-kit/button'
import { Card } from '@/app/components/ui-kit/card'
import { Input } from '@/app/components/ui-kit/input'
import { Label } from '@/app/components/ui-kit/label'
import { Textarea } from '@/app/components/ui-kit/textarea'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/app/components/ui-kit/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui-kit/select'
import { TimeZoneSelector } from '@/app/components/features/booking/TimeZoneSelector'
import { CoachRecord, CoachPaymentProvider, CoachMeetingProvider } from '@/types/coach'

interface CoachFormProps {
  coach: CoachRecord;
  canDelete: boolean;
  isSaving: boolean;
  onChange: (coach: CoachRecord) => void;
  onSave: (coach: CoachRecord) => void;
  onDelete: (id: string) => void;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function HourSelect({ id, label, value, onChange }: {
  id: string;
  label: string;
  value: number;
  onChange: (hour: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={String(value)} onValueChange={v => onChange(Number(v))}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-64">
          {HOURS.map(hour => (
            <SelectItem key={hour} value={String(hour)}>
              {String(hour).padStart(2, '0')}:00
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function PriceInput({ id, label, value, onChange }: {
  id: string;
  label: string;
  value: number;
  onChange: (price: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-muted-foreground md:text-sm">$</span>
        <Input
          id={id}
          type="number"
          min={0}
          className="pl-7"
          value={value}
          onChange={e => onChange(Number(e.target.value) || 0)}
        />
      </div>
    </div>
  )
}

export function CoachForm({ coach, canDelete, isSaving, onChange, onSave, onDelete }: CoachFormProps) {
  const set = (fields: Partial<CoachRecord>) => onChange({ ...coach, ...fields })

  return (
    <div className="space-y-6 stagger-in">
      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 relative rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
            {coach.photoUrl ? (
              <Image src={coach.photoUrl} alt={coach.displayName} fill sizes="64px" className="object-cover" />
            ) : (
              <User className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-medium">{coach.displayName}</h2>
            <p className="text-sm text-muted-foreground">{coach.email}</p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${coach.id}-displayName`}>Display name</Label>
            <Input
              id={`${coach.id}-displayName`}
              value={coach.displayName}
              onChange={e => set({ displayName: e.target.value, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${coach.id}-email`}>Email</Label>
            <Input
              id={`${coach.id}-email`}
              type="email"
              value={coach.email}
              onChange={e => set({ email: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Receives the booking notifications for this coach.</p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`${coach.id}-description`}>Description</Label>
            <Textarea
              id={`${coach.id}-description`}
              value={coach.description}
              onChange={e => set({ description: e.target.value })}
              placeholder="Shown on the coach selection card"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${coach.id}-photoUrl`}>Photo URL</Label>
            <Input
              id={`${coach.id}-photoUrl`}
              value={coach.photoUrl}
              onChange={e => set({ photoUrl: e.target.value })}
              placeholder="/coaches/name.jpg or https://..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${coach.id}-timezone`}>Timezone</Label>
            <TimeZoneSelector
              triggerId={`${coach.id}-timezone`}
              currentTimezone={coach.timezone}
              onTimezoneChange={timezone => set({ timezone })}
            />
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div>
          <h3 className="font-medium">Providers</h3>
          <p className="text-sm text-muted-foreground">How this coach gets paid and where the sessions happen.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Payments</Label>
            <Select
              value={coach.paymentProvider}
              onValueChange={value => set({ paymentProvider: value as CoachPaymentProvider })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="polar">Polar</SelectItem>
                <SelectItem value="disabled">Disabled (testing)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Meetings</Label>
            <Select
              value={coach.meetingProvider}
              onValueChange={value => set({ meetingProvider: value as CoachMeetingProvider })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zoom">Zoom</SelectItem>
                <SelectItem value="google-meet">Google Meet (coming soon)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {coach.paymentProvider === 'polar' && (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`${coach.id}-polarProductId`}>Polar product ID</Label>
              <Input
                id={`${coach.id}-polarProductId`}
                value={coach.polarProductId}
                onChange={e => set({ polarProductId: e.target.value })}
                placeholder="Product ID from your Polar dashboard"
              />
              <p className="text-xs text-muted-foreground">
                Required for Polar checkouts. Stripe uses the prices below instead.
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div>
          <h3 className="font-medium">Prices</h3>
          <p className="text-sm text-muted-foreground">USD per plan.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <PriceInput
            id={`${coach.id}-price-single`}
            label="Single session"
            value={coach.prices.singleSession}
            onChange={singleSession => set({ prices: { ...coach.prices, singleSession } })}
          />
          <PriceInput
            id={`${coach.id}-price-weekly`}
            label="Weekly"
            value={coach.prices.weekly}
            onChange={weekly => set({ prices: { ...coach.prices, weekly } })}
          />
          <PriceInput
            id={`${coach.id}-price-twice`}
            label="Twice weekly"
            value={coach.prices.twiceWeekly}
            onChange={twiceWeekly => set({ prices: { ...coach.prices, twiceWeekly } })}
          />
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div>
          <h3 className="font-medium">Working hours</h3>
          <p className="text-sm text-muted-foreground">In UTC. Slots are offered inside these two shifts.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <HourSelect
            id={`${coach.id}-morning-start`}
            label="Morning from"
            value={coach.workingHours.morning.start}
            onChange={start => set({ workingHours: { ...coach.workingHours, morning: { ...coach.workingHours.morning, start } } })}
          />
          <HourSelect
            id={`${coach.id}-morning-end`}
            label="Morning to"
            value={coach.workingHours.morning.end}
            onChange={end => set({ workingHours: { ...coach.workingHours, morning: { ...coach.workingHours.morning, end } } })}
          />
          <HourSelect
            id={`${coach.id}-afternoon-start`}
            label="Afternoon from"
            value={coach.workingHours.afternoon.start}
            onChange={start => set({ workingHours: { ...coach.workingHours, afternoon: { ...coach.workingHours.afternoon, start } } })}
          />
          <HourSelect
            id={`${coach.id}-afternoon-end`}
            label="Afternoon to"
            value={coach.workingHours.afternoon.end}
            onChange={end => set({ workingHours: { ...coach.workingHours, afternoon: { ...coach.workingHours.afternoon, end } } })}
          />
        </div>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-3 border-t bg-background/95 px-4 py-3 pb-safe backdrop-blur sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pb-0 sm:backdrop-blur-none">
        <div className="space-y-1">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" className="w-full sm:w-auto" disabled={!canDelete || isSaving}>
                <Trash2 />
                Delete coach
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete {coach.displayName}?</DialogTitle>
                <DialogDescription>
                  The coach and their configuration are removed permanently. Existing bookings are kept.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" className="w-full sm:w-auto">Cancel</Button>
                </DialogClose>
                <Button variant="destructive" onClick={() => onDelete(coach.id)} disabled={isSaving} className="w-full sm:w-auto">
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {!canDelete && (
            <p className="text-xs text-muted-foreground">The last coach cannot be deleted.</p>
          )}
        </div>

        <Button onClick={() => onSave(coach)} disabled={isSaving} className="w-full sm:w-auto">
          {isSaving ? 'Saving...' : 'Save coach'}
        </Button>
      </div>
    </div>
  )
}
