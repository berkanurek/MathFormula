import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Analytics } from "@vercel/analytics/next";
import "katex/dist/katex.min.css";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      suppressHydrationWarning
      className={`${inter.variable} h-full scroll-smooth antialiased`}
    >
      <head>
        {/* Material Symbols — loaded from Google Fonts CDN (not bundled in next/font). */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- icon font; Inter uses next/font above */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <ThemeProvider>{children}</ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
