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

// The brokerage name is the title template everywhere, including unmatched URLs that 404 outside the storefront layout.
export async function generateMetadata(): Promise<Metadata> {
  const state = await getBrokerageSettings();
  const name = state.status === "ready" ? state.settings.businessName : "Openfront Real Estate";
  return {
    title: { default: name, template: `%s · ${name}` },
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
