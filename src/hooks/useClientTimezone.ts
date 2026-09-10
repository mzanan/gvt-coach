'use client'

import { DEFAULT_TIMEZONE } from '@/config/site'
import { getTimezoneCookie, setTimezoneCookie, deleteClientCookie, LEGACY_TIMEZONE_COOKIE } from '@/lib/utils/cookies'
import { createClientValue } from '@/hooks/createClientValue'

let legacyCookieCleared = false

const clearLegacyTimezoneCookie = () => {
  if (legacyCookieCleared || typeof window === 'undefined') return

  legacyCookieCleared = true
  deleteClientCookie(LEGACY_TIMEZONE_COOKIE)
}

const readTimezone = () => {
  clearLegacyTimezoneCookie()

  return getTimezoneCookie()
    || Intl.DateTimeFormat().resolvedOptions().timeZone
    || DEFAULT_TIMEZONE
}

export const useClientTimezone = createClientValue<string>(
  readTimezone,
  DEFAULT_TIMEZONE,
  setTimezoneCookie
)
