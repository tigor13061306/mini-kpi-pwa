'use client';
import { useEffect, useRef, useState } from 'react';

type Mode = 'hidden' | 'bip' | 'ios' | 'hint';

export default function InstallPrompt() {
  const deferred = useRef<any>(null);
  const [mode, setMode] = useState<Mode>('hidden');

  useEffect(() => {
    // Ako je već instalirano (standalone), ne nudimo ništa
    const isStandalone =
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      // iOS posebni flag
      (navigator as any).standalone === true;

    if (isStandalone) {
      setMode('hidden');
      return;
    }

    // iOS detekcija (bez MSStream): UA + iPadOS (MacIntel + touch)
    const ua = navigator.userAgent || '';
    const isIOSUA = /iPad|iPhone|iPod/.test(ua);
    const isIPadOS = navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1;
    const isIOS = isIOSUA || isIPadOS;

    if (isIOS) {
      setMode('ios'); // iOS nema beforeinstallprompt → prikaži upute
      return;
    }

    // Android/desktop Chromium — hvatamo beforeinstallprompt
    const onBeforeInstall = (e: any) => {
      e.preventDefault();
      deferred.current = e;
      setMode('bip'); // imamo event, prikaži "Instaliraj" dugme
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // Fallback: ako event ne stigne, pokaži upute nakon 3s
    const t = window.setTimeout(() => {
      if (!deferred.current) setMode('hint');
    }, 3000);

    // Ako se app instalira u međuvremenu, sakrij
    const onInstalled = () => setMode('hidden');
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      window.clearTimeout(t);
    };
  }, []);

  if (mode === 'hidden') return null;

  if (mode === 'ios') {
    return (
      <button
        type="button"
        className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm"
        onClick={() =>
          alert('Na iPhone/iPad instalacija ide iz Safari-ja: Share → Add to Home Screen.')
        }
      >
        Dodaj na početni ekran
      </button>
    );
  }

  if (mode === 'hint') {
    return (
      <button
        type="button"
        className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm"
        onClick={() =>
          alert('U Chrome/Edge otvori meni (⋮) → Install app / Add to Home screen.')
        }
      >
        Instaliraj (upute)
      </button>
    );
  }

  // mode === 'bip'
  return (
    <button
      type="button"
      className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm"
      onClick={async () => {
        const ev = deferred.current;
        if (!ev) return;
        ev.prompt();
        await ev.userChoice; // 'accepted' | 'dismissed'
        // sakrij dugme dok ne dođe novi event
        deferred.current = null;
      }}
    >
      Instaliraj aplikaciju
    </button>
  );
}
