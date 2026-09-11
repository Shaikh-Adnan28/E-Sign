import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "ESign — E-Signature Platform",
    template: "%s | ESign",
  },
  description:
    "Send, sign, and manage documents electronically. The modern e-signature platform built for speed and simplicity.",
  keywords: ["e-signature", "digital signature", "document signing", "esign"],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full bg-slate-50 text-slate-900" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
