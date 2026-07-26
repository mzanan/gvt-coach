import { NextResponse } from 'next/server';
import { auth, isAdminEmail } from '@/auth';

export async function requireAdmin() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return null;
  }
  return session;
}

type RouteHandler<Args extends unknown[]> = (...args: Args) => Promise<NextResponse>;

export function withAdmin<Args extends unknown[]>(handler: RouteHandler<Args>): RouteHandler<Args> {
  return async (...args: Args) => {
    try {
      const session = await requireAdmin();
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return await handler(...args);
    } catch (error) {
      console.error('[admin route] Error:', error);
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  };
}
