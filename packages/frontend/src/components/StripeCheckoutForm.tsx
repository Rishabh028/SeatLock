'use client';

import React, { useState } from 'react';
import { CreditCard, Zap, ShieldCheck, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';

interface StripeCheckoutFormProps {
  amountMinor: number;
  currency?: string;
  onConfirmPayment: (paymentMethod: 'stripe' | 'mock', cardDetails?: any) => Promise<void>;
  isProcessing: boolean;
}

export function StripeCheckoutForm({
  amountMinor,
  currency = 'USD',
  onConfirmPayment,
  isProcessing,
}: StripeCheckoutFormProps) {
  const [paymentMode, setPaymentMode] = useState<'stripe' | 'mock'>('stripe');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardName, setCardName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const formatAmount = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(cents / 100);
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = raw.match(/.{1,4}/g)?.join(' ') || raw;
    setCardNumber(formatted);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      raw = `${raw.slice(0, 2)}/${raw.slice(2)}`;
    }
    setCardExpiry(raw);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (paymentMode === 'stripe') {
      const cleanNumber = cardNumber.replace(/\s/g, '');
      if (cleanNumber.length < 15) {
        setError('Please enter a valid card number (or click "Fill Test Card").');
        return;
      }
      if (!cardExpiry || cardExpiry.length < 5) {
        setError('Please enter expiration in MM/YY format.');
        return;
      }
      if (!cardCvc || cardCvc.length < 3) {
        setError('Please enter a 3-digit security code (CVC).');
        return;
      }

      await onConfirmPayment('stripe', {
        number: cleanNumber,
        exp_month: cardExpiry.split('/')[0],
        exp_year: cardExpiry.split('/')[1],
        cvc: cardCvc,
        name: cardName || 'SeatLock Guest',
      });
    } else {
      await onConfirmPayment('mock');
    }
  };

  const fillTestCard = () => {
    setCardNumber('4242 4242 4242 4242');
    setCardExpiry('12/28');
    setCardCvc('888');
    setCardName('Jane Doe (Test)');
    setError(null);
  };

  return (
    <div className="w-full glass-panel p-6 rounded-2xl border border-white/10 shadow-2xl">
      {/* Mode Switcher */}
      <div className="flex items-center gap-2 p-1 bg-black/40 rounded-xl mb-6 border border-white/10">
        <button
          type="button"
          onClick={() => setPaymentMode('stripe')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
            paymentMode === 'stripe'
              ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Stripe Payment Gateway</span>
        </button>

        <button
          type="button"
          onClick={() => setPaymentMode('mock')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
            paymentMode === 'mock'
              ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-600/30'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-300" />
          <span>Instant 1-Click Demo</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-3.5 mb-4 rounded-xl text-xs font-medium bg-red-950/50 border border-red-500/30 text-red-300 animate-fadeIn">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {paymentMode === 'stripe' ? (
          <>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300">Card Information</label>
              <button
                type="button"
                onClick={fillTestCard}
                className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors"
              >
                Auto-Fill Stripe Test Card (4242...)
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="4242 4242 4242 4242"
                value={cardNumber}
                onChange={handleCardNumberChange}
                disabled={isProcessing}
                className="w-full px-4 py-3 bg-zinc-900/90 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 opacity-70">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">VISA</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">MC</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Expiration</label>
                <input
                  type="text"
                  placeholder="MM/YY"
                  value={cardExpiry}
                  onChange={handleExpiryChange}
                  disabled={isProcessing}
                  className="w-full px-3.5 py-2.5 bg-zinc-900/90 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Security Code (CVC)</label>
                <input
                  type="password"
                  placeholder="123"
                  maxLength={4}
                  value={cardCvc}
                  onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  disabled={isProcessing}
                  className="w-full px-3.5 py-2.5 bg-zinc-900/90 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">Cardholder Name</label>
              <input
                type="text"
                placeholder="Name on card"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                disabled={isProcessing}
                className="w-full px-3.5 py-2.5 bg-zinc-900/90 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </>
        ) : (
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs text-emerald-300/90 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Instant Sandbox Mode Active</span>
            </div>
            <p>
              Simulates a deterministic, zero-latency payment with automated idempotency key generation.
              Used for high-concurrency testing and rapid demonstrations.
            </p>
          </div>
        )}

        {/* Security badges */}
        <div className="flex items-center justify-between text-[11px] text-zinc-500 py-1">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            <span>256-Bit TLS Encryption</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Idempotency-Key Protected</span>
          </div>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isProcessing}
          className="w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-xl shadow-indigo-600/30 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Processing Payment & Securing Seat...</span>
            </>
          ) : (
            <span>Authorize & Pay {formatAmount(amountMinor)}</span>
          )}
        </button>
      </form>
    </div>
  );
}
