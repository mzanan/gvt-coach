import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/app/components/core/ThemeProvider"
import { Header } from "@/app/components/core/Header"
import { Footer } from "@/app/components/core/Footer"
import { SITE_CONFIG } from "@/config/site"
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: SITE_CONFIG.siteName,
  description: SITE_CONFIG.siteDescription,
  icons: {
    icon: { url: SITE_CONFIG.logoPath, type: 'image/svg+xml' },
    shortcut: { url: SITE_CONFIG.logoPath, type: 'image/svg+xml' }
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}>
      <ThemeProvider 
          attribute="class" 
          defaultTheme="system" 
          enableSystem 
          disableTransitionOnChange
        >
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 px-4 md:px-0">
              {children}
            </main>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
