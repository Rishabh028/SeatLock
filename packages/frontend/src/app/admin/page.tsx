'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, 
  Layers, 
  CreditCard, 
  Bell, 
  Search, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Cpu, 
  RefreshCw,
  Database,
  ArrowUpRight,
  Activity
} from 'lucide-react';
import { getAdminStats, getAdminBookings, getAdminPayments, getAdminWebhooks } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatPrice } from '@/lib/utils';

export default function AdminPage() {
  const router = useRouter();
  const { token, isAdmin } = useAuth();
  const [stats, setStats] = useState<Record<string, string> | null>(null);
  const [bookings, setBookings] = useState<Record<string, unknown>[]>([]);
  const [payments, setPayments] = useState<Record<string, unknown>[]>([]);
  const [webhooks, setWebhooks] = useState<Record<string, unknown>[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'payments' | 'webhooks'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    if (!token || !isAdmin) return;
    setRefreshing(true);
    try {
      const [sRes, bRes, pRes, wRes] = await Promise.all([
        getAdminStats(token),
        getAdminBookings(token),
        getAdminPayments(token),
        getAdminWebhooks(token),
      ]);
      setStats(sRes.data);
      setBookings(bRes.data);
      setPayments(pRes.data);
      setWebhooks(wRes.data);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!token || !isAdmin) {
      router.push('/login');
      return;
    }
    loadData();
  }, [token, isAdmin, router]);

  const filteredBookings = useMemo(() => {
    if (!searchQuery) return bookings;
    const q = searchQuery.toLowerCase();
    return bookings.filter(b => 
      String(b.event_name || '').toLowerCase().includes(q) ||
      String(b.seat_label || '').toLowerCase().includes(q) ||
      String(b.user_name || '').toLowerCase().includes(q) ||
      String(b.status || '').toLowerCase().includes(q)
    );
  }, [bookings, searchQuery]);

  const filteredPayments = useMemo(() => {
    if (!searchQuery) return payments;
    const q = searchQuery.toLowerCase();
    return payments.filter(p => 
      String(p.event_name || '').toLowerCase().includes(q) ||
      String(p.user_name || '').toLowerCase().includes(q) ||
      String(p.status || '').toLowerCase().includes(q) ||
      String(p.provider_ref || '').toLowerCase().includes(q)
    );
  }, [payments, searchQuery]);

  const filteredWebhooks = useMemo(() => {
    if (!searchQuery) return webhooks;
    const q = searchQuery.toLowerCase();
    return webhooks.filter(w => 
      String(w.provider_event_id || '').toLowerCase().includes(q) ||
      String(w.event_type || '').toLowerCase().includes(q)
    );
  }, [webhooks, searchQuery]);

  if (!isAdmin) return null;

  const tabs = [
    { id: 'overview' as const, label: 'Engine Overview', icon: Cpu },
    { id: 'bookings' as const, label: 'Bookings', icon: Layers, count: bookings.length },
    { id: 'payments' as const, label: 'Payments', icon: CreditCard, count: payments.length },
    { id: 'webhooks' as const, label: 'Webhooks & Outbox', icon: Bell, count: webhooks.length },
  ];

  return (
    <div className="py-6 px-4 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono font-semibold uppercase tracking-widest text-emerald-400">
              SeatLock Command Center
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2">
            System & Concurrency Monitor
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Transactional outbox state, hold leases, and webhook idempotency logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Live Refresh'}</span>
          </button>
          <div className="px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs font-mono text-indigo-300 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-indigo-400" />
            <span>Pool Max: 75</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-1.5 p-1 bg-[#0c0c16] border border-white/10 rounded-2xl">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearchQuery('');
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeTab !== 'overview' && (
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder={`Filter ${activeTab}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#0c0c16] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        )}
      </div>

      {/* Tab 1: Overview */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && stats && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Primary Concurrency Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Events', value: stats.total_events, icon: Calendar, color: 'text-indigo-400', badge: 'Active' },
                { label: 'Total Seats', value: stats.total_seats, icon: Layers, color: 'text-white', badge: 'Inventory' },
                { label: 'Active Holds', value: stats.active_holds, icon: Clock, color: 'text-amber-400', badge: '10m Expiry' },
                { label: 'Confirmed Bookings', value: stats.confirmed_bookings, icon: CheckCircle2, color: 'text-emerald-400', badge: 'Atomic' },
              ].map(stat => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="glass-panel p-5 relative overflow-hidden group hover:border-indigo-500/30 transition-all">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                      <span className="flex items-center gap-1.5">
                        <Icon className={`w-4 h-4 ${stat.color}`} />
                        {stat.label}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                        {stat.badge}
                      </span>
                    </div>
                    <div className={`text-3xl font-bold tracking-tight ${stat.color}`}>
                      {stat.value}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Inventory Distribution & Financial Health */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Seat Inventory State */}
              <div className="glass-panel p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-400" />
                    Seat Status Breakdown
                  </h2>
                  <span className="text-[11px] text-gray-500">Live Inventory State</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#0a0a14] border border-white/5 p-3.5 rounded-xl text-center">
                    <span className="text-xs text-emerald-400 block mb-1">Available</span>
                    <span className="text-2xl font-bold text-white">{stats.available_seats}</span>
                  </div>
                  <div className="bg-[#0a0a14] border border-white/5 p-3.5 rounded-xl text-center">
                    <span className="text-xs text-amber-400 block mb-1">Held (Pending)</span>
                    <span className="text-2xl font-bold text-white">{stats.held_seats}</span>
                  </div>
                  <div className="bg-[#0a0a14] border border-white/5 p-3.5 rounded-xl text-center">
                    <span className="text-xs text-rose-400 block mb-1">Confirmed</span>
                    <span className="text-2xl font-bold text-white">{stats.booked_seats}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400 space-y-1">
                  <div className="flex justify-between text-gray-300">
                    <span>Concurrency Invariant:</span>
                    <span className="text-emerald-400 font-mono">Partial Unique Index</span>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    At most one CONFIRMED booking per (event_id, seat_id). Expired holds are released automatically by background cron worker.
                  </p>
                </div>
              </div>

              {/* Payment Settlement & Webhooks */}
              <div className="glass-panel p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-purple-400" />
                    Payment & Webhook Pipeline
                  </h2>
                  <span className="text-[11px] text-gray-500">Stripe / Mock Provider</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#0a0a14] border border-white/5 p-3.5 rounded-xl">
                    <span className="text-xs text-gray-400 block mb-1">Successful Payments</span>
                    <span className="text-2xl font-bold text-emerald-400">{stats.successful_payments}</span>
                    <span className="text-[11px] text-gray-500 block mt-1">out of {stats.total_payments} total</span>
                  </div>
                  <div className="bg-[#0a0a14] border border-white/5 p-3.5 rounded-xl">
                    <span className="text-xs text-gray-400 block mb-1">Processed Webhooks</span>
                    <span className="text-2xl font-bold text-indigo-400">{stats.processed_webhooks}</span>
                    <span className="text-[11px] text-gray-500 block mt-1">out of {stats.total_webhooks} total</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400 space-y-1">
                  <div className="flex justify-between text-gray-300">
                    <span>Webhook Idempotency:</span>
                    <span className="text-indigo-400 font-mono">provider_event_id UNIQUE</span>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Duplicate webhook deliveries return HTTP 200 without double-settling or issuing duplicate tickets.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tab 2: Bookings */}
        {activeTab === 'bookings' && (
          <motion.div
            key="bookings"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-panel overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 text-left bg-white/5 uppercase tracking-wider font-semibold">
                    <th className="px-5 py-3.5">Event</th>
                    <th className="px-5 py-3.5">Seat</th>
                    <th className="px-5 py-3.5">Customer</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Payment</th>
                    <th className="px-5 py-3.5">Settlement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-500">
                        No bookings match your filter.
                      </td>
                    </tr>
                  ) : (
                    filteredBookings.map((b, i) => (
                      <tr key={i} className="hover:bg-white/5 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-white">{b.event_name as string}</td>
                        <td className="px-5 py-3.5 font-mono font-semibold text-indigo-300">{b.seat_label as string}</td>
                        <td className="px-5 py-3.5 text-gray-300">{b.user_name as string}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold ${
                            b.status === 'CONFIRMED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {b.status as string}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-gray-300">
                          {b.payment_status ? (
                            <span className={b.payment_status === 'SUCCEEDED' ? 'text-emerald-400' : 'text-amber-400'}>
                              {b.payment_status as string}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-white">
                          {b.payment_amount ? formatPrice(b.payment_amount as number) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Tab 3: Payments */}
        {activeTab === 'payments' && (
          <motion.div
            key="payments"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-panel overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 text-left bg-white/5 uppercase tracking-wider font-semibold">
                    <th className="px-5 py-3.5">Payment ID</th>
                    <th className="px-5 py-3.5">Event</th>
                    <th className="px-5 py-3.5">Customer</th>
                    <th className="px-5 py-3.5">Amount</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Provider Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-500">
                        No payments match your filter.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((p, i) => (
                      <tr key={i} className="hover:bg-white/5 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-gray-400">
                          {(p.id as string).slice(0, 8)}...
                        </td>
                        <td className="px-5 py-3.5 font-medium text-white">{p.event_name as string}</td>
                        <td className="px-5 py-3.5 text-gray-300">{p.user_name as string}</td>
                        <td className="px-5 py-3.5 font-semibold text-white">{formatPrice(p.amount_minor as number)}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold ${
                            p.status === 'SUCCEEDED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : p.status === 'FAILED'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {p.status as string}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-gray-400">
                          {(p.provider_ref as string) || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Tab 4: Webhooks */}
        {activeTab === 'webhooks' && (
          <motion.div
            key="webhooks"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-panel overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 text-left bg-white/5 uppercase tracking-wider font-semibold">
                    <th className="px-5 py-3.5">Provider Event ID</th>
                    <th className="px-5 py-3.5">Event Type</th>
                    <th className="px-5 py-3.5">Processed</th>
                    <th className="px-5 py-3.5">Received At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredWebhooks.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-gray-500">
                        No webhook records found.
                      </td>
                    </tr>
                  ) : (
                    filteredWebhooks.map((w, i) => (
                      <tr key={i} className="hover:bg-white/5 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-indigo-300 font-semibold">
                          {w.provider_event_id as string}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-gray-200">
                          {w.event_type as string}
                        </td>
                        <td className="px-5 py-3.5">
                          {w.processed_at ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Processed</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-400">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Pending</span>
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-gray-400 font-mono">
                          {new Date(w.created_at as string).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
