'use client';

import { createClient } from '@/lib/supabase/client'
import { getClientCookie } from '@/lib/utils/cookies'

const supabase = createClient()

export const userService = {
  /**
   * Gets user data from public.tn_profiles
   * @returns The raw user data from the query
   */
  getUserFromAuthUsers: async () => {
    try {
      // TODO: Replace with tradernaut user data and enable RLS security on GVT_COACH tables
      const email = 'matiaszanan@gmail.com';
      const userId = '6e17f4ff-2351-4250-a360-eb8a4bdfeafe';
      const timezone = typeof window !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
      
      // Try to get orderId from pending cookie
      let orderId = null;
      if (typeof window !== 'undefined') {
        const pendingBooking = getClientCookie('pending_booking');
        if (pendingBooking && pendingBooking.orderId) {
          orderId = pendingBooking.orderId;
        }
      }
      
      // Try to find user by either email OR user_id
      const { data, error } = await supabase
        .from('tn_profiles')
        .select('*')
        .or('email.eq.' + email + ',user_id.eq.' + userId);
      
      if (!error && data && data.length > 0) {
        // Found user, format and return data with consistent format
        const profileData = {
          id: data[0].id,
          user_id: userId,
          email,
          first_name: 'Matias',
          last_name: 'Zanan',
          timezone,
          orderId
        };
        
        return profileData;
      }
      
      // If we reach here, either there was an error or no data found
      // Create hardcoded data for testing with consistent format
      const hardcodedData = {
        id: 9,
        user_id: userId,
        email: email,
        name: 'Matias Zanan',
        first_name: 'Matias',
        last_name: 'Zanan',
        timezone,
        orderId
      };
      
      return hardcodedData;
    } catch {
      const timezone = typeof window !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
      
      // Try to get orderId from pending cookie even in case of error
      let orderId = null;
      if (typeof window !== 'undefined') {
        const pendingBooking = getClientCookie('pending_booking');
        if (pendingBooking && pendingBooking.orderId) {
          orderId = pendingBooking.orderId;
        }
      }
      
      // Create hardcoded data as fallback with consistent format
      const hardcodedData = {
        id: 9, 
        user_id: '6e17f4ff-2351-4250-a360-eb8a4bdfeafe',
        email: 'matiaszanan@gmail.com',
        name: 'Matias Zanan',
        first_name: 'Matias',
        last_name: 'Zanan',
        timezone,
        orderId
      };
      
      return hardcodedData;
    }
  }
}