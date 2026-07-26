import { BookingHome } from "./components/features/booking/BookingHome"
import { AppConfigProvider } from "./components/core/AppConfigProvider"
import { getAppConfig } from "@/config/appConfig"

export const dynamic = 'force-dynamic'

export default async function Home() {
  const config = await getAppConfig()

  return (
    <AppConfigProvider config={config}>
      <BookingHome />
    </AppConfigProvider>
  )
}
