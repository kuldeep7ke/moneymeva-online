'use client';

import React, { useRef, useState } from 'react';

interface SwipeCardProps {
  children: React.ReactNode;
  actions: React.ReactNode;
  onSwipeOpen?: () => void;
  onSwipeClose?: () => void;
}

export default function SwipeCard({ children, actions, onSwipeOpen, onSwipeClose }: SwipeCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const swiped = useRef(false);

  const ACTIONS_WIDTH = 140;

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    swiped.current = false;
    setSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swiping) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (!swiped.current) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 5) {
        setSwiping(false);
        return;
      }
      if (Math.abs(dx) > 5) {
        swiped.current = true;
      } else {
        return;
      }
    }

    e.preventDefault();
    const newOffset = Math.max(0, Math.min(ACTIONS_WIDTH, offsetX + dx));
    setOffsetX(newOffset);
    startX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    setSwiping(false);
    if (offsetX > ACTIONS_WIDTH / 2) {
      setOffsetX(ACTIONS_WIDTH);
      onSwipeOpen?.();
    } else {
      setOffsetX(0);
      onSwipeClose?.();
    }
  };

  const close = () => {
    setOffsetX(0);
    onSwipeClose?.();
  };

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-xl">
      <div
        className="absolute right-0 top-0 bottom-0 flex"
        style={{ width: ACTIONS_WIDTH }}
      >
        {actions}
      </div>
      <div
        className="relative bg-white dark:bg-[#2A2522] touch-pan-y"
        style={{
          transform: `translateX(-${offsetX}px)`,
          transition: swiping ? 'none' : 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'transform',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
