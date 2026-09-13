'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Printer, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Calendar, 
  MapPin, 
  Armchair, 
  CreditCard, 
  Hash, 
  Layers 
} from 'lucide-react';
import { getBooking, BookingDetail } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatTime, formatPrice } from '@/lib/utils';
import HolographicTicket3D from '@/components/HolographicTicket3D';

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    getBooking(params.id as string, token)
      .then(res => setBooking(res.data))
      .catch(() => router.push('/bookings'))
      .finally(() => setLoading(false));
  }, [params.id, token, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <p className="text-gray-400 font-mono text-sm">Verifying atomic booking state...</p>
      </div>
    );
  }

  if (!booking) return null;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Top Bar Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <Link
          href="/bookings"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to All Bookings</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-all cursor-pointer print:hidden"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-400" />
            <span>Print Pass</span>
          </button>
          <div className="px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{booking.status}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: 3D Holographic Ticket Display */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="lg:col-span-6 flex flex-col items-center"
        >
          <div className="w-full">
            <HolographicTicket3D
              eventName={booking.event_name}
              venue={booking.venue}
              dateStr={`${formatDate(booking.starts_at)} • ${formatTime(booking.starts_at)}`}
              seatLabel={booking.seat_label}
              tier={booking.tier}
              priceFormatted={formatPrice(booking.payment_amount || booking.price_minor)}
              bookingId={booking.id}
            />
          </div>

          <div className="mt-4 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs w-full max-w-sm flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0" />
            <span>
              Cryptographically verified seat assignment locked with PostgreSQL row-level mutex.
            </span>
          </div>
        </motion.div>

        {/* Right Column: Full Audit & Receipt Breakdown */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="lg:col-span-6 space-y-6"
        >
          <div className="glass-panel p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-widest text-indigo-400 block mb-1">
                  Official Admission Pass
                </span>
                <h1 className="text-xl sm:text-2xl font-bold text-white">
                  {booking.event_name}
                </h1>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Layers className="w-5 h-5 text-indigo-400" />
              </div>
            </div>

            {/* Event & Schedule */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0c0c16] border border-white/5 rounded-xl p-3.5">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Date & Time</span>
                </div>
                <div className="text-sm font-semibold text-white">
                  {formatDate(booking.starts_at)}
                </div>
                <div className="text-xs text-gray-400">
                  Doors open {formatTime(booking.starts_at)}
                </div>
              </div>

              <div className="bg-[#0c0c16] border border-white/5 rounded-xl p-3.5">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <MapPin className="w-3.5 h-3.5 text-purple-400" />
                  <span>Venue</span>
                </div>
                <div className="text-sm font-semibold text-white truncate">
                  {booking.venue}
                </div>
                <div className="text-xs text-gray-400">Gate Main Entrance</div>
              </div>
            </div>

            {/* Seat Matrix Breakdown */}
            <div className="bg-[#0c0c16] border border-white/5 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1 font-semibold uppercase tracking-wider">
                <Armchair className="w-3.5 h-3.5 text-amber-400" />
                <span>Reserved Seat Allocation</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="bg-white/5 rounded-lg p-2">
                  <span className="text-[10px] text-gray-500 block uppercase">Seat</span>
                  <span className="text-base font-mono font-bold text-white">{booking.seat_label}</span>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <span className="text-[10px] text-gray-500 block uppercase">Section</span>
                  <span className="text-sm font-semibold text-white truncate">{booking.section}</span>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <span className="text-[10px] text-gray-500 block uppercase">Tier</span>
                  <span className="text-sm font-semibold text-indigo-400">{booking.tier}</span>
                </div>
              </div>
            </div>

            {/* Payment & Audit Reference */}
            <div className="bg-[#0c0c16] border border-white/5 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold uppercase tracking-wider">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Settlement Breakdown</span>
                </div>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {booking.payment_status}
                </span>
              </div>
              <div className="flex justify-between items-baseline pt-2">
                <span className="text-sm text-gray-400">Total Paid</span>
                <span className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                  {formatPrice(booking.payment_amount || booking.price_minor)}
                </span>
              </div>
            </div>

            {/* Cryptographic Reference Meta */}
            <div className="border-t border-white/10 pt-4 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <Hash className="w-3 h-3 text-gray-400" />
                  Booking ID
                </span>
                <span className="font-mono text-[11px] text-gray-300">{booking.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-gray-400" />
                  Confirmation Time
                </span>
                <span className="text-gray-300">
                  {formatDate(booking.created_at)} at {formatTime(booking.created_at)}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
