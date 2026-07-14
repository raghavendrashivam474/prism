import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRISM — Visual Execution",
  description: "Interactive C++ execution visualiser",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}