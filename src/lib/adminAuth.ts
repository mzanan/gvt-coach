import { auth, isAdminEmail } from '@/auth';

export async function requireAdmin() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return null;
  }
  return session;
}
