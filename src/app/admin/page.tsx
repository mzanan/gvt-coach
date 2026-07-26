import { auth, isAdminEmail } from '@/auth'
import { signInWithGoogle } from '@/app/actions/auth'
import { getAppConfig } from '@/config/appConfig'
import { Button } from '@/app/components/ui-kit/button'
import { Card } from '@/app/components/ui-kit/card'
import { GoogleIcon } from '@/app/components/ui-kit/GoogleIcon'
import { AdminPanel } from '@/app/components/features/admin/AdminPanel'

export default async function AdminPage() {
  const session = await auth()

  if (!isAdminEmail(session?.user?.email)) {
    return (
      <div className="page-container py-24 flex justify-center">
        <Card className="w-full max-w-sm p-8 flex flex-col items-center gap-6 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Admin</h1>
            <p className="text-sm text-muted-foreground">
              Sign in with an authorized Google account to manage the site configuration.
            </p>
          </div>
          <form action={signInWithGoogle} className="w-full">
            <Button type="submit" variant="outline" className="w-full gap-2">
              <GoogleIcon />
              Sign in with Google
            </Button>
          </form>
        </Card>
      </div>
    )
  }

  const config = await getAppConfig()

  return (
    <div className="page-container py-8 md:py-12">
      <AdminPanel initialConfig={config} />
    </div>
  )
}
