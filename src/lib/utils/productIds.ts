import { CoachRecord } from '@/types/coach';

export function getPolarProductId(coach: CoachRecord | undefined): string | null {
  return coach?.polarProductId?.trim() || null;
}
