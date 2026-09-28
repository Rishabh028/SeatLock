'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/navbar';

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === '/';

  if (isHome) {
    return (
      <main className="w-full min-h-screen">
        {children}
      </main>
    );
  }

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fadeIn">
        {children}
      </main>
    </>
  );
}
