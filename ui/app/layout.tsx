import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono, Roboto_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import PrivyProviderWrapper from "@/providers/PrivyProvider";
import ErrorBoundary from "@/components/ErrorBoundary";
import FeedbackWidget from "@/components/FeedbackWidget";
import MobileBlocker from "@/components/MobileBlocker";
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

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
});

const rinter = localFont({
  src: "../public/fonts/Rinter.ttf",
  variable: "--font-rinter",
});

export const metadata: Metadata = {
  title: "Percent | ZC",
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
        <script src="/charting_library/charting_library/charting_library.standalone.js" async></script>
      </head>
      <body
        className={`${inter.variable} ${ibmPlexMono.variable} ${robotoMono.variable} ${rinter.variable} font-sans antialiased bg-[#0a0a0a] text-white`}
      >
        <ErrorBoundary>
          <MobileBlocker>
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
          </MobileBlocker>
        </ErrorBoundary>
      </body>
    </html>
  );
}
