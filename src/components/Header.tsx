import Link from 'next/link'
import { ThemeToggle } from './ui/ThemeToggle'
import { Logo } from './Logo'

export function Header() {
  return (
    <header className="w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex items-center justify-between py-4">
        <div className="px-6">
          <Link href="/" className="font-bold">
            <Logo />
          </Link>
        </div>
        <div className="px-6">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
} 