import { loadEnvConfig } from '@next/env';
import { encode } from 'next-auth/jwt';
import type { Page } from '@playwright/test';

loadEnvConfig(process.cwd());

const SESSION_COOKIE_NAME = 'authjs.session-token';
const SESSION_SALT = SESSION_COOKIE_NAME;

export function getAdminEmail(): string {
  const email = (process.env.ADMIN_EMAILS || '').split(',')[0]?.trim();
  if (!email) {
    throw new Error('ADMIN_EMAILS is not set in the local env; cannot mint an e2e admin session');
  }
  return email;
}

export async function loginAsAdmin(page: Page): Promise<void> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET is not set in the local env; cannot mint an e2e admin session');
  }

  const value = await encode({
    token: {
      email: getAdminEmail(),
      name: 'E2E Admin',
      sub: 'e2e-admin',
    },
    secret,
    salt: SESSION_SALT,
  });

  await page.context().addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

async function getAdminCookieHeader(): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET is not set in the local env; cannot mint an e2e admin session');
  }
  const value = await encode({
    token: {
      email: getAdminEmail(),
      name: 'E2E Admin',
      sub: 'e2e-admin',
    },
    secret,
    salt: SESSION_SALT,
  });
  return `${SESSION_COOKIE_NAME}=${value}`;
}

const ADMIN_BASE_URL = 'http://localhost:3120';

export async function adminApiFetch(pathname: string, init: RequestInit = {}): Promise<Response> {
  const cookie = await getAdminCookieHeader();
  const headers = new Headers(init.headers);
  headers.set('Cookie', cookie);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`${ADMIN_BASE_URL}${pathname}`, { ...init, headers });
}
