const CACHE_NAME = "mead-helper-v2";

const FILES_TO_CACHE = [
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
    "./mead_calculation_icon.ico"

    // Add your help images here too:
    // "./help/images/mead-recipe.png",
    // "./help/images/abv-calculator.png",
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        )
    );
});

self.addEventListener("fetch", event => {
    event.respondWith(
        caches.match(event.request).then(cached => {
            return cached || fetch(event.request);
        })
    );
});