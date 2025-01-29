import { DateTime } from 'luxon'

interface TimezoneInfoProps {
  userTimezone: string
  coachTimezone: string
}

export function TimezoneInfo({ userTimezone, coachTimezone }: TimezoneInfoProps) {
  const userTZ = DateTime.local().setZone(userTimezone);
  const coachTZ = DateTime.local().setZone(coachTimezone);
  const hoursDiff = Math.abs(userTZ.offset - coachTZ.offset) / 60;
  
  if (hoursDiff >= 6) {
    return (
      <div className="text-sm text-muted-foreground mb-4">
        <p>Note: Due to the {hoursDiff}-hour time difference between your timezone ({userTimezone}) 
        and the coach's timezone ({coachTimezone}), some slots may appear in different days.</p>
      </div>
    );
  }
  return null;
} 