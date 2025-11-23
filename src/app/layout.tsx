import type { Metadata } from 'next';
import { Space_Grotesk, Inter } from 'next/font/google';
import { TopNavWrapper } from '@/components/layout/TopNavWrapper';
import { ToastProvider } from '@/components/ui';
import '@/styles/globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AlcheMix - Your Cocktail Lab Assistant',
  description: 'Modern cocktail lab management system with AI-powered recommendations',
  icons: {
    icon: '/favicon-32x32.png',
    apple: '/favicon-32x32.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body>
        <ToastProvider>
          <TopNavWrapper />
          <main>{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
