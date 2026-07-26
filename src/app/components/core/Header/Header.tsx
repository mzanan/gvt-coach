import Link from 'next/link'
import { ThemeToggle } from '@/app/components/ui-kit/ThemeToggle'
import { UserMenu } from '@/app/components/core/UserMenu'
import { auth, isAdminEmail } from '@/auth'
import { Logo } from '../Logo/Logo'

export async function Header() {
  const session = await auth()
  const user = isAdminEmail(session?.user?.email) ? session?.user : null

  return (
    <header className="w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="page-container flex items-center justify-between gap-4 py-4">
        <Link href="/" className="font-bold">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user?.email && (
            <UserMenu email={user.email} name={user.name} image={user.image} />
          )}
        </div>
      </div>
    </header>
  )
}
