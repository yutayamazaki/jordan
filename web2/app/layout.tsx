import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { AppLayout } from "@/components/layout/app-layout";

export const metadata: Metadata = {
  title: "Jordan - Lead Intelligence",
  description: "UI for exploring Jordan's collected lead data",
  icons: "/favicon.jpg",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
