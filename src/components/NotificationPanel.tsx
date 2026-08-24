'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, AlertTriangle, Trash2, Repeat, Info, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppNotification, getAllNotifications } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { initLocalNotifications, syncLocalNotifications } from '@/lib/capacitor-notifications';

const DISMISSED_KEY = 'mm_dismissed_notifications';

function getDismissedSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')); }
  catch { return new Set(); }
}

function saveDismissedSet(set: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
}

export default function NotificationPanel() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () => {
      const dismissed = getDismissedSet();
      const notifs = getAllNotifications().filter(n => !dismissed.has(n.id));
      setNotifications(notifs);
      syncLocalNotifications();
    };
    load();
    initLocalNotifications();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  const dismissOne = (id: string) => {
    const set = getDismissedSet();
    set.add(id);
    saveDismissedSet(set);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const dismissAll = () => {
    const set = new Set(notifications.map(n => n.id));
    const existing = getDismissedSet();
    existing.forEach(id => set.add(id));
    saveDismissedSet(set);
    setNotifications([]);
  };

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const iconMap: Record<string, React.ElementType> = {
    recurring: Repeat,
    trash: Trash2,
    budget: AlertTriangle,
    reminder: Info,
    sync: RefreshCw,
  };

  const severityColors: Record<string, string> = {
    danger: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
  };

  const dotColors: Record<string, string> = {
    danger: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
  };

  return (
    <div ref={ref} className="relative">
      <Button variant="outline" className="relative p-2 rounded-full" onClick={() => setOpen(!open)}>
        <Bell className="h-5 w-5" />
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {notifications.length}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-[#2A2522] rounded-2xl border border-slate-200 dark:border-brand-muted shadow-xl z-50 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-brand-muted sticky top-0 bg-white dark:bg-[#2A2522]">
            <h3 className="font-bold text-slate-900 dark:text-slate-100">Notifications</h3>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-600 h-7 px-2" onClick={dismissAll}>
                  Clear All
                </Button>
              )}
              <Button variant="ghost" size="sm" className="p-1 h-auto" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">No notifications</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {notifications.map(n => {
                const Icon = iconMap[n.type];
                return (
                  <div key={n.id} className={cn("p-3 border-l-2 transition-colors group", severityColors[n.severity])}>
                    <div className="flex items-start gap-3">
                      <div className={cn("mt-0.5 p-1 rounded-full", dotColors[n.severity] + '/20')}>
                        {Icon && <Icon className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="text-xs mt-0.5 opacity-80">{n.message}</p>
                      </div>
                      <button onClick={() => dismissOne(n.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
