import { auth, signIn, signOut, isAdminEmail } from '@/auth'
import { getAppConfig } from '@/config/appConfig'
import { Button } from '@/app/components/ui-kit/button'
import { AdminPanel } from '@/app/components/features/admin/AdminPanel'

export default async function AdminPage() {
  const session = await auth()

  if (!isAdminEmail(session?.user?.email)) {
    return (
      <main className="container mx-auto py-24 flex flex-col items-center gap-6">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-muted-foreground">Sign in with an authorized Google account to manage the site configuration.</p>
        <form
          action={async () => {
            'use server'
            await signIn('google', { redirectTo: '/admin' })
          }}
        >
          <Button type="submit">Sign in with Google</Button>
        </form>
      </main>
    )
  }

  const config = await getAppConfig()

  return (
    <main className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin</h1>
          <p className="text-sm text-muted-foreground">{session?.user?.email}</p>
        </div>
        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/' })
          }}
        >
          <Button type="submit" variant="outline">Sign out</Button>
        </form>
      </div>
      <AdminPanel initialConfig={config} />
    </main>
  )
}
