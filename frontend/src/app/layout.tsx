import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Collège Saint-Louis - Chatbot",
  description: "Une fenêtre ouverte sur le monde",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
