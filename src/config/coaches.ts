import { DateTime } from 'luxon'
import { CoachConfig, WorkingHours } from '@/types/coach'

// Define AND export Coach ID type locally as a workaround
export type CoachId = 'MATIAS' | 'GABRIEL';

// Helper function to format time in coach's timezone
function getLocalTime(utcHour: number, timezone: string): string {
  const result = DateTime.fromObject({ hour: utcHour }, { zone: 'UTC' })
    .setZone(timezone);
  
  return result.toFormat('h:mm a');
}

// Helper to get working hours in local timezone
function getLocalWorkingHours(workingHours: WorkingHours, timezone: string) {
  return {
    morning: {
      start: getLocalTime(workingHours.morning.start, timezone),
      end: getLocalTime(workingHours.morning.end, timezone)
    },
    afternoon: {
      start: getLocalTime(workingHours.afternoon.start, timezone),
      end: getLocalTime(workingHours.afternoon.end, timezone)
    }
  };
}

export const COACHES_CONFIG: Record<CoachId, CoachConfig> = {
  'MATIAS': { 
    name: 'Matias',
    displayName: 'Matias',
    description: 'Basic coaching sessions for beginners',
    photoUrl: '/coaches/matias.jpg',
    timezone: 'Asia/Saigon',
    email: 'mzanan.net@gmail.com',
    workingHours: {
      morning: {
        start: 1,  
        end: 4,    
      },
      afternoon: {
        start: 12, 
        end: 16,   
      }
    },
    prices: {
      singleSession: 50,
      weekly: 200,
      twiceWeekly: 350
    }
  },
  'GABRIEL': { 
    name: 'Gabriel',
    displayName: 'Gabriel',
    description: 'Advanced coaching sessions',
    photoUrl: '/coaches/gabriel.jpg',
    timezone: 'Asia/Saigon', 
    email: 'coaching@gvtnomad.com',
    workingHours: {
      morning: { start: 1, end: 4 },
      afternoon: { start: 12, end: 16 }
    },
    prices: {
      singleSession: 100,
      weekly: 400,
      twiceWeekly: 700
    }
  }
};

// Export helper functions using the local CoachId type
export function getCoachLocalWorkingHours(coach: CoachId, timezone: string) {
  const config = COACHES_CONFIG[coach];
  if (!config) {
      console.warn(`Configuration for coach ${coach} not found.`);
      return { morning: { start: '', end: '' }, afternoon: { start: '', end: '' } }; 
  }
  return getLocalWorkingHours(config.workingHours, timezone);
}

// Get coach timezone from config
export function getCoachTimezone(coachId: CoachId = 'MATIAS'): string | null { 
  const timezone = COACHES_CONFIG[coachId]?.timezone;
  if (!timezone) {
      console.error(`Timezone for coach ${coachId} not found in COACHES_CONFIG.`);
      return null; 
  }
  return timezone;
} 