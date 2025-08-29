'use client';
import { useEffect } from 'react';

export default function SWRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        // registruj root scope
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        // console.log('SW registered:', reg);
      } catch (e) {
        console.warn('SW registration failed:', e);
      }
    };

    // pri potpunom učitavanju izbjegavamo race uslove
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);

    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
