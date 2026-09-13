'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getEvents, Event } from '@/lib/api';
import { formatDate, formatPrice } from '@/lib/utils';

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEvents()
      .then(res => setEvents(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-fadeIn">
      <h1 className="text-3xl font-bold mb-2">Events</h1>
      <p className="text-gray-400 mb-8">Browse upcoming events and book your seats.</p>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-[#12121a] border border-[#1e1e2e] rounded-2xl h-48 animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          No events available. Check back soon!
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {events.map(event => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="group bg-[#12121a] border border-[#1e1e2e] rounded-2xl p-6 hover:border-indigo-500/30 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-white group-hover:text-indigo-400 transition-colors mb-1">
                    {event.name}
                  </h2>
                  <p className="text-sm text-gray-500">📍 {event.venue}</p>
                </div>
                <span className="text-2xl">🎪</span>
              </div>
              <p className="text-sm text-gray-400 mb-4 line-clamp-2">{event.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">📅 {formatDate(event.starts_at)}</span>
                <span className="text-sm bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full">
                  View Seats →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
