import { CoachRecord } from '@/lib/db/coaches';
import { CoachPaymentProvider, CoachMeetingProvider } from '@/types/coach';

const PAYMENT_PROVIDERS: CoachPaymentProvider[] = ['stripe', 'polar', 'lemonsqueezy', 'disabled'];
const MEETING_PROVIDERS: CoachMeetingProvider[] = ['zoom', 'google-meet'];

interface ValidationResult {
  id?: string;
  coach?: Omit<CoachRecord, 'id'>;
  error?: string;
}

function isValidHour(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23;
}

function isValidPrice(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function validateCoachPayload(body: unknown): ValidationResult {
  if (!body || typeof body !== 'object') {
    return { error: 'Invalid payload' };
  }

  const data = body as Record<string, unknown>;
  const rawId = typeof data.id === 'string' ? data.id.trim().toUpperCase() : '';

  if (!rawId || !/^[A-Z0-9_-]{2,32}$/.test(rawId)) {
    return { error: 'Coach id must be 2-32 chars (letters, numbers, - or _)' };
  }

  const displayName = typeof data.displayName === 'string' ? data.displayName.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim() : '';
  const timezone = typeof data.timezone === 'string' ? data.timezone.trim() : '';

  if (!displayName) return { error: 'Display name is required' };
  if (!email || !email.includes('@')) return { error: 'A valid email is required' };
  if (!timezone) return { error: 'Timezone is required' };

  const workingHours = data.workingHours as Record<string, Record<string, unknown>> | undefined;
  const prices = data.prices as Record<string, unknown> | undefined;

  const hours = [
    workingHours?.morning?.start, workingHours?.morning?.end,
    workingHours?.afternoon?.start, workingHours?.afternoon?.end,
  ];
  if (!workingHours || !hours.every(isValidHour)) {
    return { error: 'Working hours must be integers between 0 and 23' };
  }

  if (!prices || ![prices.singleSession, prices.weekly, prices.twiceWeekly].every(isValidPrice)) {
    return { error: 'Prices must be non-negative numbers' };
  }

  const paymentProvider = data.paymentProvider as CoachPaymentProvider;
  if (!PAYMENT_PROVIDERS.includes(paymentProvider)) {
    return { error: `Invalid payment provider: ${data.paymentProvider}` };
  }

  const meetingProvider = data.meetingProvider as CoachMeetingProvider;
  if (!MEETING_PROVIDERS.includes(meetingProvider)) {
    return { error: `Invalid meeting provider: ${data.meetingProvider}` };
  }

  return {
    id: rawId,
    coach: {
      name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : displayName,
      displayName,
      description: typeof data.description === 'string' ? data.description : '',
      photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : '',
      timezone,
      email,
      workingHours: {
        morning: { start: workingHours.morning.start as number, end: workingHours.morning.end as number },
        afternoon: { start: workingHours.afternoon.start as number, end: workingHours.afternoon.end as number },
      },
      prices: {
        singleSession: prices.singleSession as number,
        weekly: prices.weekly as number,
        twiceWeekly: prices.twiceWeekly as number,
      },
      paymentProvider,
      meetingProvider,
    },
  };
}
