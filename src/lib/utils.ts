import { useState, useEffect, useRef } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getTransactions } from './store';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView } as const;
}

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
};

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Inclusive calendar-day window in the device's local timezone.
// startDate 'YYYY-MM-DD' → shows ON that day from midnight; endDate → shows THROUGH that day.
export function isWithinPeriod(startDate?: string, endDate?: string): boolean {
  if (!startDate && !endDate) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parseDay = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y || 1970, (m || 1) - 1, d || 1);
  };
  if (startDate && parseDay(startDate) > today) return false;
  if (endDate && parseDay(endDate) < today) return false;
  return true;
}

export function getSortedCategories(baseCategories: string[], type?: string): string[] {
  try {
    const txs = getTransactions(type);
    const freq: Record<string, number> = {};
    txs.forEach((t: any) => { freq[t.category] = (freq[t.category] || 0) + 1; });
    const categories = Array.from(new Set([...baseCategories, ...Object.keys(freq)]));
    return categories.sort((a, b) => (freq[b] || 0) - (freq[a] || 0));
  } catch {
    return baseCategories;
  }
}

export function useSortedCategories(baseCategories: string[], type?: string): string[] {
  const [categories, setCategories] = useState(baseCategories);
  useEffect(() => {
    const compute = () => setCategories(getSortedCategories(baseCategories, type));
    compute();
    window.addEventListener('store-ready', compute);
    return () => window.removeEventListener('store-ready', compute);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return categories;
}
