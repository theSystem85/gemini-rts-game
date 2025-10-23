const CACHE_NAME = 'gemini-rts-cache-v1'
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/cursors.css',
  '/site.webmanifest'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
    )).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  if (request.method !== 'GET') {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        const copy = response.clone()
        caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy))
        return response
      }).catch(() => caches.match('/index.html'))
    )
    return
  }

  const url = new URL(request.url)

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async(cache) => {
        const cached = await cache.match(request)
        if (cached) {
          return cached
        }

        try {
          const response = await fetch(request)
          cache.put(request, response.clone())
          return response
        } catch (err) {
          return cached || Promise.reject(err)
        }
      })
    )
  }
})
