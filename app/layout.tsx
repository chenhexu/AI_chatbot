import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Collège Saint-Louis - AI Chatbot",
  description: "AI chatbot for Collège Saint-Louis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}


