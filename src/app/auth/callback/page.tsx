'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then((result: { data: any; error: any }) => {
      const data = result.data;
      const err = result.error;
      if (err || !data.session) {
        setError('Authentication failed. Using local mode instead.');
        setTimeout(() => router.push('/dashboard'), 2000);
      } else {
        router.push('/dashboard');
      }
    });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-light dark:bg-brand-dark">
      <div className="text-center space-y-4">
        {error ? (
          <>
            <div className="rounded-full h-12 w-12 bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
              <span className="text-amber-600 dark:text-amber-400 text-xl font-bold">!</span>
            </div>
            <p className="text-amber-600 dark:text-amber-400 font-medium">{error}</p>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand dark:border-brand-secondary mx-auto"></div>
            <p className="text-slate-600 dark:text-slate-400 font-medium">Signing in...</p>
          </>
        )}
      </div>
    </div>
  );
}
