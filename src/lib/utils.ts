import { useState, useEffect, useRef, useCallback } from 'react';
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
    setCategories(getSortedCategories(baseCategories, type));
  }, []);
  return categories;
}
