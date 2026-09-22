import type { Metadata } from 'next';
import './globals.css';
import { I18nProvider } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'Shiv Shakti — Bus Travel Booking',
  description:
    'Book intercity bus tickets online with Shiv Shakti. Jharsuguda to Bangalore — safe, reliable travel.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white font-sans antialiased text-charcoal">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
