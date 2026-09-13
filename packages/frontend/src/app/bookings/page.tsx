'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getMyBookings, BookingDetail } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatPrice } from '@/lib/utils';

export default function BookingsPage() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [bookings, setBookings] = useState<BookingDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    getMyBookings(token)
      .then(res => setBookings(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, router]);

  if (!user) return null;

  const statusColor: Record<string, string> = {
    CONFIRMED: 'text-green-400 bg-green-500/10',
    PENDING: 'text-amber-400 bg-amber-500/10',
    CANCELLED: 'text-red-400 bg-red-500/10',
    EXPIRED: 'text-gray-400 bg-gray-500/10',
  };

  return (
    <div className="animate-fadeIn">
      <h1 className="text-3xl font-bold mb-2">My Bookings</h1>
      <p className="text-gray-400 mb-8">Your booking history and upcoming events.</p>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[#12121a] border border-[#1e1e2e] rounded-2xl h-24 animate-pulse" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-4">🎫</div>
          <p className="text-gray-500 mb-4">No bookings yet.</p>
          <Link href="/events" className="text-indigo-400 hover:text-indigo-300 text-sm">
            Browse Events →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map(booking => (
            <Link
              key={booking.id}
              href={`/bookings/${booking.id}`}
              className="block bg-[#12121a] border border-[#1e1e2e] rounded-2xl p-6 hover:border-indigo-500/30 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-1">{booking.event_name}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>💺 Seat {booking.seat_label}</span>
                    <span>📍 {booking.venue}</span>
                    <span>📅 {formatDate(booking.starts_at)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-3 py-1 rounded-full ${statusColor[booking.status] || ''}`}>
                    {booking.status}
                  </span>
                  <div className="text-lg font-bold text-indigo-400 mt-2">
                    {formatPrice(booking.price_minor)}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
