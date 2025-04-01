import { CoachId } from '@/config/coaches'; // Use CoachId type


export interface EmailNotificationOptions {
  to?: string;
  bookingDetails: {
    start_time: string | Date;
    end_time: string | Date;
    zoom_link?: string;
    user_name?: string;
    booking_id: string;
  };
  type: 'confirmation' | 'reminder' | 'cancellation';
  userTimezone?: string;
}

export interface EmailData {
  to: string | string[];
  from?: string; 
  subject: string;
  html: string;
  text?: string;
}

export interface ConfirmationEmailProps {
  start_time: string | Date;
  end_time: string | Date;
  zoom_link?: string;
  user_name?: string;
  user_email: string;
  user_timezone?: string;
  coach: CoachId;
  booking_id?: string;
  checkout_order_id?: string;
  payment_status?: string;
  payment_confirmed?: boolean;
  payment_provider?: string;
}
