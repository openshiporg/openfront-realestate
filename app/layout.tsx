import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getBrokerageSettings } from "@/features/storefront/lib/data/settings";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Every storefront and dashboard layout sets its own title, so this one only shows on unmatched URLs,
// which 404 outside the storefront layout. No template here: it would wrap the child layouts' titles.
export async function generateMetadata(): Promise<Metadata> {
  const state = await getBrokerageSettings();
  const name = state.status === "ready" ? state.settings.businessName : "Openfront Real Estate";
  return {
    title: `Page not found · ${name}`,
    description: "Homes for sale and rent.",
    // Storefront pages and the 404 replace this with the brokerage mark.
    icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
