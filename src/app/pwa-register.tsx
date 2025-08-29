'use client';
import { useEffect, useState } from 'react';

export default function PWARegister() {
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const onUpdate = (reg: ServiceWorkerRegistration) => {
      // odmah preuzeta nova verzija (skipWaiting u next-pwa)
      if (reg.waiting) setUpdated(true);
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdated(true);
          }
        });
      });
    };

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        onUpdate(reg);
        // periodični check (1x na 30min)
        setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
      })
      .catch(console.error);
  }, []);

  if (!updated) return null;

  return (
    <div
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50
                    bg-white/10 backdrop-blur border border-white/20
                    text-white px-3 py-2 rounded-xl flex gap-2 items-center"
    >
      <span>Aplikacija je ažurirana.</span>
      <button
        className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-500"
        onClick={() => window.location.reload()}
      >
        Osvježi
      </button>
    </div>
  );
}
