import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

export const dynamic = 'force-dynamic'

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: { default: "Whistle Business Suite", template: "%s | WBS" },
  description: "All-in-one business management for South African SMBs",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
