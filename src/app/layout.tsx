import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Baloo_2, Nunito } from "next/font/google";
import { themeCss } from "@/ui/themes";
import "./globals.css";

const baloo = Baloo_2({ subsets: ["latin", "vietnamese"], variable: "--font-baloo", display: "swap" });
const nunito = Nunito({ subsets: ["latin", "vietnamese"], variable: "--font-nunito", display: "swap" });

export const metadata: Metadata = {
  title: "Sao nhà mình",
  description: "Thưởng, phạt và nhiệm vụ hằng ngày cho cả gia đình",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={`${baloo.variable} ${nunito.variable} h-full antialiased`}>
      <head>
        <style>{themeCss()}</style>
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
