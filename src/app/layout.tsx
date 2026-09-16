import type { Metadata, Viewport } from "next";
import "./globals.css";
import PWARegister from "@/components/pwa-register";
import InstallPrompt from "@/components/install-prompt";
import CommandPalette from "@/components/command-palette";
import FeatureTour from "@/components/showcase/feature-tour";

export const metadata: Metadata = {
  title: "Nexel AI — Transform PDFs into Interactive Knowledge",
  description:
    "AI-powered study workspace. Chat with PDFs, generate notes, flashcards, and quizzes.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Nexel AI",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#a855f7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <PWARegister />
        <InstallPrompt />
        <CommandPalette />
        <FeatureTour />
      </body>
    </html>
  );
}