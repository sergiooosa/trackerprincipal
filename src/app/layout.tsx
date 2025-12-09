import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import ChatWidget from "@/components/ChatWidget";

const clientName = process.env.NEXT_PUBLIC_CLIENT_NAME || "Cliente";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${clientName} - Dashboard`,
  description: "Panel de control",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Barra superior con el nombre del cliente (izquierda) */}
        <div className="w-full border-b border-neutral-800 bg-neutral-950">
          <div className="mx-auto max-w-screen-2xl px-4 h-12 flex items-center">
            <div className="text-sm font-medium text-white">{clientName}</div>
          </div>
        </div>
        <Providers>{children}</Providers>
        {typeof window !== 'undefined' && process.env.NEXT_PUBLIC_CHATBOT_ENABLED === 'true' && (
          <ChatWidget />
        )}
      </body>
    </html>
  );
}
