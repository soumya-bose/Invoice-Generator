import { Inter } from "next/font/google"

import "./globals.css"
import "@/src/styles.css"
import { ThemeProvider } from "@/components/theme-provider"

export const metadata = {
  title: "Invoice Generator",
  description: "Create clean, professional invoices in seconds",
  icons: {
    icon: "/images/receipt-printer-logo.svg",
    shortcut: "/images/receipt-printer-logo.svg",
    apple: "/images/receipt-printer-logo.svg",
  },
}

const inter = Inter({ subsets: ["latin"], variable: "--loaded-inter" })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
