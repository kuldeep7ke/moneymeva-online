'use client';

import Link from 'next/link';
import { Shield, ArrowLeft, Lock, Eye, Database, Trash2, Mail, Cloud, AlertTriangle } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-light via-white to-brand-secondary dark:from-brand-dark dark:via-[#2A2522] dark:to-brand-muted py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-brand dark:text-slate-400 dark:hover:text-brand-secondary transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>

        <div className="text-center space-y-4 py-6">
          <div className="bg-brand-secondary dark:bg-brand-muted/30 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto">
            <Shield className="h-8 w-8 text-brand dark:text-brand-secondary" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Privacy Policy</h1>
          <p className="text-slate-500 dark:text-slate-400">Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        <div className="bg-white dark:bg-[#2A2522] p-6 rounded-2xl border border-slate-200 dark:border-brand-muted shadow-sm space-y-6">
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
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Cloud className="h-5 w-5 text-amber-500" /> <AlertTriangle className="h-4 w-4 text-amber-500" /> Multi-Device Sync &amp; Your Data
            </h2>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-2">
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">
                When you use the optional multi-device sync feature, your encrypted data is transmitted to and stored on a remote CouchDB server that you specify. This means:
              </p>
              <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-2 ml-4 text-sm">
                <li>Your data is <strong>no longer local only</strong> — it resides on the remote server you provide.</li>
                <li>The sync URL you provide is the <strong>only authentication mechanism</strong> protecting your data on that server.</li>
                <li>Anyone who obtains this URL can <strong>access your complete financial data</strong> stored on the remote server.</li>
                <li>The security of your data on the remote server depends entirely on that server&apos;s security measures, which are beyond our control.</li>
                <li>You should only use CouchDB servers that you <strong>trust and manage</strong> yourself.</li>
                <li>Neither your data nor the sync URL is <strong>ever collected, stored, or known</strong> by Money Meva or its developers.</li>
              </ul>
            </div>
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
        </div>
      </div>
    </div>
  );
}
