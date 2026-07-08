const CACHE_NAME = "mead-helper-v4"; // change to next number to indicate new version to software!!!!!

const PRECACHE_URLS = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./fermentation.js",
    "./meadMath.js",
    "./timeDuration.js",
    "./manifest.json",
    "./vendor/chart.umd.js",

    "./help/renderHelp.js",
    "./help/helpContent.js",

    "./gear.png",
    "./apple-touch-icon.png",
    "./mead_calculation_icon.ico",

    "./app-explanation-v1.0.pdf",

    "./help/images/abv-calculator.png",
    "./help/images/databases.png",
    "./help/images/mead-example-output.png",
    "./help/images/mead-recipe.png",
    "./help/images/ph-adjustment.png",
    "./help/images/saved-recipes.png",
    "./help/images/time-between-dates.png"
];

const INDEX_URL = new URL("./index.html", self.registration.scope).toString();

self.addEventListener("install", event => {
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(
                PRECACHE_URLS.map(url =>
                    new Request(new URL(url, self.registration.scope), {
                        cache: "reload"
                    })
                )
            );
        })
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();

            await Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );

            await self.clients.claim();
        })()
    );
});

async function networkFirst(request) {
    const cache = await caches.open(CACHE_NAME);

    try {
        const fresh = await fetch(request);

        if (fresh && fresh.ok) {
            await cache.put(request, fresh.clone());
        }

        return fresh;
    } catch (err) {
        const cached = await caches.match(request);

        if (cached) return cached;

        if (request.mode === "navigate") {
            const offlinePage = await caches.match(INDEX_URL);
            if (offlinePage) return offlinePage;
        }

        throw err;
    }
}

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    const cache = await caches.open(CACHE_NAME);
    const fresh = await fetch(request);

    if (fresh && fresh.ok) {
        await cache.put(request, fresh.clone());
    }

    return fresh;
}

self.addEventListener("fetch", event => {
    const request = event.request;

    if (request.method !== "GET") return;

    const url = new URL(request.url);

    if (url.origin !== self.location.origin) return;

    const isCoreAppFile =
        request.mode === "navigate" ||
        request.destination === "script" ||
        request.destination === "style" ||
        request.destination === "manifest" ||
        /\.(html|js|css|json)$/i.test(url.pathname);

    if (isCoreAppFile) {
        event.respondWith(networkFirst(request));
    } else {
        event.respondWith(cacheFirst(request));
    }
});