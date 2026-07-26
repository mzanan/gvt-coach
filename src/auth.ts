import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  callbacks: {
    signIn({ user }) {
      return isAdminEmail(user.email);
    },
    authorized({ auth }) {
      return isAdminEmail(auth?.user?.email);
    },
  },
});
