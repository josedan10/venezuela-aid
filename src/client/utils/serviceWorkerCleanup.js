/**
 * This app does not use a service worker. Stale registrations from prior
 * experiments (e.g. firebase-messaging-sw.js) can intercept Next.js HMR
 * postMessage traffic and flood the console with "[SW] Message received".
 */
export function unregisterStaleServiceWorkers() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister().catch(() => {});
    });
  }).catch(() => {});
}
