'use client';

import DashboardLayout from '@/components/DashboardLayout';
import Reveal from '@/components/Reveal';
import { HeadphonesIcon, ArrowLeft, Mail, MessageCircle, Globe, Clock, Shield } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function SupportPage() {
  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        <Reveal><Link href="/dashboard/settings" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-brand dark:text-slate-400 dark:hover:text-brand-secondary transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Settings
        </Link></Reveal>

        <Reveal delay={100}><div className="text-center space-y-4 py-6">
          <div className="bg-gradient-to-br from-sky-500 to-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
            <HeadphonesIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Contact Support</h1>
          <p className="text-slate-500 dark:text-slate-400">We are here to help you.</p>
        </div></Reveal>

        <Reveal delay={200}><div className="bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm space-y-6">

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Mail className="h-5 w-5 text-sky-500" /> Email
            </h2>
            <p className="text-slate-600 dark:text-slate-400">Send us an email and we will get back to you within 24 hours.</p>
            <a href="mailto:support@moneymeva.com" className="inline-flex items-center gap-2 text-brand dark:text-brand-secondary font-medium hover:underline">
              support@moneymeva.com <Mail className="h-4 w-4" />
            </a>
          </section>

          <div className="border-t border-slate-100 dark:border-brand-muted" />

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-sky-500" /> Telegram
            </h2>
            <p className="text-slate-600 dark:text-slate-400">Reach out to us directly on Telegram for quick assistance.</p>
            <a href="https://t.me/marathimeva" target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="bg-sky-600 hover:bg-sky-700 gap-2">
                <MessageCircle className="h-4 w-4" /> @marathimeva
              </Button>
            </a>
          </section>

          <div className="border-t border-slate-100 dark:border-brand-muted" />

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Globe className="h-5 w-5 text-sky-500" /> Website
            </h2>
            <p className="text-slate-600 dark:text-slate-400">Visit our website for documentation, FAQs, and updates.</p>
            <a href="https://moneymeva.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-brand dark:text-brand-secondary font-medium hover:underline">
              moneymeva.com <Globe className="h-4 w-4" />
            </a>
          </section>

          <div className="border-t border-slate-100 dark:border-brand-muted" />

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock className="h-5 w-5 text-sky-500" /> Response Time
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              We aim to respond to all inquiries within <strong>24 hours</strong> on business days. For urgent matters, Telegram is the fastest way to reach us.
            </p>
          </section>
        </div></Reveal>
      </div>
    </DashboardLayout>
  );
}
