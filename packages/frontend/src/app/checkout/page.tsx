'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBooking, releaseHold, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatPrice, generateIdempotencyKey, getTimeRemaining } from '@/lib/utils';
import { HolographicTicket3D } from '@/components/HolographicTicket3D';
import { StripeCheckoutForm } from '@/components/StripeCheckoutForm';
import confetti from 'canvas-confetti';
import {
  Clock,
  ShieldCheck,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Lock,
  Ticket,
} from 'lucide-react';
import Link from 'next/link';

interface HoldInfo {
  holdId: string;
  seatId: string;
  seatLabel: string;
  tier: string;
  price: number;
  section: string;
  eventId: string;
  eventName: string;
  venue?: string;
  expiresAt: string;
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token } = useAuth();
  const [holdInfo, setHoldInfo] = useState<HoldInfo | null>(null);
  const [countdown, setCountdown] = useState({ minutes: 0, seconds: 0, expired: false });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);
  const [sessionKey] = useState(() => generateIdempotencyKey());

  useEffect(() => {
    const holdParam = searchParams.get('hold');
    if (holdParam) {
      try {
        setHoldInfo(JSON.parse(decodeURIComponent(holdParam)));
      } catch {
        router.push('/events');
      }
    } else {
      router.push('/events');
    }
  }, [searchParams, router]);

  // Countdown timer
  useEffect(() => {
    if (!holdInfo) return;

    const update = () => {
      const remaining = getTimeRemaining(holdInfo.expiresAt);
      setCountdown(remaining);
      if (remaining.expired) {
        setError('Your 5-minute hold has expired. Returning to seat selection...');
        setTimeout(() => router.push(`/events/${holdInfo.eventId}`), 3500);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [holdInfo, router]);

  const handleConfirmPayment = async (paymentMethod: 'stripe' | 'mock', cardDetails?: any) => {
    if (!holdInfo || !token) return;

    setProcessing(true);
    setError(null);

    try {
      const result = await createBooking(
        holdInfo.eventId,
        holdInfo.seatId,
        holdInfo.holdId,
        sessionKey,
        token
      );

      const bookingId = result.data.bookingId;
      setConfirmedBookingId(bookingId);

      // Trigger Confetti Celebration
      confetti({
        particleCount: 110,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#a855f7', '#10b981', '#f59e0b'],
      });
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.code === 'HOLD_EXPIRED') {
          setTimeout(() => router.push(`/events/${holdInfo.eventId}`), 3000);
        }
      } else {
        setError('Payment confirmation failed. Please try again.');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleRelease = async () => {
    if (!holdInfo || !token) return;
    try {
      await releaseHold(holdInfo.holdId, token);
    } catch {
      // Best effort release
    }
    router.push(`/events/${holdInfo.eventId}`);
  };

  if (!holdInfo) {
    return <div className="text-center py-20 text-zinc-500">Loading checkout...</div>;
  }

  if (!user || !token) {
    router.push('/login');
    return null;
  }

  // Confirmation Success View
  if (confirmedBookingId) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 animate-fadeIn text-center">
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/20">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Booking Confirmed!</h1>
        <p className="text-zinc-400 mt-2 text-sm">
          Your seat has been permanently locked in PostgreSQL with a verified CONFIRMED status.
        </p>

        {/* 3D Holographic Ticket Component */}
        <div className="my-6">
          <HolographicTicket3D
            eventName={holdInfo.eventName}
            venue={holdInfo.venue || 'Main Event Arena'}
            seatLabel={holdInfo.seatLabel}
            tier={holdInfo.tier}
            priceFormatted={formatPrice(holdInfo.price)}
            bookingId={confirmedBookingId}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={`/bookings/${confirmedBookingId}`}
            className="px-6 py-3 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-600/30 transition-all"
          >
            View Ticket & Printable Receipt
          </Link>
          <Link
            href="/events"
            className="px-6 py-3 rounded-xl font-semibold text-sm text-zinc-300 hover:text-white bg-zinc-900 border border-white/10 hover:border-white/20 transition-all"
          >
            Browse More Events
          </Link>
        </div>
      </div>
    );
  }

  // Checkout Form View
  const minutes = String(countdown.minutes).padStart(2, '0');
  const seconds = String(countdown.seconds).padStart(2, '0');
  const isExpiringSoon = countdown.minutes === 0 && countdown.seconds < 60;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">
      {/* Back button & Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={handleRelease}
          className="flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Release Hold & Return to Seat Map</span>
        </button>

        {/* Live Hold Countdown Timer */}
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-mono font-bold transition-all ${
            isExpiringSoon
              ? 'bg-red-950/60 border-red-500/50 text-red-300 shadow-lg shadow-red-500/20 animate-pulse'
              : 'bg-zinc-900/90 border-amber-500/40 text-amber-300 shadow-lg shadow-amber-500/10'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Hold Expires in: {minutes}:{seconds}</span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 rounded-2xl bg-red-950/50 border border-red-500/40 text-red-300 text-xs font-medium animate-fadeIn">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Two Column Layout: 3D Ticket on Left, Payment Form on Right */}
      <div className="grid lg:grid-cols-2 gap-10 items-start">
        <div>
          <div className="mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Order Summary</span>
            <h2 className="text-2xl font-black text-white mt-1">Review Your Reservation</h2>
          </div>

          <HolographicTicket3D
            eventName={holdInfo.eventName}
            venue={holdInfo.venue || 'Convention Arena'}
            seatLabel={holdInfo.seatLabel}
            tier={holdInfo.tier}
            priceFormatted={formatPrice(holdInfo.price)}
            holdExpiresIn={`${minutes}:${seconds}`}
          />

          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 text-xs text-zinc-400 space-y-2 mt-4">
            <div className="flex items-center gap-2 text-indigo-300 font-semibold">
              <Lock className="w-4 h-4 text-indigo-400" />
              <span>Idempotent Check-Then-Act Protection</span>
            </div>
            <p className="leading-relaxed">
              Your request includes a cryptographic <code>Idempotency-Key</code> (<code>{sessionKey.slice(0, 18)}...</code>).
              Network timeouts and re-submissions will never cause double charges or duplicate bookings.
            </p>
          </div>
        </div>

        {/* Payment Gateways Form */}
        <div>
          <div className="mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Secure Payment</span>
            <h2 className="text-2xl font-black text-white mt-1">Select Payment Gateway</h2>
          </div>

          <StripeCheckoutForm
            amountMinor={holdInfo.price}
            currency="USD"
            onConfirmPayment={handleConfirmPayment}
            isProcessing={processing}
          />
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-zinc-500">Loading checkout...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
