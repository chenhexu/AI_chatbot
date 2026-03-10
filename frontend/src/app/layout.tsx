import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Collège Saint-Louis - Chatbot",
  description: "Une fenêtre ouverte sur le monde",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
