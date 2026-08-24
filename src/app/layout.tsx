import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import ThemeProvider from "@/components/ThemeProvider";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/Toast";
import RegisterSW from "@/components/RegisterSW";
import { readFileSync } from "fs";
import { join } from "path";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

let APP_VERSION = '0.0.0';
try { APP_VERSION = readFileSync(join(process.cwd(), "VERSION"), "utf-8").trim(); } catch {}

export const metadata: Metadata = {
  title: "Money Meva - Personal Finance App",
  description: "Manage your expenses, income, savings, and investments with ease. à¤ªà¥ˆà¤¸à¥‡ à¤•à¥à¤ à¥‡ à¤œà¤¾à¤¤à¤¾à¤¤? à¤¶à¥‹à¤§à¥‚à¤¯à¤¾. â€” Local-first, privacy-focused, multi-language personal finance companion.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Money Meva" },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    apple: "/icon-512.png",
  },
  openGraph: {
    title: "Money Meva â€” Personal Finance App",
    description: "à¤ªà¥ˆà¤¸à¥‡ à¤•à¥à¤ à¥‡ à¤œà¤¾à¤¤à¤¾à¤¤? à¤¶à¥‹à¤§à¥‚à¤¯à¤¾. Manage expenses, income, savings, and investments. Local-first, multi-language, privacy-focused.",
    url: "https://moneymevaonline.pages.dev",
    siteName: "Money Meva",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Money Meva â€” Where does the money go? Let's find out.",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Money Meva â€” Personal Finance App",
    description: "à¤ªà¥ˆà¤¸à¥‡ à¤•à¥à¤ à¥‡ à¤œà¤¾à¤¤à¤¾à¤¤? à¤¶à¥‹à¤§à¥‚à¤¯à¤¾. Local-first personal finance companion.",
    images: ["/og-image.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  metadataBase: new URL("https://moneymevaonline.pages.dev"),
  other: {
    "sitemap": "/sitemap.xml",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <meta name="theme-color" content="#FF8A3D" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="app-version" content={APP_VERSION} />
        <link rel="apple-touch-icon" href="/icon-512.png" />
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <I18nProvider>
            <ToastProvider>
              <AuthProvider>
                {children}
              </AuthProvider>
            </ToastProvider>
          </I18nProvider>
          <RegisterSW />
        </ThemeProvider>
      </body>
    </html>
  );
}
