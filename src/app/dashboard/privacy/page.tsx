'use client';

import DashboardLayout from '@/components/DashboardLayout';
import Reveal from '@/components/Reveal';
import { Shield, ArrowLeft, Lock, Eye, Database, Trash2, Mail } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        <Reveal><Link href="/dashboard/about" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-brand dark:text-slate-400 dark:hover:text-brand-secondary transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to About
        </Link></Reveal>

        <Reveal delay={100}><div className="text-center space-y-4 py-6">
          <div className="bg-brand-secondary dark:bg-brand-muted/30 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto">
            <Shield className="h-8 w-8 text-brand dark:text-brand-secondary" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Privacy Policy</h1>
          <p className="text-slate-500 dark:text-slate-400">Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div></Reveal>

        <Reveal delay={200}><div className="bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm space-y-6">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Eye className="h-5 w-5 text-brand" /> Information We Collect
            </h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Money Meva is designed with privacy as a core principle. We collect <strong>no personal data</strong> and <strong>no financial information</strong> on our servers.
            </p>
            <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-2 ml-4">
              <li>All your financial data (transactions, income, expenses, savings, goals) is stored <strong>locally on your device</strong> using IndexedDB.</li>
              <li>No data is transmitted to any external server or third party.</li>
              <li>No cookies are used for tracking or analytics.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Database className="h-5 w-5 text-brand" /> How Your Data is Stored
            </h2>
            <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-2 ml-4">
              <li>All data is stored in your browser&apos;s IndexedDB — a secure, local database.</li>
              <li>Data never leaves your device unless you manually export it.</li>
              <li>You have full control over your data at all times.</li>
              <li>You can delete all data anytime from Settings → Clear All Data.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Lock className="h-5 w-5 text-brand" /> Data Security
            </h2>
            <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-2 ml-4">
              <li>No account creation or login required on our servers.</li>
              <li>No passwords are stored or transmitted.</li>
              <li>PIN-based security is optional and stored locally only.</li>
              <li>Session auto-lock protects your data when device is idle.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-brand" /> Data Deletion
            </h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Since all data is stored locally, you have complete control:
            </p>
            <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-2 ml-4">
              <li>Delete individual entries from any page.</li>
              <li>Clear all data from Settings → Danger Zone.</li>
              <li>Clear browser data to remove everything permanently.</li>
              <li>No data recovery is possible after deletion — backup regularly.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Third-Party Services</h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Money Meva does not integrate with any third-party analytics, advertising, or tracking services. We do not use Google Analytics, Facebook Pixel, or similar tools.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Changes to This Policy</h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              We may update this Privacy Policy from time to time. Any changes will be reflected in the app with an updated date. Continued use of the app constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Mail className="h-5 w-5 text-brand" /> Contact Us
            </h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <a href="mailto:info@marathimeva.com" className="inline-flex items-center gap-2 text-brand hover:text-brand-secondary dark:text-brand-secondary dark:hover:text-brand transition-colors font-medium">
              info@marathimeva.com
            </a>
          </section>
        </div></Reveal>
      </div>
    </DashboardLayout>
  );
}
