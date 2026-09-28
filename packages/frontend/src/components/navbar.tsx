'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { usePathname } from 'next/navigation';
import {
  Lock,
  Calendar,
  Ticket,
  ShieldCheck,
  Activity,
  LogOut,
  User as UserIcon,
  Sparkles,
} from 'lucide-react';

export function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const pathname = usePathname();
  const [dbHealthy, setDbHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/health`);
        const data = await res.json();
        setDbHealthy(data.database === 'ok');
      } catch {
        setDbHealthy(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (path: string) => {
    return pathname === path
      ? 'text-white bg-white/10 shadow-sm border border-white/15'
      : 'text-zinc-400 hover:text-white hover:bg-white/5';
  };

  return (
    <nav className="border-b border-white/10 bg-[#07070c]/85 backdrop-blur-xl sticky top-0 z-50 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform">
                <Lock className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
                  SeatLock
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    ACID
                  </span>
                </span>
                <span className="text-[10px] text-zinc-400 font-medium -mt-0.5">
                  Concurrency-Guaranteed
                </span>
              </div>
            </Link>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center gap-2">
              <Link
                href="/events"
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${isActive('/events')}`}
              >
                <Calendar className="w-4 h-4" />
                <span>Events</span>
              </Link>

              {user && (
                <Link
                  href="/bookings"
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${isActive('/bookings')}`}
                >
                  <Ticket className="w-4 h-4" />
                  <span>My Bookings</span>
                </Link>
              )}

              {isAdmin && (
                <Link
                  href="/admin"
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${isActive('/admin')}`}
                >
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Admin Portal</span>
                </Link>
              )}
            </div>
          </div>

          {/* Right Header Area: Live Health & Auth */}
          <div className="flex items-center gap-4">
            {/* Live Database Status Indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono bg-zinc-900/90 border border-white/10 text-zinc-300">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    dbHealthy ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    dbHealthy ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
              </span>
              <span>PostgreSQL {dbHealthy ? 'Connected' : 'Connecting...'}</span>
            </div>

            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-zinc-200">
                  <div className="w-6 h-6 rounded-full bg-indigo-600/40 text-indigo-300 flex items-center justify-center font-bold text-xs">
                    {user.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="hidden sm:inline font-semibold">{user.name}</span>
                  {isAdmin && (
                    <span className="text-[11px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                      Admin
                    </span>
                  )}
                </div>

                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-semibold text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-all"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="flex items-center gap-1.5 px-4.5 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 active:scale-95 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                  <span>Get Tickets</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
