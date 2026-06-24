## What’s actually happening

Your app is serving locally, but the Lovable editor preview is showing its own error boundary (`This page didn't load`). The dev logs show the previous custom port conflict was real and has been removed. The remaining visible signal is the preview/HMR WebSocket connection failing in the editor shell, which can keep the preview iframe stuck even when the app responds directly.

## Plan

1. **Confirm the failing surface**
   - Inspect the latest preview console/network logs for the editor iframe, not only `localhost`.
   - Check whether the error is still only the Vite HMR WebSocket or whether a fresh runtime route error appears after restart.

2. **Apply a preview-safe Vite config**
   - Keep Lovable’s required sandbox-managed port/host behavior.
   - Add only the minimal `server.hmr` settings needed for proxied preview WebSocket connections if the logs still show HMR targeting the wrong host/port.
   - Avoid changing app routes, CORS, auth, or fetch behavior unless the logs prove they are involved.

3. **Verify in the right places**
   - Restart the dev server after the config change.
   - Verify `localhost:8080` still renders.
   - Re-check the current preview console/network signals for disappearance of the WebSocket/runtime error.

4. **Fallback if the editor shell is cached/broken**
   - If the app is clean but the editor preview still shows the same shell error, add a temporary lightweight diagnostic route/page so the iframe can be tested without app data loaders or auth initialization.
   - If diagnostics load but `/` does not, isolate the homepage loader/root `beforeLoad`; if diagnostics also fail, it is a preview-shell/proxy issue.

## Technical notes

- I will not edit `src/routeTree.gen.ts`; it is generated.
- I will not add broad CORS changes or override `window.fetch`.
- The likely code area is `vite.config.ts`; secondary suspects are root route initialization in `src/routes/__root.tsx` and the homepage loader in `src/routes/index.tsx` only if fresh runtime logs point there.