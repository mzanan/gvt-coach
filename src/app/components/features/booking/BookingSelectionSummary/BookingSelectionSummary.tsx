import Image from 'next/image'
import { CalendarIcon, DollarSign, Mail, User } from 'lucide-react'
import { Card } from '@/app/components/ui-kit/card'

interface BookingSelectionSummaryProps {
  coachName?: string | null
  coachPhotoUrl?: string | null
  dateTimeLabel?: string | null
  email?: string | null
  price?: number | null
  timezone: string
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode | null
}) {
  return (
    <div className="flex items-start space-x-3">
      <div className="h-9 w-9 shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="font-medium truncate min-h-[1.25rem]">{value || ' '}</p>
      </div>
    </div>
  )
}

export function BookingSelectionSummary({
  coachName,
  coachPhotoUrl,
  dateTimeLabel,
  email,
  price,
  timezone,
}: BookingSelectionSummaryProps) {
  return (
    <Card className="p-5 space-y-4">
      <h3 className="font-semibold">Your selection</h3>

      <SummaryRow
        icon={
          coachPhotoUrl ? (
            <div className="h-9 w-9 relative rounded-full overflow-hidden">
              <Image src={coachPhotoUrl} alt={coachName || ''} fill sizes="36px" className="object-cover" />
            </div>
          ) : (
            <div className="h-9 w-9 flex items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
          )
        }
        label="Coach"
        value={coachName}
      />

      <SummaryRow
        icon={
          <div className="h-9 w-9 flex items-center justify-center rounded-full bg-primary/10">
            <CalendarIcon className="h-5 w-5 text-primary" />
          </div>
        }
        label="Date & time"
        value={dateTimeLabel}
      />

      <SummaryRow
        icon={
          <div className="h-9 w-9 flex items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
        }
        label="Email"
        value={email}
      />

      <SummaryRow
        icon={
          <div className="h-9 w-9 flex items-center justify-center rounded-full bg-primary/10">
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
        }
        label="Price"
        value={price != null ? `$${price}` : null}
      />

      <p className="text-xs text-muted-foreground pt-2 border-t">
        Shown in timezone: {timezone}
      </p>
    </Card>
  )
}
