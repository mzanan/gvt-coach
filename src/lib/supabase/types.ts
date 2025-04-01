import { BookingFrequency, PaymentOrderStatus } from '@/types/enums/booking';

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
  status: PaymentOrderStatus;
  meet_link: string;
  recurring_day?: string; 
  recurring_time?: string;
  second_booking_date?: string | null;
  duration?: number;
}