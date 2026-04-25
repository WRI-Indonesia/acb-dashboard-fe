import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: "ASEAN Centre for Biodiversity Dashboard",
  description:
    "Access the ASEAN Centre for Biodiversity interactive map to explore real-time data on ecosystems, species distribution, and protected areas across the region",
  icons: {
    icon: "/bsf_logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
