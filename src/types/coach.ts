export interface WorkingHours {
  morning: {
    start: number;
    end: number;
  };
  afternoon: {
    start: number;
    end: number;
  };
}

export type CoachPaymentProvider = 'stripe' | 'polar' | 'disabled';
export type CoachMeetingProvider = 'zoom' | 'google-meet';

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
  paymentProvider?: CoachPaymentProvider;
  meetingProvider?: CoachMeetingProvider;
  polarProductId?: string;
}

export interface CoachRecord extends CoachConfig {
  id: string;
  paymentProvider: CoachPaymentProvider;
  meetingProvider: CoachMeetingProvider;
  polarProductId: string;
}
