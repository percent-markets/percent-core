import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import PrivyProviderWrapper from "@/providers/PrivyProvider";
import ErrorBoundary from "@/components/ErrorBoundary";
import FeedbackWidget from "@/components/FeedbackWidget";
import { Toaster } from "react-hot-toast";

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
  title: "Percent | oogway",
  description: "Trade decision markets",
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
          <PrivyProviderWrapper>
            {children}
            <FeedbackWidget />
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: '#272727',
                  color: '#fff',
                  borderRadius: '8px',
                  border: '1px solid #404040',
                },
                success: {
                  iconTheme: {
                    primary: '#10b981',
                    secondary: '#fff',
                  },
                },
                error: {
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </PrivyProviderWrapper>
        </ErrorBoundary>
      </body>
    </html>
  );
}
