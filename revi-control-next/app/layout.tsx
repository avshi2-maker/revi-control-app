import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Revi-Control — מרכז שליטה לצי ריסוס אוטונומי",
  description: "Autonomous Spray Fleet Command Center",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
