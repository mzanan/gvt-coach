import { SITE_CONFIG } from '@/config/site'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="w-full bg-background">
      <div className="container mx-auto py-8 md:py-12 text-center mx-auto">
          <p className="text-sm">© {year} {SITE_CONFIG.companyName}. All rights reserved.</p>
      </div>
    </footer>
  )
}
