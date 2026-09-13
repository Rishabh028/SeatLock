'use client';

import React, { useRef, useState } from 'react';
import { Ticket, Calendar, MapPin, ShieldCheck, QrCode } from 'lucide-react';

interface HolographicTicket3DProps {
  eventName: string;
  venue: string;
  dateStr?: string;
  seatLabel: string;
  tier: string;
  priceFormatted: string;
  bookingId?: string;
  holdExpiresIn?: string;
}

export function HolographicTicket3D({
  eventName,
  venue,
  dateStr = 'Sun, Oct 18 • 7:30 PM',
  seatLabel,
  tier,
  priceFormatted,
  bookingId,
  holdExpiresIn,
}: HolographicTicket3DProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = ((y - centerY) / centerY) * -14;
    const rotY = ((x - centerX) / centerX) * 14;

    setRotate({ x: rotX, y: rotY });
    setGlare({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.35,
    });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
    setGlare(prev => ({ ...prev, opacity: 0 }));
  };

  return (
    <div className="perspective-container w-full max-w-md mx-auto my-6">
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="holographic-card relative w-full p-6 text-white cursor-pointer shadow-2xl transition-transform duration-150 ease-out"
        style={{
          transform: `perspective(1000px) rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
        }}
      >
        {/* Dynamic Holographic Foil Shimmer */}
        <div
          className="holographic-shimmer"
          style={{
            opacity: glare.opacity,
            background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.4) 0%, rgba(99,102,241,0.3) 30%, rgba(236,72,153,0.3) 60%, transparent 80%)`,
          }}
        />

        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-400">
              <Ticket className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-indigo-400">SeatLock Verified</span>
              <h3 className="font-bold text-base leading-tight text-white">{eventName}</h3>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {tier}
          </span>
        </div>

        {/* Ticket Body */}
        <div className="grid grid-cols-2 gap-4 my-4 text-xs">
          <div>
            <span className="text-zinc-400 flex items-center gap-1 mb-0.5">
              <Calendar className="w-3 h-3 text-zinc-500" /> Date & Time
            </span>
            <span className="font-semibold text-zinc-200">{dateStr}</span>
          </div>

          <div>
            <span className="text-zinc-400 flex items-center gap-1 mb-0.5">
              <MapPin className="w-3 h-3 text-zinc-500" /> Venue
            </span>
            <span className="font-semibold text-zinc-200 truncate block">{venue}</span>
          </div>

          <div>
            <span className="text-zinc-400 mb-0.5 block">Allocated Seat</span>
            <span className="text-lg font-black text-indigo-400 tracking-wide">{seatLabel}</span>
          </div>

          <div>
            <span className="text-zinc-400 mb-0.5 block">Price</span>
            <span className="text-lg font-black text-emerald-400">{priceFormatted}</span>
          </div>
        </div>

        {/* Perforation Line */}
        <div className="relative my-4 flex items-center">
          <div className="absolute -left-8 w-4 h-4 rounded-full bg-[#07070c]" />
          <div className="w-full border-t-2 border-dashed border-white/15" />
          <div className="absolute -right-8 w-4 h-4 rounded-full bg-[#07070c]" />
        </div>

        {/* Barcode & Security Stamped Footer */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Immutable Database Lock</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono block">
              {bookingId ? `ID: ${bookingId.slice(0, 16)}...` : holdExpiresIn ? `Hold: ${holdExpiresIn}` : 'Cryptographic ID Key'}
            </span>
          </div>

          <div className="p-1.5 bg-white rounded-lg shadow-inner">
            <QrCode className="w-8 h-8 text-black" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default HolographicTicket3D;
