'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { login, ApiError, AuthUser } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import GoogleSignInButton from '@/components/GoogleSignInButton';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await login(email, password);
      setAuth(res.user, res.token);
      router.push('/events');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-panel p-8 sm:p-10 relative overflow-hidden"
      >
        {/* Glow ambient accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-8 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 p-0.5 mx-auto mb-4 shadow-lg shadow-indigo-500/25">
            <div className="w-full h-full bg-[#0d0d18] rounded-[14px] flex items-center justify-center">
              <Lock className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
            Welcome Back
          </h1>
          <p className="text-sm text-gray-400">
            Sign in to access your atomic holds and guaranteed seats
          </p>
        </div>

        {/* Google OAuth Button */}
        <div className="mb-6">
          <GoogleSignInButton
            onSuccess={(user: AuthUser, token: string) => {
              setAuth(user, token);
              router.push('/events');
            }}
            onError={(err) => setError(err)}
          />
        </div>

        <div className="relative flex items-center justify-center my-6">
          <div className="border-t border-white/10 w-full" />
          <span className="bg-[#0c0c16] px-3 text-xs text-gray-500 uppercase tracking-wider relative z-10">
            Or continue with email
          </span>
          <div className="border-t border-white/10 w-full" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-[#080811]/90 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                placeholder="alice@example.com"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="password" className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Password
              </label>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-[#080811]/90 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full relative group overflow-hidden bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 text-white py-3.5 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in...
              </span>
            ) : (
              <>
                <span>Sign In with Password</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>

          <div className="text-center text-xs text-gray-400 pt-2">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Create account
            </Link>
          </div>

          {/* Quick Demo Logins */}
          <div className="border-t border-white/10 pt-5 mt-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              Quick-Fill Demo Credentials
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setEmail('admin@seatlock.dev'); setPassword('admin123'); }}
                className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 text-gray-300 hover:text-white"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                <span>Admin</span>
              </button>
              <button
                type="button"
                onClick={() => { setEmail('alice@example.com'); setPassword('user123'); }}
                className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 text-gray-300 hover:text-white"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Alice (User)</span>
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
