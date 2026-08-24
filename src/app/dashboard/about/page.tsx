'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { BASE_PATH } from '@/lib/env';
import { Mail, Globe, Copyright, Info, User, Briefcase, Wallet, Target, Phone, MapPin } from 'lucide-react';
import Link from 'next/link';
import { getSession } from '@/lib/localAuth';
import Reveal from '@/components/Reveal';

export default function AboutPage() {
  const [version, setVersion] = useState('4.0.1');
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const meta = document.querySelector('meta[name="app-version"]');
    if (meta) setVersion(meta.getAttribute('content') || '2.0.0');
    setSession(getSession().user);
  }, []);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        <Reveal>
        <div className="text-center space-y-4 py-8">
          <div className="mx-auto">
            <img src={`${BASE_PATH}/logo.png`} alt="Money Meva" className="h-16 w-auto mx-auto" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">Money Meva</h1>
           <p className="text-slate-500 dark:text-slate-400 text-lg">Your minimalistic personal finance companion.</p>
        </div>
        </Reveal>

        <Reveal delay={100}>
        <div className="bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Info className="h-5 w-5 text-brand" /> About
          </h2>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Money Meva is a personal finance management application designed to help you track 
            your expenses, income, savings, and investments. Built with simplicity and minimalism 
            in mind, it provides powerful insights through visual analytics while keeping your 
            financial data private and stored locally on your device.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="bg-brand-light dark:bg-brand-muted p-4 rounded-xl">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Version</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{version}</p>
            </div>
            <div className="bg-brand-light dark:bg-brand-muted p-4 rounded-xl">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Build Date</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{new Date().getFullYear()}</p>
            </div>
            <div className="bg-brand-light dark:bg-brand-muted p-4 rounded-xl">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Data Storage</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">IndexedDB (Local)</p>
            </div>
            <div className="bg-brand-light dark:bg-brand-muted p-4 rounded-xl">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Privacy</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">100% Private</p>
            </div>
          </div>
        </div>
        </Reveal>

        {/* Profile Info */}
        {session && (
        <Reveal delay={200}>
        <div className="bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <User className="h-5 w-5 text-brand" /> Your Profile
            </h2>
            <div className="space-y-3">
              {session.full_name && (
                <div className="flex items-center gap-3 p-3 bg-brand-light dark:bg-brand-muted rounded-xl">
                  <User className="h-5 w-5 text-brand shrink-0" />
                  <div><p className="text-sm font-medium text-slate-900 dark:text-slate-100">{session.full_name}</p><p className="text-xs text-slate-500">Full Name</p></div>
                </div>
              )}
              {session.email && (
                <div className="flex items-center gap-3 p-3 bg-brand-light dark:bg-brand-muted rounded-xl">
                  <Mail className="h-5 w-5 text-brand shrink-0" />
                  <div><p className="text-sm font-medium text-slate-900 dark:text-slate-100">{session.email}</p><p className="text-xs text-slate-500">Email</p></div>
                </div>
              )}
              {session.phone && (
                <div className="flex items-center gap-3 p-3 bg-brand-light dark:bg-brand-muted rounded-xl">
                  <Phone className="h-5 w-5 text-brand shrink-0" />
                  <div><p className="text-sm font-medium text-slate-900 dark:text-slate-100">{session.phone}</p><p className="text-xs text-slate-500">Phone</p></div>
                </div>
              )}
              {session.occupation && (
                <div className="flex items-center gap-3 p-3 bg-brand-light dark:bg-brand-muted rounded-xl">
                  <Briefcase className="h-5 w-5 text-brand shrink-0" />
                  <div><p className="text-sm font-medium text-slate-900 dark:text-slate-100">{session.occupation}{session.business_name ? ` at ${session.business_name}` : ''}</p><p className="text-xs text-slate-500">Work</p></div>
                </div>
              )}
              {session.monthly_income && (
                <div className="flex items-center gap-3 p-3 bg-brand-light dark:bg-brand-muted rounded-xl">
                  <Wallet className="h-5 w-5 text-brand shrink-0" />
                  <div><p className="text-sm font-medium text-slate-900 dark:text-slate-100">{session.monthly_income}</p><p className="text-xs text-slate-500">Monthly Income</p></div>
                </div>
              )}
              {session.primary_goal && (
                <div className="flex items-center gap-3 p-3 bg-brand-light dark:bg-brand-muted rounded-xl">
                  <Target className="h-5 w-5 text-brand shrink-0" />
                  <div><p className="text-sm font-medium text-slate-900 dark:text-slate-100">{session.primary_goal}</p><p className="text-xs text-slate-500">Primary Goal</p></div>
                </div>
              )}
            </div>
          </div>
        </Reveal>
        )}

        <Reveal delay={400}>
        <div className="bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Mail className="h-5 w-5 text-brand" /> Contact & Support
          </h2>
          <div className="space-y-3">
            <a href="mailto:info@marathimeva.com" className="flex items-center gap-3 p-3 bg-brand-light dark:bg-brand-muted rounded-xl hover:bg-brand-secondary dark:hover:bg-brand-muted/30 transition-all group cursor-pointer">
              <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm group-hover:scale-105 transition-transform">
                <Mail className="h-5 w-5 text-brand" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-brand dark:group-hover:text-brand-secondary">Email Us</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">info@marathimeva.com</p>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500 group-hover:text-brand">→</span>
            </a>

            <a href="https://www.marathimeva.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-brand-light dark:bg-brand-muted rounded-xl hover:bg-brand-secondary dark:hover:bg-brand-muted/30 transition-all group cursor-pointer">
              <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm group-hover:scale-105 transition-transform">
                <Globe className="h-5 w-5 text-brand" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-900 dark:text-slate-100 group-hover:text-brand dark:group-hover:text-brand-secondary">Visit Website</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">www.marathimeva.com</p>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500 group-hover:text-brand">→</span>
            </a>

            <div className="flex items-center gap-3 p-3 bg-brand-light dark:bg-brand-muted rounded-xl">
              <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                <MapPin className="h-5 w-5 text-brand" />
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">Made in India</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Built with care for Indian users</p>
              </div>
            </div>
          </div>
        </div>
        </Reveal>

        <Reveal delay={500}>
        <div className="bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
            <Copyright className="h-5 w-5 text-brand" /> License & Privacy
          </h2>
          <div className="bg-brand-light dark:bg-brand-muted p-4 rounded-xl text-center space-y-2">
            <p className="text-slate-600 dark:text-slate-400">
              &copy; {new Date().getFullYear()} Money Meva. All rights reserved.
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Built with Next.js, TypeScript, Tailwind CSS & Dexie.js &middot; Data stored locally
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              🔒 All your financial data stays on this device. Nothing is sent to the cloud.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 mt-4 justify-center">
            <Link href="/dashboard/privacy" className="text-sm text-brand hover:text-brand-secondary dark:text-brand-secondary dark:hover:text-brand transition-colors font-medium">
              Privacy Policy
            </Link>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <Link href="/dashboard/terms" className="text-sm text-brand hover:text-brand-secondary dark:text-brand-secondary dark:hover:text-brand transition-colors font-medium">
              Terms of Service
            </Link>
          </div>
        </div>
        </Reveal>

        <Reveal delay={600}>
        <div className="text-center text-xs text-slate-400 dark:text-slate-500 pb-8">
          Money Meva {version} &mdash; Made with care for your financial peace of mind.
        </div>
        </Reveal>
      </div>

    </DashboardLayout>
  );
}
