import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import 'katex/dist/katex.min.css'

const inter = Inter({ subsets: ["latin"] })

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://chat-mango.vercel.app"

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "chatMango: Model AI Ne Wong Reang",
    template: "%s | chatMango",
  },
  description:
    "chatMango adalah chatbot AI dengan bahasa Indramayu (Jawa Indramayu). Takon apa bae, reang sing jawab. Platform percakapan cerdas yang merespons dalam dialek lokal Indramayu untuk pengalaman berbicara yang lebih akrab dan natural.",
  generator: "v0.dev",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "chatMango: Model AI Ne Wong Reang",
    description:
      "chatMango adalah chatbot AI dengan bahasa Indramayu. Takon apa bae, reang sing jawab.",
    url: baseUrl,
    siteName: "chatMango",
    images: [
      {
        url: "/favicon.svg",
        width: 32,
        height: 32,
        alt: "chatMango Logo",
      },
      {
        url: "/images/fix_chatMango-removebg-preview.svg",
        width: 426,
        height: 586,
        alt: "chatMango - Chatbot AI Bahasa Indramayu",
      },
    ],
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "chatMango: Model AI Ne Wong Reang",
    description: "chatMango - Chatbot AI dengan bahasa Indramayu. Takon apa bae, reang sing jawab.",
    images: ["/favicon.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="icon" href="/favicon.svg" />
        <meta name="google-site-verification" content="2gmumy-6QJqokZ-eBWIYUwPBlvDJS5o-J9YfY390bjg" />
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"          // ← ganti dari "light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
