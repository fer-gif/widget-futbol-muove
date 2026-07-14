import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Muove | Plataforma de Widgets de Fútbol",
  description: "Ecosistema de widgets deportivos personalizables y autogestionados de alta concurrencia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${outfit.variable} h-full antialiased`}>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="min-h-full bg-[#09090b] text-[#f4f4f5] flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
