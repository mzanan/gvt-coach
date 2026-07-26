import { CoachConfig } from '@/types/coach'

export type CoachId = string;

export const COACHES_CONFIG: Record<string, CoachConfig> = {
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
