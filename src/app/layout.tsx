import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import Link from "next/link"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "BookLibrary",
  description: "Personal book library management app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background antialiased`}
      >
        <nav className="border-b border-border/50">
          <div className="w-full px-6 flex h-16 items-center">
            <Link
              href="/"
              className="text-2xl font-light tracking-tight text-foreground"
            >
              BookLibrary
            </Link>
            <div className="ml-auto flex items-center space-x-8">
              <Link
                href="/"
                className="text-sm font-normal text-muted-foreground hover:text-foreground transition-colors"
              >
                Library
              </Link>
              <Link
                href="/search"
                className="text-sm font-normal text-muted-foreground hover:text-foreground transition-colors"
              >
                Search
              </Link>
            </div>
          </div>
        </nav>
        <main className="flex-1">
          <div className="w-full px-6 py-8">{children}</div>
        </main>
      </body>
    </html>
  )
}
