import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "WHOOP AI Assistant",
  description: "A private WHOOP data assistant for daily recovery, sleep, strain, and training guidance."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
