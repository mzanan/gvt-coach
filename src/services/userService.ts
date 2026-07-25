'use client';

import { getClientCookie } from '@/lib/utils/cookies'
import { DEFAULT_TIMEZONE } from '@/config/site'

export const userService = {
  getUserFromAuthUsers: async () => {
    const timezone = typeof window !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : DEFAULT_TIMEZONE;

    let orderId = null;
    if (typeof window !== 'undefined') {
      const pendingBooking = getClientCookie('pending_booking');
      if (pendingBooking && pendingBooking.orderId) {
        orderId = pendingBooking.orderId;
      }
    }

    return {
      id: 9,
      user_id: '6e17f4ff-2351-4250-a360-eb8a4bdfeafe',
      email: 'matiaszanan@gmail.com',
      name: 'Matias Zanan',
      first_name: 'Matias',
      last_name: 'Zanan',
      timezone,
      orderId
    };
  }
}
