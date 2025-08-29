import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import ThemeColor from './theme-color';
import InstallPrompt from './install-prompt';
import SWRegister from './sw-register';
import Script from 'next/script';

// ⬅️ OVO MORA POSTOJATI:
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Mini KPI', template: '%s · Mini KPI' },
  description: 'Mini KPI PWA — unos aktivnosti, izvještaji i exporti.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Mini KPI',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bs">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#0b5ed7" />
      </head>
      <body className="bg-neutral-950 text-neutral-100">
        <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
          <nav className="mx-auto max-w-3xl flex gap-4 p-3 text-sm items-center">
            <Link href="/">Početna</Link>
            <Link href="/unos">Unos</Link>
            <Link href="/pregled">Pregled</Link>
            <Link href="/izvjestaj">Izvještaj</Link>
            <Link href="/period">Periodični</Link>
            <div className="ml-auto">
              <InstallPrompt />
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl p-4">{children}</main>
        <SWRegister /> {/* ⬅️ ručna registracija SW */}
        <Script id="sw-register" strategy="afterInteractive">
          {`
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) {
          navigator.serviceWorker
            .register('/sw.js', { scope: '/' })
            .then(r => console.log('[SW] registered:', r.scope))
            .catch(err => console.warn('[SW] registration failed:', err));
        } else {
          console.log('[SW] already registered:', reg.scope);
        }
      });
    });
  }
`}
        </Script>
      </body>
    </html>
  );
}
