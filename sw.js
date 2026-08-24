const CACHE_NAME = 'loksewa-prep-v2';
const STATIC_CACHE = 'loksewa-static-v2';
const DYNAMIC_CACHE = 'loksewa-dynamic-v2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.html',
  '/manifest.json',
  '/site.webmanifest',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap',
  'https://fonts.gstatic.com/s/outfit/v13/QGYsz_wNahGAdqQ43Rh_fKDptfpSamCg6Xw.woff2',
  'https://fonts.gstatic.com/s/plusjakartasans/v10/0yBmD-ODR1U3e8dsLxWd_XGrV4x0jYQ.woff2',
  'https://fonts.gstatic.com/s/jetbrainsmono/v23/tDbD2oWUg0MKZWlmuW2YjG8Pd0g.woff2',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js',
  'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
  'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js',
  'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
];

const QUESTION_ASSETS = [
  'questions/civil_service_act_and_regulation.json',
  'questions/concrete_technology.json',
  'questions/constitution_of_nepal.json',
  'questions/construction_management.json',
  'questions/construction_materials.json',
  'questions/current_affairs.json',
  'questions/current_periodical_plan_of_nepal.json',
  'questions/economic_aspects_of_nepal.json',
  'questions/engineering_drawing.json',
  'questions/engineering_economics.json',
  'questions/engineering_professional_practice.json',
  'questions/estimation.json',
  'questions/functional_scope_of_public_services.json',
  'questions/fundamentals_of_management.json',
  'questions/geographical_diversity_climatic_condition_and_cultures.json',
  'questions/geography_of_nepal.json',
  'questions/geotechnical.json',
  'questions/governance_system_and_government.json',
  'questions/government_budgeting_and_accounting.json',
  'questions/major_natural_resources.json',
  'questions/modern_history_of_nepal.json',
  'questions/public_policy.json',
  'questions/public_service_charter.json',
  'questions/structural_engineering.json',
  'questions/surveying.json',
  'questions/sustainable_development_science_and_technology.json',
  'questions/uno_saarc_and_bimstec.json',
];

async function installSW() {
  const staticCache = await caches.open(STATIC_CACHE);
  const dynamicCache = await caches.open(DYNAMIC_CACHE);

  await Promise.allSettled(
    STATIC_ASSETS.map(url => staticCache.add(url).catch(() => {}))
  );

  await Promise.allSettled(
    QUESTION_ASSETS.map(url => dynamicCache.add(url).catch(() => {}))
  );

  await self.skipWaiting();
}

async function activateSW() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
      .map(name => caches.delete(name))
  );
  await self.clients.claim();
}

async function fetchHandler(event) {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return fetch(request);

  if (url.origin === location.origin) {
    if (url.pathname.endsWith('.json') || url.pathname.includes('/questions/')) {
      event.respondWith(networkFirstThenCache(request, DYNAMIC_CACHE));
      return;
    }
    event.respondWith(cacheFirstThenNetwork(request, STATIC_CACHE));
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  if (url.hostname === 'cdn.tailwindcss.com' || url.hostname === 'unpkg.com' || 
      url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'www.gstatic.com') {
    event.respondWith(cacheFirstThenNetwork(request, DYNAMIC_CACHE));
    return;
  }

  event.respondWith(networkFirstThenCache(request, DYNAMIC_CACHE));
}

async function cacheFirstThenNetwork(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirstThenCache(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || fetchPromise;
}

self.addEventListener('install', event => {
  event.waitUntil(installSW());
});

self.addEventListener('activate', event => {
  event.waitUntil(activateSW());
});

self.addEventListener('fetch', event => {
  fetchHandler(event);
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  if (event.data === 'clearCache') {
    caches.keys().then(names => 
      Promise.all(names.map(name => caches.delete(name)))
    ).then(() => event.ports[0]?.postMessage({ success: true }));
  }
});

console.log('[SW] Loksewa Prep Pro Service Worker loaded');