'use client'

import { useEffect } from 'react'
import { useForm, useWatch, type Control } from 'react-hook-form'
import Image from 'next/image'
import { Trash2, User } from 'lucide-react'
import { Button } from '@/app/components/ui-kit/button'
import { Card } from '@/app/components/ui-kit/card'
import { Input } from '@/app/components/ui-kit/input'
import { Textarea } from '@/app/components/ui-kit/textarea'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/app/components/ui-kit/form'
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
import { CoachRecord } from '@/types/coach'

interface CoachFormProps {
  coach: CoachRecord;
  canDelete: boolean;
  isSaving: boolean;
  onSave: (coach: CoachRecord) => void;
  onDelete: (id: string) => void;
}

type HourFieldName =
  | 'workingHours.morning.start'
  | 'workingHours.morning.end'
  | 'workingHours.afternoon.start'
  | 'workingHours.afternoon.end';

type PriceFieldName = 'prices.singleSession' | 'prices.weekly' | 'prices.twiceWeekly';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

function HourSelect({ control, name, label }: {
  control: Control<CoachRecord>;
  name: HourFieldName;
  label: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select value={String(field.value)} onValueChange={value => field.onChange(Number(value))}>
            <FormControl>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent className="max-h-64">
              {HOURS.map(hour => (
                <SelectItem key={hour} value={String(hour)}>
                  {String(hour).padStart(2, '0')}:00
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

function PriceInput({ control, name, label }: {
  control: Control<CoachRecord>;
  name: PriceFieldName;
  label: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      rules={{ min: { value: 0, message: 'Price cannot be negative.' } }}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-muted-foreground md:text-sm">$</span>
            <FormControl>
              <Input
                type="number"
                min={0}
                className="pl-7"
                {...field}
                onChange={event => field.onChange(Number(event.target.value) || 0)}
              />
            </FormControl>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function CoachForm({ coach, canDelete, isSaving, onSave, onDelete }: CoachFormProps) {
  const form = useForm<CoachRecord>({ defaultValues: coach });

  useEffect(() => {
    form.reset(coach);
  }, [coach, form]);

  const paymentProvider = useWatch({ control: form.control, name: 'paymentProvider' });
  const photoUrl = useWatch({ control: form.control, name: 'photoUrl' });
  const displayName = useWatch({ control: form.control, name: 'displayName' });
  const email = useWatch({ control: form.control, name: 'email' });

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSave)} className="space-y-6 stagger-in">
        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 relative rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
              {photoUrl ? (
                <Image src={photoUrl} alt={displayName} fill sizes="64px" className="object-cover" />
              ) : (
                <User className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-medium">{displayName}</h2>
              <p className="text-sm text-muted-foreground">{email}</p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="displayName"
              rules={{ required: 'Display name is required.' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={event => {
                        field.onChange(event);
                        form.setValue('name', event.target.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              rules={{
                required: 'Email is required.',
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address.' }
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormDescription>Receives the booking notifications for this coach.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Shown on the coach selection card" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="photoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Photo URL</FormLabel>
                  <FormControl>
                    <Input placeholder="/coaches/name.jpg or https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timezone</FormLabel>
                  <TimeZoneSelector
                    currentTimezone={field.value}
                    onTimezoneChange={field.onChange}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div>
            <h3 className="font-medium">Providers</h3>
            <p className="text-sm text-muted-foreground">How this coach gets paid and where the sessions happen.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="paymentProvider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payments</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="stripe">Stripe</SelectItem>
                      <SelectItem value="polar">Polar</SelectItem>
                      <SelectItem value="disabled">Disabled (testing)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="meetingProvider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meetings</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="zoom">Zoom</SelectItem>
                      <SelectItem value="google-meet">Google Meet (coming soon)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {paymentProvider === 'polar' && (
              <FormField
                control={form.control}
                name="polarProductId"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Polar product ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Product ID from your Polar dashboard" {...field} />
                    </FormControl>
                    <FormDescription>
                      Required for Polar checkouts. Stripe uses the prices below instead.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div>
            <h3 className="font-medium">Prices</h3>
            <p className="text-sm text-muted-foreground">USD per plan.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <PriceInput control={form.control} name="prices.singleSession" label="Single session" />
            <PriceInput control={form.control} name="prices.weekly" label="Weekly" />
            <PriceInput control={form.control} name="prices.twiceWeekly" label="Twice weekly" />
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div>
            <h3 className="font-medium">Working hours</h3>
            <p className="text-sm text-muted-foreground">In UTC. Slots are offered inside these two shifts.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <HourSelect control={form.control} name="workingHours.morning.start" label="Morning from" />
            <HourSelect control={form.control} name="workingHours.morning.end" label="Morning to" />
            <HourSelect control={form.control} name="workingHours.afternoon.start" label="Afternoon from" />
            <HourSelect control={form.control} name="workingHours.afternoon.end" label="Afternoon to" />
          </div>
        </Card>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-3 border-t bg-background/95 px-4 py-3 pb-safe backdrop-blur sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pb-0 sm:backdrop-blur-none">
          <div className="space-y-1">
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="destructive" className="w-full sm:w-auto" disabled={!canDelete || isSaving}>
                  <Trash2 />
                  Delete coach
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete {displayName}?</DialogTitle>
                  <DialogDescription>
                    The coach and their configuration are removed permanently. Existing bookings are kept.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline" className="w-full sm:w-auto">Cancel</Button>
                  </DialogClose>
                  <Button type="button" variant="destructive" onClick={() => onDelete(coach.id)} disabled={isSaving} className="w-full sm:w-auto">
                    Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {!canDelete && (
              <p className="text-xs text-muted-foreground">The last coach cannot be deleted.</p>
            )}
          </div>

          <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
            {isSaving ? 'Saving...' : 'Save coach'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
