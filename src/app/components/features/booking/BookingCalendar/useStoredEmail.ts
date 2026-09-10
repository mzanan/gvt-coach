'use client'

import { getClientCookie, setClientCookie, USER_EMAIL_COOKIE } from '@/lib/utils/cookies'
import { createClientValue } from './createClientValue'

const readStoredEmail = () => {
  const stored = getClientCookie(USER_EMAIL_COOKIE)

  return stored ? String(stored) : ''
}

const writeStoredEmail = (email: string) => setClientCookie(USER_EMAIL_COOKIE, email)

export const useStoredEmail = createClientValue<string>(readStoredEmail, '', writeStoredEmail)
