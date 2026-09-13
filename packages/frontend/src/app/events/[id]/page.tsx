'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getEvent, getEventSeats, createHold, Event, Seat, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatTime, formatPrice, cn } from '@/lib/utils';
import {
  MapPin,
  Calendar,
  Clock,
  Sparkles,
  Layers,
  Box,
  Grid,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { ThreeVenueVisualizer } from '@/components/ThreeVenueVisualizer';

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');
  const [selectedTierFilter, setSelectedTierFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [holdLoading, setHoldLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventId = params.id as string;

  const loadData = useCallback(async () => {
    try {
      const [eventRes, seatsRes] = await Promise.all([
        getEvent(eventId),
        getEventSeats(eventId),
      ]);
      setEvent(eventRes.data);
      setSeats(seatsRes.data);
    } catch {
      setError('Failed to load event data');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleSeatClick = (seat: Seat) => {
    if (seat.status !== 'AVAILABLE') return;
    setSelectedSeat(prev => (prev?.id === seat.id ? null : seat));
    setError(null);
  };

  const handleHold = async () => {
    if (!selectedSeat) return;
    if (!token || !user) {
      router.push('/login');
      return;
    }

    setHoldLoading(true);
    setError(null);

    try {
      const res = await createHold(eventId, selectedSeat.id, token);
      const holdData = encodeURIComponent(
        JSON.stringify({
          holdId: res.data.holdId,
          seatId: selectedSeat.id,
          seatLabel: selectedSeat.label,
          tier: selectedSeat.tier,
          price: selectedSeat.price_minor,
          section: selectedSeat.section,
          eventId,
          eventName: event?.name,
          venue: event?.venue,
          expiresAt: res.data.expiresAt,
        })
      );
      router.push(`/checkout?hold=${holdData}`);
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === 'SEAT_UNAVAILABLE') {
          setError('This seat was just held by another user! Concurrency protected.');
          setSelectedSeat(null);
          loadData();
        } else if (err.statusCode === 401) {
          router.push('/login');
        } else {
          setError(err.message);
        }
      } else {
        setError('Network error reserving seat. Please try again.');
      }
    } finally {
      setHoldLoading(false);
    }
  };

  // Group seats by section and row
  const filteredSeats = selectedTierFilter
    ? seats.filter(s => s.tier.toLowerCase() === selectedTierFilter.toLowerCase())
    : seats;

  const seatsBySection = filteredSeats.reduce((acc, seat) => {
    if (!acc[seat.section]) acc[seat.section] = {};
    if (!acc[seat.section]![seat.row]) acc[seat.section]![seat.row] = [];
    acc[seat.section]![seat.row]!.push(seat);
    return acc;
  }, {} as Record<string, Record<string, Seat[]>>);

  const availableCount = seats.filter(s => s.status === 'AVAILABLE').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] gap-3 text-zinc-400">
        <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
        <span>Loading venue & seat map...</span>
      </div>
    );
  }

  if (!event) {
    return <div className="text-center py-20 text-zinc-400">Event not found.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">
      {/* Event Header Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 mb-8 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                {availableCount} Seats Available
              </span>
              <span className="text-xs text-zinc-400">• Real-Time DB Polling</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">{event.name}</h1>
            <p className="text-sm text-zinc-400 mt-2 max-w-2xl leading-relaxed">{event.description}</p>

            <div className="flex flex-wrap items-center gap-4 mt-4 text-xs font-medium text-zinc-300">
              <span className="flex items-center gap-1.5 text-zinc-400">
                <MapPin className="w-4 h-4 text-indigo-400" /> {event.venue}
              </span>
              <span className="flex items-center gap-1.5 text-zinc-400">
                <Calendar className="w-4 h-4 text-indigo-400" /> {formatDate(event.starts_at)}
              </span>
              <span className="flex items-center gap-1.5 text-zinc-400">
                <Clock className="w-4 h-4 text-indigo-400" /> {formatTime(event.starts_at)}
              </span>
            </div>
          </div>

          {/* 2D / 3D Mode Toggle Switch */}
          <div className="flex items-center gap-1.5 p-1.5 bg-black/60 rounded-2xl border border-white/10 self-start lg:self-center shadow-lg">
            <button
              onClick={() => setViewMode('2D')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                viewMode === '2D'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>2D Seat Grid</span>
            </button>

            <button
              onClick={() => setViewMode('3D')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                viewMode === '3D'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Box className="w-3.5 h-3.5 text-purple-300" />
              <span>3D Arena View</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 rounded-2xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs font-medium animate-fadeIn">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {viewMode === '3D' ? (
            <div className="space-y-4">
              <ThreeVenueVisualizer
                selectedTier={selectedTierFilter}
                onSelectTier={(tier) => {
                  setSelectedTierFilter(prev => (prev === tier ? null : tier));
                  setViewMode('2D');
                }}
              />
              <div className="flex items-center justify-between text-xs text-zinc-400 px-2">
                <span>Click any section in 3D to filter and select exact seats.</span>
                <button
                  onClick={() => setViewMode('2D')}
                  className="font-bold text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
                >
                  Switch to 2D Grid
                </button>
              </div>
            </div>
          ) : (
            <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 shadow-2xl">
              {/* Stage Visual Indicator */}
              <div className="mb-10 text-center">
                <div className="w-3/4 mx-auto py-2.5 rounded-2xl bg-gradient-to-r from-indigo-900/60 via-purple-900/80 to-indigo-900/60 border border-indigo-500/30 text-xs font-bold text-indigo-200 tracking-widest uppercase shadow-lg shadow-indigo-500/10">
                  ★ PERFORMANCE STAGE ★
                </div>
                <div className="w-1/2 mx-auto h-2 bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent blur-sm -mt-0.5" />
              </div>

              {/* Legend & Filter Controls */}
              <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-6 border-b border-white/10 text-xs">
                <div className="flex items-center gap-4">
                  {[
                    { class: 'seat--available', label: 'Available' },
                    { class: 'seat--selected', label: 'Selected' },
                    { class: 'seat--held', label: 'Held' },
                    { class: 'seat--booked', label: 'Booked' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <div className={`seat ${item.class}`} style={{ width: 16, height: 16 }} />
                      <span className="text-zinc-400 font-medium">{item.label}</span>
                    </div>
                  ))}
                </div>

                {/* Tier Filter Pills */}
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-500 text-[11px] mr-1">Filter:</span>
                  {['VIP', 'Premium', 'Standard'].map(tier => (
                    <button
                      key={tier}
                      onClick={() => setSelectedTierFilter(prev => (prev === tier ? null : tier))}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        selectedTierFilter === tier
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/5 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                  {selectedTierFilter && (
                    <button
                      onClick={() => setSelectedTierFilter(null)}
                      className="text-[10px] text-zinc-500 hover:text-zinc-300 ml-1"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Seat Matrix */}
              <div className="space-y-8 overflow-x-auto pb-4">
                {Object.entries(seatsBySection).map(([section, rows]) => (
                  <div key={section} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-400">
                        {section}
                      </span>
                      <div className="h-px flex-1 bg-white/10" />
                    </div>

                    <div className="space-y-2">
                      {Object.entries(rows).map(([row, seatList]) => (
                        <div key={row} className="flex items-center gap-2 justify-center">
                          <span className="w-5 text-[11px] font-bold text-zinc-500 text-right">{row}</span>
                          <div className="flex items-center gap-1.5">
                            {seatList.map(seat => {
                              const isSelected = selectedSeat?.id === seat.id;
                              const stateClass = isSelected
                                ? 'seat--selected'
                                : seat.status === 'AVAILABLE'
                                ? 'seat--available'
                                : seat.status === 'HELD'
                                ? 'seat--held'
                                : 'seat--booked';

                              return (
                                <button
                                  key={seat.id}
                                  type="button"
                                  onClick={() => handleSeatClick(seat)}
                                  disabled={seat.status !== 'AVAILABLE'}
                                  className={cn('seat', stateClass)}
                                  title={`${seat.label} • ${seat.tier} • ${formatPrice(seat.price_minor)}`}
                                >
                                  {seat.number}
                                </button>
                              );
                            })}
                          </div>
                          <span className="w-5 text-[11px] font-bold text-zinc-500">{row}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Floating Hold & Checkout Sidebar */}
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl sticky top-24">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              <span>Your Selection</span>
            </h3>

            {selectedSeat ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400">Seat Number</span>
                    <span className="font-bold text-indigo-300 text-sm">{selectedSeat.label}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400">Section / Row</span>
                    <span className="font-semibold text-zinc-200">
                      {selectedSeat.section} • Row {selectedSeat.row}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400">Tier</span>
                    <span className="font-bold text-emerald-400">{selectedSeat.tier}</span>
                  </div>
                  <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                    <span className="text-xs font-semibold text-zinc-300">Total Price</span>
                    <span className="text-lg font-black text-white">{formatPrice(selectedSeat.price_minor)}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-[11px] text-indigo-300 leading-relaxed">
                  Holding this seat acquires an exclusive <strong>PostgreSQL row lock</strong>, guaranteeing it for 5
                  minutes while you enter payment details.
                </div>

                <button
                  type="button"
                  onClick={handleHold}
                  disabled={holdLoading}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-xl shadow-indigo-600/30 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {holdLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Locking Seat in DB...</span>
                    </>
                  ) : (
                    <>
                      <span>Lock Seat & Checkout</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="py-12 text-center text-zinc-500 space-y-2">
                <Grid className="w-8 h-8 mx-auto text-zinc-600 opacity-60" />
                <p className="text-xs font-medium">Click on an available seat or 3D section to reserve.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
