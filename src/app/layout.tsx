import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import ThemeProvider from "@/components/ThemeProvider";
import { I18nProvider } from "@/lib/i18n";
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
  description: "Manage your expenses, income, savings, and investments with ease.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Money Meva" },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    apple: "/icon-512.png",
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
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </I18nProvider>
          <RegisterSW />
        </ThemeProvider>
      </body>
    </html>
  );
}
