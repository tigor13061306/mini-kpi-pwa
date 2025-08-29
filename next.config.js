// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: require('next-pwa/cache'),
  fallbacks: { document: '/offline.html' }, // ⬅ offline stranica kad nema mreže
  buildExcludes: [/middleware-manifest\.json$/],
});

module.exports = withPWA({
  reactStrictMode: true,
});
