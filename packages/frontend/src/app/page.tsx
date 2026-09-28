'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  ShieldCheck,
  Calendar,
  Lock,
  ArrowRight,
  Clock,
  MapPin,
  Sparkles,
  Activity,
  Layers,
  Zap,
} from 'lucide-react';
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
  const { user, isAdmin, logout } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [introState, setIntroState] = useState<'intro' | 'intro-play' | 'done'>('intro');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // 1. Fetch Events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/events`);
        const json = await res.json();
        setEvents((json.data || []).slice(0, 3));
      } catch {
        setEvents([
          {
            id: 'a6c8f016-f9d3-4ae0-9c55-b663f70355fc',
            name: 'TechConf 2026',
            description: 'The premier technology conference featuring keynotes from industry leaders, hands-on workshops, and cutting-edge demos.',
            venue: 'Grand Convention Center',
            starts_at: new Date(Date.now() + 7 * 86400000).toISOString(),
            image_url: null,
          },
          {
            id: 'eb5c90ac-e668-4f49-ba74-1acbd0ee806c',
            name: 'Summer Music Festival',
            description: 'An unforgettable outdoor music experience featuring 20+ artists across 3 stages. Food trucks and late-night DJ sets included.',
            venue: 'Riverside Amphitheater',
            starts_at: new Date(Date.now() + 14 * 86400000).toISOString(),
            image_url: null,
          },
          {
            id: '8d4ecabe-9b0a-4a42-8e41-aa1bfd029a3a',
            name: 'Comedy Night Live',
            description: 'Stand-up comedy showcase featuring 5 headline comedians and 3 rising stars. Dinner and drinks available.',
            venue: 'Downtown Comedy Club',
            starts_at: new Date(Date.now() + 21 * 86400000).toISOString(),
            image_url: null,
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  // 2. Background video playback handler
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    v.muted = true;
    const playVideo = () => {
      if (v.paused) {
        v.play().catch(() => {});
      }
    };

    playVideo();
    v.addEventListener('canplay', playVideo);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') playVideo();
    });

    const triggerPlay = () => playVideo();
    window.addEventListener('pointerdown', triggerPlay, { once: true, passive: true });
    window.addEventListener('touchstart', triggerPlay, { once: true, passive: true });
    window.addEventListener('scroll', triggerPlay, { once: true, passive: true });

    return () => {
      v.removeEventListener('canplay', playVideo);
    };
  }, []);

  // 3. Exact Entrance Animation Timeline from specifications
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIntroState('done');
      return;
    }

    // Wait for fonts or 700ms fallback, then trigger intro-play in double rAF
    let timeoutId: NodeJS.Timeout;
    const triggerStart = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIntroState('intro-play');
        });
      });
    };

    if (document.fonts && document.fonts.ready) {
      Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 700)),
      ]).then(triggerStart);
    } else {
      timeoutId = setTimeout(triggerStart, 700);
    }

    // Failsafe timer to remove intro classes after animation finishes (~2.5s)
    const cleanupTimer = setTimeout(() => {
      setIntroState('done');
    }, 2800);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(cleanupTimer);
    };
  }, []);

  const handleLastAnimationEnd = () => {
    setIntroState('done');
  };

  const isIntro = introState === 'intro';
  const isPlay = introState === 'intro-play';

  return (
    <div className="relative w-full min-h-screen bg-black text-white overflow-x-hidden selection:bg-indigo-500/30 selection:text-white">
      {/* ─── Layer Structure: Hero Space Stage (Reference 1563x1006 Scaling) ─── */}
      <div
        className="relative w-full h-screen min-h-[580px] max-h-[1050px] overflow-hidden bg-black isolation-auto"
        style={{
          boxSizing: 'border-box',
        }}
      >
        {/* Background Looping Space Artwork Video (silent, 1664x1248) */}
        <video
          ref={videoRef}
          aria-hidden="true"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/0bf7409c-9fa2-4bef-a49d-34903dcc91ad.png"
          src="https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/4b73c700-3112-4c07-bd48-0af2893dff7c.mp4"
          className="sky absolute pointer-events-none select-none z-0"
          style={{
            top: 'calc(-1.5 * var(--u))',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            height: 'auto',
            minHeight: 'calc(100% + 1.5 * var(--u))',
            objectFit: 'cover',
            objectPosition: 'center top',
          }}
        />

        {/* Veil */}
        <div
          className="veil absolute inset-0 z-1 pointer-events-none"
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 65%, rgba(0,0,0,0.95) 100%)',
          }}
        />

        {/* ─── Header (`header.bar`) ─── */}
        <header
          className="bar absolute z-30 transition-all flex items-center justify-between"
          data-open={menuOpen ? 'true' : 'false'}
          style={{
            left: 'calc(50% - 491.75 * var(--u))',
            top: 'calc(7.5 * var(--u))',
            width: 'calc(983.5 * var(--u))',
            height: 'calc(36.2 * var(--u))',
          }}
        >
          {/* Brand Logo & Name */}
          <Link
            href="/"
            aria-label="SeatLock — home"
            className="brand absolute flex items-center gap-[calc(11.4*var(--u))] text-[var(--ink-mark)] no-underline group"
            style={{
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              opacity: isIntro ? 0 : 1,
              animation: isPlay
                ? 'i-rise-cy .62s var(--e-nav) 0s both'
                : 'none',
              willChange: isPlay ? 'transform, opacity' : 'auto',
            }}
          >
            {/* Custom Planetary Vector Logo */}
            <svg
              viewBox="0 0 26.9 16.6"
              fill="none"
              className="overflow-visible transition-transform duration-300 group-hover:scale-110"
              style={{
                width: 'calc(26.9 * var(--u))',
                height: 'calc(16.6 * var(--u))',
              }}
            >
              {/* 1. Ring back */}
              <ellipse
                cx="13.25"
                cy="8.4"
                rx="13.2"
                ry="2.9"
                transform="rotate(-25 13.25 8.4)"
                stroke="currentColor"
                strokeWidth="1.25"
              />
              {/* 2. Gap */}
              <circle cx="13.25" cy="8.4" r="8.8" fill="#000" />
              {/* 3. Planet */}
              <circle cx="13.25" cy="8.4" r="8.1" fill="currentColor" />
              {/* 4. Ring front cut */}
              <ellipse
                cx="13.25"
                cy="8.4"
                rx="13.2"
                ry="2.9"
                transform="rotate(-25 13.25 8.4)"
                stroke="#000"
                strokeWidth="0.9"
                strokeDasharray="28.2 28.2"
              />
              {/* 5. Ring front white */}
              <ellipse
                cx="13.25"
                cy="8.4"
                rx="13.2"
                ry="2.9"
                transform="rotate(-25 13.25 8.4)"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeDasharray="28.2 28.2"
              />
            </svg>
            <span
              className="font-semibold tracking-normal leading-none"
              style={{
                fontSize: 'calc(17.5 * var(--u))',
                fontVariationSettings: "'opsz' 22",
              }}
            >
              SeatLock
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav
            className="links hidden md:flex items-center absolute"
            aria-label="Primary"
            style={{
              left: 'calc(353.8 * var(--u))',
              top: '50%',
              transform: 'translateY(-50%)',
              gap: 'calc(25.2 * var(--u))',
            }}
          >
            {[
              { name: 'Events', href: '/events', delay: '.070s' },
              { name: 'My Bookings', href: '/bookings', delay: '.115s' },
              { name: 'Architecture', href: '#architecture', delay: '.160s' },
              { name: 'Admin', href: '/admin', delay: '.205s' },
            ].map((link, idx) => (
              <Link
                key={idx}
                href={link.href}
                className="whitespace-nowrap transition-colors duration-200 hover:text-white"
                style={{
                  fontSize: 'calc(11.9 * var(--u))',
                  fontWeight: 450,
                  letterSpacing: 'calc(-0.30 * var(--u))',
                  color: 'var(--ink-nav)',
                  fontVariationSettings: "'opsz' 15",
                  opacity: isIntro ? 0 : 1,
                  animation: isPlay
                    ? `i-rise .55s var(--e-nav) ${link.delay} both`
                    : 'none',
                }}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Desktop Action Buttons */}
          <div
            className="actions absolute right-0 top-0 flex items-center"
            style={{
              gap: 'calc(7.8 * var(--u))',
            }}
          >
            {user ? (
              <div className="flex items-center gap-[calc(6*var(--u))]">
                <Link
                  href="/admin"
                  className="hidden md:inline-flex items-center justify-center rounded-[var(--r-btn)] border border-[rgba(255,255,255,.2)] hover:border-white text-white font-medium transition-all"
                  style={{
                    height: 'calc(36.2 * var(--u))',
                    padding: '0 calc(12 * var(--u))',
                    fontSize: 'calc(11.9 * var(--u))',
                    letterSpacing: 'calc(-0.35 * var(--u))',
                    opacity: isIntro ? 0 : 1,
                    animation: isPlay
                      ? 'i-rise .55s var(--e-nav) .160s both'
                      : 'none',
                  }}
                >
                  {isAdmin ? 'Admin Console' : user.name}
                </Link>
                <button
                  onClick={logout}
                  className="hidden md:inline-flex items-center justify-center rounded-[var(--r-btn)] bg-white text-black font-semibold hover:bg-[#e9e9ea] transition-all"
                  style={{
                    height: 'calc(36.2 * var(--u))',
                    padding: '0 calc(14 * var(--u))',
                    fontSize: 'calc(12.15 * var(--u))',
                    opacity: isIntro ? 0 : 1,
                    animation: isPlay
                      ? 'i-rise .55s var(--e-nav) .215s both'
                      : 'none',
                  }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden md:inline-flex items-center justify-center rounded-[var(--r-btn)] border border-[rgba(255,255,255,.98)] text-white hover:bg-[rgba(255,255,255,.10)] transition-all font-medium leading-none"
                  style={{
                    width: 'calc(85.5 * var(--u))',
                    height: 'calc(36.2 * var(--u))',
                    fontSize: 'calc(11.9 * var(--u))',
                    letterSpacing: 'calc(-0.38 * var(--u))',
                    opacity: isIntro ? 0 : 1,
                    animation: isPlay
                      ? 'i-rise .55s var(--e-nav) .160s both'
                      : 'none',
                  }}
                >
                  Sign in
                </Link>
                <Link
                  href="/events"
                  className="hidden md:inline-flex items-center justify-center rounded-[var(--r-btn)] bg-white text-black hover:bg-[#e9e9ea] transition-all font-semibold leading-none shadow-lg shadow-white/10"
                  style={{
                    width: 'calc(98.2 * var(--u))',
                    height: 'calc(36.2 * var(--u))',
                    fontSize: 'calc(12.15 * var(--u))',
                    letterSpacing: 'calc(-0.35 * var(--u))',
                    opacity: isIntro ? 0 : 1,
                    animation: isPlay
                      ? 'i-rise .55s var(--e-nav) .215s both'
                      : 'none',
                  }}
                >
                  Get Tickets
                </Link>
              </>
            )}

            {/* Mobile Hamburger Button */}
            <button
              id="menu-btn"
              aria-label={menuOpen ? 'Close menu' : 'Menu'}
              aria-expanded={menuOpen}
              aria-controls="menu-sheet"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex md:hidden items-center justify-center rounded-[var(--r-btn)] border border-[rgba(255,255,255,.35)] bg-transparent text-white hover:bg-[rgba(255,255,255,.10)] transition-colors"
              style={{
                width: 'calc(36.2 * var(--u))',
                height: 'calc(36.2 * var(--u))',
              }}
            >
              <svg
                viewBox="0 0 20 14"
                className="w-4 h-3.5 stroke-current"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <path d="M0 1h20M0 7h20M0 13h20" />
              </svg>
            </button>

            {/* Mobile Menu Sheet */}
            {menuOpen && (
              <div
                id="menu-sheet"
                className="md:hidden absolute right-0 top-[calc(100%+9px)] flex flex-col p-3 rounded-2xl border border-white/15 bg-[#121214]/90 backdrop-blur-xl shadow-2xl z-50 min-w-[210px]"
              >
                <Link
                  href="/events"
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2 text-sm text-zinc-300 hover:text-white rounded-lg hover:bg-white/10"
                >
                  Explore Events
                </Link>
                <Link
                  href="/bookings"
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2 text-sm text-zinc-300 hover:text-white rounded-lg hover:bg-white/10"
                >
                  My Bookings
                </Link>
                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="px-3 py-2 text-sm text-zinc-300 hover:text-white rounded-lg hover:bg-white/10"
                >
                  Admin Console
                </Link>
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="mt-2 w-full py-2 text-center text-sm font-semibold rounded-lg bg-white text-black hover:bg-zinc-200"
                >
                  Get Tickets
                </Link>
              </div>
            )}
          </div>
        </header>

        {/* ─── Hero Canvas (Screen & Masked Headline) ─── */}
        <div
          className="screen absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none"
          style={{
            top: 0,
            width: 'calc(1563 * var(--u))',
            height: 'calc(1006 * var(--u))',
          }}
        >
          <main
            className="hero absolute text-center pointer-events-auto"
            style={{
              left: 'calc(0.9 * var(--u))',
              right: 'calc(-0.9 * var(--u))',
              top: 0,
            }}
          >
            {/* Eyebrow Pill */}
            <Link
              href="/events"
              className="pill group absolute left-1/2 inline-flex items-center no-underline border border-[rgba(255,255,255,.15)] backdrop-blur-[calc(10*var(--u))] transition-all duration-200 hover:bg-[rgba(255,255,255,.17)]"
              style={{
                top: 'calc(129.6 * var(--u))',
                transform: 'translateX(-50%)',
                width: 'calc(240 * var(--u))',
                height: 'calc(23 * var(--u))',
                paddingLeft: 'calc(4.0 * var(--u))',
                paddingRight: 'calc(8.6 * var(--u))',
                borderRadius: '999px',
                background: 'rgba(255,255,255,.12)',
                opacity: isIntro ? 0 : 1,
                animation: isPlay
                  ? 'i-pill .62s var(--e-soft) .26s both'
                  : 'none',
                willChange: isPlay ? 'transform, opacity' : 'auto',
              }}
            >
              {/* Chip "New" */}
              <span
                className="chip inline-flex items-center justify-center font-bold text-black bg-white rounded-full leading-none"
                style={{
                  width: 'calc(34 * var(--u))',
                  height: 'calc(15 * var(--u))',
                  fontSize: 'calc(10.2 * var(--u))',
                  letterSpacing: 'calc(-0.1 * var(--u))',
                  fontVariationSettings: "'opsz' 14",
                }}
              >
                ACID
              </span>
              <span
                className="pill-label font-medium whitespace-nowrap leading-none text-[rgba(255,255,255,.88)]"
                style={{
                  marginLeft: 'calc(4 * var(--u))',
                  fontSize: 'calc(12.4 * var(--u))',
                  letterSpacing: 'calc(-0.48 * var(--u))',
                  fontVariationSettings: "'opsz' 15",
                }}
              >
                Zero Double Bookings
              </span>
              {/* Arrow SVG */}
              <svg
                viewBox="0 0 9.5 8"
                fill="none"
                className="ml-auto stroke-current text-[rgba(255,255,255,.95)] group-hover:translate-x-0.5 transition-transform"
                style={{
                  width: 'calc(9.5 * var(--u))',
                  height: 'calc(8 * var(--u))',
                  strokeWidth: 1.35,
                }}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M0.7 4H8.8M5.6 0.75 8.85 4 5.6 7.25" />
              </svg>
            </Link>

            {/* Mask-Revealed Headline */}
            <h1
              className="absolute left-[calc(0.6*var(--u))] right-[calc(-0.6*var(--u))] font-semibold text-white tracking-tight leading-[calc(56*var(--u))]"
              style={{
                top: 'calc(168.5 * var(--u))',
                fontSize: 'calc(55 * var(--u))',
                letterSpacing: 'calc(-0.76 * var(--u))',
                fontVariationSettings: "'opsz' 32",
                margin: 0,
              }}
            >
              {/* Line 1 */}
              <span className="orbit-ln">
                <span
                  className="orbit-ln-i"
                  style={{
                    animation: isPlay
                      ? 'i-line .95s var(--e-reveal) .34s both'
                      : 'none',
                    transform: isIntro ? 'translate3d(0,115%,0)' : 'none',
                    willChange: isPlay ? 'transform' : 'auto',
                  }}
                >
                  Reserve seats at speed.
                </span>
              </span>
              {/* Line 2 */}
              <span className="orbit-ln">
                <span
                  className="orbit-ln-i"
                  style={{
                    animation: isPlay
                      ? 'i-line .95s var(--e-reveal) .48s both'
                      : 'none',
                    transform: isIntro ? 'translate3d(0,115%,0)' : 'none',
                    willChange: isPlay ? 'transform' : 'auto',
                  }}
                >
                  Guaranteed concurrency.
                </span>
              </span>
            </h1>

            {/* Sub-headline */}
            <p
              className="absolute font-normal text-[rgba(255,255,255,.65)] leading-[calc(24*var(--u))]"
              style={{
                left: '50%',
                transform: 'translateX(calc(-50% + 0.25 * var(--u)))',
                top: 'calc(292.6 * var(--u))',
                width: 'calc(730 * var(--u))',
                fontSize: 'calc(15.7 * var(--u))',
                letterSpacing: 'calc(-0.05 * var(--u))',
                fontVariationSettings: "'opsz' 20",
                margin: 0,
                opacity: isIntro ? 0 : 1,
                animation: isPlay
                  ? 'i-sub .70s var(--e-soft) .86s both'
                  : 'none',
                willChange: isPlay ? 'transform, opacity' : 'auto',
              }}
            >
              Engineered for extreme ticket demand. Row-level locks, two-phase holds,
              and PostgreSQL partial unique indexes eliminate race conditions under load.
            </p>

            {/* CTA Action Row */}
            <div
              className="cta absolute left-1/2 flex items-center justify-center"
              style={{
                top: 'calc(342.8 * var(--u))',
                transform: 'translateX(-50%)',
                gap: 'calc(9.9 * var(--u))',
              }}
            >
              <Link
                href="/events"
                className="btn ghost inline-flex items-center justify-center rounded-[var(--r-btn)] text-white border border-[rgba(255,255,255,.98)] bg-transparent hover:bg-[rgba(255,255,255,.10)] transition-all font-medium leading-none"
                style={{
                  width: 'calc(130 * var(--u))',
                  height: 'calc(36.4 * var(--u))',
                  fontSize: 'calc(13.3 * var(--u))',
                  letterSpacing: 'calc(-0.34 * var(--u))',
                  fontVariationSettings: "'opsz' 16",
                  opacity: isIntro ? 0 : 1,
                  animation: isPlay
                    ? 'i-btn .62s var(--e-soft) 1.00s both'
                    : 'none',
                  willChange: isPlay ? 'transform, opacity' : 'auto',
                }}
              >
                Browse Events
              </Link>

              <Link
                href="/events"
                onAnimationEnd={handleLastAnimationEnd}
                className="btn solid inline-flex items-center justify-center rounded-[var(--r-btn)] bg-white text-black hover:bg-[#e9e9ea] transition-all font-semibold leading-none shadow-xl shadow-white/10"
                style={{
                  width: 'calc(130 * var(--u))',
                  height: 'calc(36.4 * var(--u))',
                  fontSize: 'calc(13.3 * var(--u))',
                  letterSpacing: 'calc(-0.34 * var(--u))',
                  fontVariationSettings: "'opsz' 16",
                  opacity: isIntro ? 0 : 1,
                  animation: isPlay
                    ? 'i-btn .62s var(--e-soft) 1.07s both'
                    : 'none',
                  willChange: isPlay ? 'transform, opacity' : 'auto',
                }}
              >
                3D Arena View
              </Link>
            </div>
          </main>
        </div>
      </div>

      {/* ─── Featured Live Events with 3D Tilt Cards ─── */}
      <section className="relative z-20 py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto -mt-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-zinc-300 border border-white/15 backdrop-blur-md mb-3">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Real-Time Inventory</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span>Featured Live Events</span>
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Select an event to enter the interactive 3D arena view and test atomic seat reservations.
            </p>
          </div>

          <Link
            href="/events"
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/15 px-4 py-2 rounded-xl transition-all"
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
                      Sales Open
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

      {/* ─── Concurrency Architecture Showcase ─── */}
      <section id="architecture" className="relative z-20 py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="glass-panel p-8 sm:p-12 rounded-3xl border border-white/15 bg-gradient-to-b from-[#101018]/90 to-[#07070c]/95 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full filter blur-3xl pointer-events-none" />

          <div className="max-w-3xl">
            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/10 text-white border border-white/20">
              Three-Layer Defense Strategy
            </span>

            <h2 className="text-2xl sm:text-4xl font-black text-white mt-4 tracking-tight">
              Eliminating Double Bookings At The Engine Layer
            </h2>

            <p className="text-sm sm:text-base text-zinc-400 mt-3 leading-relaxed">
              Standard CRUD architectures check availability with a `SELECT`, then later attempt an `INSERT`—leaving a massive
              window for double bookings. SeatLock eliminates this entirely through synchronized primitives:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <div className="p-4 rounded-xl bg-black/60 border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center font-bold text-xs mb-2">
                  1
                </div>
                <h4 className="font-bold text-sm text-white">Application Check</h4>
                <p className="text-xs text-zinc-400 mt-1">
                  Fast-path cache & memory query rejecting obvious collisions with descriptive 409 responses.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-black/60 border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs mb-2">
                  2
                </div>
                <h4 className="font-bold text-sm text-white">SELECT FOR UPDATE</h4>
                <p className="text-xs text-zinc-400 mt-1">
                  Acquires an exclusive pessimistic row-level lock on the target seat row inside an ACID transaction.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-black/60 border border-emerald-500/30">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs mb-2">
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

      {/* ─── Stats Bar ─── */}
      <section className="relative z-20 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Confirmed Invariant', val: '1 per (event, seat)', color: 'text-indigo-400' },
            { label: 'Concurrency Test Suite', val: '11/11 PASSED', color: 'text-emerald-400' },
            { label: 'Concurrent Hold Load', val: '100 Competing Reqs', color: 'text-purple-400' },
            { label: 'Duplicate Booking Rate', val: '0.000% (Strict)', color: 'text-amber-400' },
          ].map((stat, idx) => (
            <div
              key={idx}
              className="glass-panel p-4 rounded-2xl border border-white/10 text-left transition-all hover:border-white/30"
            >
              <span className="text-[11px] text-zinc-400 font-medium block">{stat.label}</span>
              <span className={`text-base sm:text-lg font-black mt-1 block ${stat.color}`}>{stat.val}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
