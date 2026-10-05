import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "LiveLift — Livestream Commerce Operational Desk",
  description:
    "Operational decision, evidence, replay, and learning workspace for livestream commerce.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${rubik.variable} min-h-screen bg-[#090B0F] text-[#F5F7FC] antialiased`}>
        {children}
      </body>
    </html>
  );
}
