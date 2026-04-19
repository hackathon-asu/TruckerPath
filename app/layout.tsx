import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Dispatcher CoPilot · TruckerPath",
  description: "AI-native fleet operations assistant — smart dispatch, parking risk, detention impact, and proactive alerts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="h-full font-sans">{children}</body>
    </html>
  );
}
