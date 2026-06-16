import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resale Intelligence Assistant",
  description: "Dataset-grounded pricing guidance for clothing resellers.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
