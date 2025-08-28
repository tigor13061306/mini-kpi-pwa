'use client';
import { useEffect } from 'react';

export default function ThemeColor({
  light = '#0b5ed7',
  dark = '#0b5ed7',
}: { light?: string; dark?: string }) {
  useEffect(() => {
    // osnovni <meta name="theme-color">
    let base = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!base) {
      base = document.createElement('meta');
      base.name = 'theme-color';
      document.head.appendChild(base);
    }
    base.content = light;

    // varijante za light/dark
    const ensure = (media: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[name="theme-color"][media="${media}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.name = 'theme-color';
        el.media = media;
        document.head.appendChild(el);
      }
      el.content = content;
    };
    ensure('(prefers-color-scheme: light)', light);
    ensure('(prefers-color-scheme: dark)', dark);
  }, [light, dark]);

  return null;
}
