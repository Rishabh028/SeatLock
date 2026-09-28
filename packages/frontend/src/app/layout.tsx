import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { Shell } from '@/components/Shell';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SeatLock — Concurrency-Safe Event Booking',
  description: 'Event booking system demonstrating PostgreSQL row-level locking, partial unique indexes, idempotent payments, and webhook deduplication.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-black text-white antialiased`}>
        <AuthProvider>
          <Shell>{children}</Shell>
        </AuthProvider>
      </body>
    </html>
  );
}
