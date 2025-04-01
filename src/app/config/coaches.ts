import { DateTime } from 'luxon'

/**
 * Available coaches for booking
 */
export enum Coach {
  Matias = 'MATIAS',
  Gabriel = 'GABRIEL'
}

interface WorkingHours {
  morning: {
    start: number;  // UTC hour
    end: number;    // UTC hour
  };
  afternoon: {
    start: number;  // UTC hour
    end: number;    // UTC hour
  };
}

interface CoachConfig {
  name: string;
  displayName: string;
  description: string;
  photoUrl: string;
  timezone: string;
  email: string;
  workingHours: WorkingHours;
  prices: {
    singleSession: number;
    weekly: number;
    twiceWeekly: number;
  };
}

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

export const COACHES_CONFIG: Record<Coach, CoachConfig> = {
  [Coach.Matias]: {
    name: 'Matias',
    displayName: 'Matias',
    description: 'Basic coaching sessions for beginners',
    photoUrl: '/coaches/matias.jpg',
    timezone: 'Asia/Saigon',
    email: 'mzanan.net@gmail.com',
    workingHours: {
      morning: {
        start: 1,  // UTC
        end: 4,    // UTC
      },
      afternoon: {
        start: 12, // UTC
        end: 16,   // UTC
      }
    },
    prices: {
      singleSession: 50,
      weekly: 200,
      twiceWeekly: 350
    }
  },
  [Coach.Gabriel]: {
    name: 'Gabriel',
    displayName: 'Gabriel',
    description: 'Advanced coaching sessions',
    photoUrl: '/coaches/gabriel.jpg',
    timezone: 'Asia/Saigon',
    email: 'coaching@gvtnomad.com',
    workingHours: {
      morning: {
        start: 1,  // UTC
        end: 4,    // UTC
      },
      afternoon: {
        start: 12, // UTC
        end: 16,   // UTC
      }
    },
    prices: {
      singleSession: 100,
      weekly: 400,
      twiceWeekly: 700
    }
  }
}

// Export helper functions for use in other parts of the application
export function getCoachLocalWorkingHours(coach: Coach, timezone: string) {
  const config = COACHES_CONFIG[coach];
  return getLocalWorkingHours(config.workingHours, timezone);
} 