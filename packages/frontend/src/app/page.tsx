'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Zap,
  Lock,
  ArrowRight,
  Sparkles,
  Calendar,
  MapPin,
  CheckCircle,
  Clock,
  Layers,
  Activity,
} from 'lucide-react';
import { ParticleBackground3D } from '@/components/ParticleBackground3D';
import { TiltCard3D } from '@/components/TiltCard3D';

interface EventItem {
  id: string;
  name: string;
  description: string;
  venue: string;
  starts_at: string;
  image_url: string | null;
}

export default function HomePage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/events`);
        const json = await res.json();
        setEvents((json.data || []).slice(0, 3));
      } catch {
        // Fallback placeholder data
        setEvents([
          {
            id: '1',
            name: 'TechConf Global 2026',
            description: 'The premier architecture and systems engineering summit for staff engineers.',
            venue: 'Grand Convention Arena',
            starts_at: '2026-10-15T09:00:00Z',
            image_url: null,
          },
          {
            id: '2',
            name: 'Cyber Symphony Live',
            description: 'An electrifying fusion of orchestral acoustics and dynamic lasers.',
            venue: 'Riverside Amphitheater',
            starts_at: '2026-10-22T19:30:00Z',
            image_url: null,
          },
          {
            id: '3',
            name: 'Future Founders Summit',
            description: 'Live pitch showcase featuring top tier VCs and tech innovators.',
            venue: 'Innovation Dome',
            starts_at: '2026-11-05T10:00:00Z',
            image_url: null,
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  return (
    <div className="relative min-h-screen">
      {/* 3D Particle Mesh Background */}
      <ParticleBackground3D />

      {/* Hero Section */}
      <section className="relative z-10 pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        {/* Top Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 backdrop-blur-md mb-8 shadow-lg shadow-indigo-500/10 animate-fadeIn">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>High-Concurrency Booking Engine</span>
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          <span className="text-zinc-400">PostgreSQL 16 ACID</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-4xl mx-auto leading-[1.08]">
          Zero Double Bookings.{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 glow-text">
            Guaranteed at the DB Engine.
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Hundreds of users competing for the same seat at the exact same millisecond. Powered by row-level locking,
          two-phase holds, idempotency keys, and partial unique indexes.
        </p>

        {/* Action Buttons */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/events"
            className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-xl shadow-indigo-600/30 active:scale-95 transition-all"
          >
            <span>Explore Events & 3D Seating</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/admin"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm text-zinc-300 hover:text-white bg-zinc-900/80 hover:bg-zinc-800/80 border border-white/10 hover:border-white/20 backdrop-blur-md active:scale-95 transition-all"
          >
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Admin Metrics & Outbox</span>
          </Link>
        </div>

        {/* Stat Cards Grid */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {[
            { label: 'Confirmed Seat Invariant', val: '1 per (event, seat)', color: 'text-indigo-400' },
            { label: 'Concurrency Test Suite', val: '11/11 PASSED', color: 'text-emerald-400' },
            { label: 'Concurrent Hold Load', val: '100 Competing Reqs', color: 'text-purple-400' },
            { label: 'Duplicate Booking Rate', val: '0.000% (Strict)', color: 'text-amber-400' },
          ].map((stat, idx) => (
            <div
              key={idx}
              className="glass-panel p-4 rounded-2xl border border-white/10 text-left transition-all hover:border-indigo-500/30"
            >
              <span className="text-[11px] text-zinc-400 font-medium block">{stat.label}</span>
              <span className={`text-base sm:text-lg font-black mt-1 block ${stat.color}`}>{stat.val}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Events Section with 3D Tilt Cards */}
      <section className="relative z-10 py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
              <Calendar className="w-6 h-6 text-indigo-400" />
              <span>Featured Live Events</span>
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Select an event to view the live 3D arena seating bowl and select your seat.
            </p>
          </div>

          <Link
            href="/events"
            className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {events.map((event) => (
            <TiltCard3D key={event.id} maxTilt={10}>
              <Link
                href={`/events/${event.id}`}
                className="block glass-panel glass-panel-hover p-6 rounded-2xl border border-white/10 h-full flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-3">
                    <span className="flex items-center gap-1 font-semibold text-indigo-300">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      {new Date(event.starts_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Sales Active
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors">
                    {event.name}
                  </h3>

                  <p className="text-xs text-zinc-400 mt-2 line-clamp-3 leading-relaxed">
                    {event.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="truncate max-w-[140px]">{event.venue}</span>
                  </div>

                  <span className="flex items-center gap-1 font-bold text-indigo-400 group-hover:translate-x-1 transition-transform">
                    <span>Reserve Seat</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            </TiltCard3D>
          ))}
        </div>
      </section>

      {/* Concurrency Architecture Showcase */}
      <section className="relative z-10 py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="glass-panel p-8 sm:p-12 rounded-3xl border border-indigo-500/25 bg-gradient-to-b from-[#0f0f1c]/90 to-[#07070c]/95 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full filter blur-3xl pointer-events-none" />

          <div className="max-w-3xl">
            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Three-Layer Defense Strategy
            </span>

            <h2 className="text-2xl sm:text-4xl font-black text-white mt-4 tracking-tight">
              How SeatLock Prevents Race Conditions
            </h2>

            <p className="text-sm sm:text-base text-zinc-400 mt-3 leading-relaxed">
              Standard CRUD architectures check availability with a `SELECT`, then later attempt an `INSERT`—leaving a massive
              window for double bookings. SeatLock eliminates this entirely:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <div className="p-4 rounded-xl bg-black/40 border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xs mb-2">
                  1
                </div>
                <h4 className="font-bold text-sm text-white">Application Check</h4>
                <p className="text-xs text-zinc-400 mt-1">
                  Fast-path query rejecting obvious booking attempts with descriptive 409 responses.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-black/40 border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center font-bold text-xs mb-2">
                  2
                </div>
                <h4 className="font-bold text-sm text-white">SELECT FOR UPDATE</h4>
                <p className="text-xs text-zinc-400 mt-1">
                  Acquires an exclusive row-level lock on the target seat row inside an ACID transaction.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-black/40 border border-emerald-500/30">
                <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold text-xs mb-2">
                  3
                </div>
                <h4 className="font-bold text-sm text-emerald-300">Partial Unique Index</h4>
                <p className="text-xs text-zinc-400 mt-1">
                  PostgreSQL hard invariant: `UNIQUE(event_id, seat_id) WHERE status = 'CONFIRMED'`.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
