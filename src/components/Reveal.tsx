'use client';

import { useEffect, useRef, ReactNode } from 'react';

export default function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reveal = () => {
      setTimeout(() => el.classList.add('revealed'), delay);
    };

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      reveal();
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      reveal();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal();
          observer.disconnect();
        }
      },
      { threshold: 0.01, rootMargin: '0px 0px -5% 0px' }
    );

    observer.observe(el);

    const safety = setTimeout(reveal, delay + 1500);

    return () => {
      observer.disconnect();
      clearTimeout(safety);
    };
  }, [delay]);

  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  );
}