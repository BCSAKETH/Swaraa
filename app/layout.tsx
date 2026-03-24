import type React from "react"
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Swaraa — where every note breathes",
  description: "AI-powered browser harmonium. 60+ songs, Raga mode, guided practice, recordings.",
  icons: { icon: "/favicon.png" }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
