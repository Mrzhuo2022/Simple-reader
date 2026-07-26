// Entry point: fill the renderer-side settings cache with a single async IPC
// round-trip, then load the app. The dynamic import guarantees that no module
// that reads settings at load time (reducer initial state, FeedFilter, ...)
// executes before the cache is ready.
window.settings
    .prefetch()
    .then(() => import(/* webpackMode: "eager" */ "./app"))
    .then(({ bootstrap }) => bootstrap())
    .catch(e => console.error("Startup failed:", e))
