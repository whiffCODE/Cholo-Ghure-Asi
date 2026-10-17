import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: {
    default: "Cholo Ghure Asi | Kolkata Puja Guide",
    template: "%s | Cholo Ghure Asi",
  },
  description:
    "Discover Kolkata Durga Puja pandals, plan routes, find metro stations and explore with friends.",
  icons: {
    icon: "/cga_icon.png",
    shortcut: "/cga_icon.png",
    apple: "/cga_icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff8eb" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1014" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}