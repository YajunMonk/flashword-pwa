// 闪电单词 Service Worker - 离线缓存
const CACHE_NAME = 'flashword-v2';

// 需要缓存的本地资源
const PRECACHE_URLS = [
  './word-collector.html',
  './words.js'
];

// 安装：预缓存本地文件
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// 激活：清理旧版本缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// 拦截请求：本地文件走缓存优先，外部 API 走网络优先
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 外部 API 请求（翻译、词典、发音）走网络，失败就失败，不缓存
  const externalHosts = [
    'api.mymemory.translated.net',
    'api.dictionaryapi.dev',
    'dict.youdao.com',
    'ark.cn-beijing.volces.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdn.jsdelivr.net'
  ];

  if (externalHosts.some(h => url.hostname.includes(h))) {
    // 外部资源：网络优先，Tesseract/字体也缓存一份（首次加载后离线可用）
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // 缓存字体和 Tesseract.js（体积大但离线必需）
          if (
            url.hostname.includes('fonts.gstatic.com') ||
            url.hostname.includes('cdn.jsdelivr.net')
          ) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // 网络失败时尝试从缓存取
          return caches.match(event.request);
        })
    );
    return;
  }

  // 本地资源：缓存优先，缓存没有再走网络
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        // 缓存新资源
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      });
    })
  );
});
