const CACHE_NAME = "mead-helper-v6"; // change to next number to indicate new version to software!!!!!

const PRECACHE_URLS = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./theme.js",
    "./backup.js",
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

// ./backup.js to the existing PRECACHE_URLS list. Keep all existing assets.
const INDEX_URL = new URL("./index.html", self.registration.scope).toString();

self.addEventListener("install", event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(
        PRECACHE_URLS.map(url => new Request(new URL(url, self.registration.scope), { cache: "reload" }))
    )));
});

self.addEventListener("message", event => {
    if (event.data?.type === "SKIP_WAITING") event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names.filter(name => name.startsWith("mead-helper-") && name !== CACHE_NAME).map(name => caches.delete(name)));
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", event => {
    const request = event.request;
    if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
            const index = await cache.match(INDEX_URL);
            if (index) return index;
        }
        return fetch(request);
    })());
});