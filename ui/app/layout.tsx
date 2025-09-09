import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import WalletContextProvider from "@/providers/WalletProvider";
import ErrorBoundary from "@/components/ErrorBoundary";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-mono",
});

export const metadata: Metadata = {
  title: "Prediction Market",
  description: "Trade on governance proposal outcomes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script src="https://s3.tradingview.com/tv.js" async></script>
      </head>
      <body
        className={`${inter.variable} ${ibmPlexMono.variable} font-sans antialiased bg-gray-950 text-white`}
      >
        <ErrorBoundary>
          <WalletContextProvider>
            {children}
          </WalletContextProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
