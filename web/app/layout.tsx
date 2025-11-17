import type { ReactNode } from "react";
import "./globals.css";
import { AppLayout } from "@/components/layout/app-layout";

export const metadata = {
  title: "Jordan - Lead Intelligence",
  description: "UI for exploring Jordan's collected lead data"
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

