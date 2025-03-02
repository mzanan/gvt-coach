export enum BookingStatus {
  Confirmed = 'CONFIRMED',
  Pending = 'PENDING',
  Cancelled = 'CANCELLED'
}

export enum BookingFrequency {
  Once = 'ONCE',
  Weekly = 'WEEKLY',
  TwiceWeekly = 'TWICE_WEEKLY'
}

export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  timezone?: string;
  full_name?: string;
}

export interface BookingDB {
  id: string;
  user_email: string;
  booking_date: string;
  end_date?: string;
  frequency: BookingFrequency;
  status: BookingStatus;
  meet_link: string;
  recurring_day?: string; 
  recurring_time?: string;
  second_booking_date?: string | null;
  duration?: number;
}