export interface WorkingHours {
  morning: {
    start: number;  // UTC hour
    end: number;    // UTC hour
  };
  afternoon: {
    start: number;  // UTC hour
    end: number;    // UTC hour
  };
}

export interface CoachConfig {
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