import { getEffectiveSiteConfig } from '@/config/appConfig'

export async function Footer() {
  const site = await getEffectiveSiteConfig()
  const year = new Date().getFullYear()

  return (
    <footer className="w-full bg-background">
      <div className="container mx-auto py-8 md:py-12 text-center mx-auto">
          <p className="text-sm">© {year} {site.companyName}. All rights reserved.</p>
      </div>
    </footer>
  )
}
