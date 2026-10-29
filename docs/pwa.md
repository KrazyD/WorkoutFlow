# Progressive Web App

## Build and offline behavior

`vite-plugin-pwa` generates `manifest.webmanifest` and a Workbox service worker
(`sw.js`) during production builds. The manifest uses origin-relative `/` for
its ID, start URL and scope; it supports localhost and any production HTTPS
origin, including a nonstandard HTTPS port. Dark slate `#020617` and lime
`#bef264` match the interface. PNG icons include 192px, 512px, a 512px maskable
icon with its WF monogram inside the safe circle, and a 180px Apple touch icon.
Regenerate them with `python3 scripts/generate-pwa-icons.py`.

The generateSW precache includes HTML, all emitted JavaScript and CSS chunks,
the manifest and local icons. `/index.html` is the navigation fallback for SPA
routes: `/exercises`, `/rest-presets`, `/workouts`, `/workout-session`, and
`/settings/data`. Internal navigation still uses React Router. No CDN, remote
fonts, images, or scripts are required; system fonts and synthesized audio work
locally. There is no API runtime cache, background sync, push, or periodic task.

Wait for “Workout Flow готов к работе без интернета.” on the first online visit
before relying on offline launch. A completed precache provides the application
shell; exercises, rest presets, templates, session transitions, editing and JSON
export continue to use local storage. Initial navigation without a completed
installation cannot work offline. Browsers can evict caches or website data.

Registration runs only in production, in a secure context, with Service Worker
API support. `pnpm dev` does not register a worker. Unsupported browsers retain
the online app. Registration failures show a dismissible notice. A previously
installed production worker may still control localhost; use another port or
unregister it in browser tools when switching to development.

## Update lifecycle and workout protection

The registration API is `registerSW` from `virtual:pwa-register`, with
`registerType: 'prompt'`, `skipWaiting: false`, and `clientsClaim: false`.
There is no injected second registration script. The browser checks on launch;
foreground and online events also call `registration.update()`. Failed network
checks leave the current version available and retry on a later event.

A waiting version displays “Доступна новая версия Workout Flow” with “Обновить”
and “Позже”. Later hides the notice for this run without activating the worker.
A new discovery, app restart, or completion of a workout can offer it again.
There is no automatic activation or reload in application logic.

A separate Dexie live query observes the existing `active` session record,
including changes from other tabs sharing the database. Any session whose
status is not `completed` blocks update confirmation, regardless of route.
Unknown or failed initial database reads remain blocked. During a workout the
notice says the update can be installed after completion and has no Update
button. Successful completion or explicit exit releases the block; failed
persistence does not. Before sending the activation message the controller
re-reads persisted activity. It also uses the plugin's `onNeedReload` callback
to recheck activity before reloading, and requires explicit consent in this tab.
External controller changes do not authorize a reload; after training, a new
confirmation can reload the already activated version. Rejected activation or
no controller change within 15 seconds shows a retryable error.

Browsers own the worker lifecycle and may activate a waiting worker after all
clients close. Closing/killing the app, browser storage eviction, and races
between independent tabs cannot be absolutely prevented. Avoid installing an
update in another tab while training. The existing IndexedDB session recovery
remains the recovery mechanism; PWA support does not alter it.

Cache Storage contains build assets; IndexedDB contains user records. Workbox
cleanup only manages its caches. PWA lifecycle code does not migrate or reset user data. The Dark Glass update
adds optional exercise repetitions and a rest origin to existing records, with
no tables/indexes or backup-version changes. Feedback preferences still use the
same localStorage key. No PWA lifecycle callback clears either user store.

## iPhone installation and timers

In Safari: Share → Add to Home Screen (Safari → Поделиться → На экран Домой).
The app opens in standalone mode with its Apple touch icon. No recurring install
modal is added. Safari and an installed web app can have separate storage
contexts: do not assume Safari data appears on the home screen. Export JSON
before switching, then import it through the existing Data screen if needed.
Keep backups outside browser storage; uninstalling or clearing website data can
remove local records. Origin changes (including port changes) also change
storage scope.

A closed or suspended PWA does not keep JavaScript timers running reliably.
After returning, the existing `restEndsAt` deadline and visibility handling
restore the countdown and complete expired rest. Sound/vibration remain best
effort and are not guaranteed in the background.

## Serving with Caddy (proposal only)

No VPS access or deployment changes are performed. Adapt this fragment inside
the existing site block; `root` is the path **inside the Caddy container**, which
may differ from the host's `/opt/workout-flow/site/` mount source:

```caddyfile
root * /path/inside/container/site

@revalidate path / /index.html /sw.js /manifest.webmanifest /workbox-*.js
header @revalidate Cache-Control "no-cache"

@static path /assets/* /icons/* /sw.js /workbox-*.js /manifest.webmanifest
handle @static {
    file_server
}
handle {
    # Also covers direct online navigation to SPA routes.
    header Cache-Control "no-cache"
    try_files {path} /index.html
    file_server
}
```

`no-cache` allows storage but requires revalidation for fresh HTML, SW and
manifest. Missing static files should return 404, not the SPA document. Check
JavaScript and manifest MIME types and a valid trusted TLS certificate.
Do not put long-lived immutable caching on HTML, the manifest or `sw.js`.
Hashed `/assets/*` files can use immutable caching if deployment retains them.

Publish all new hashed assets and Workbox files before exposing the new
`index.html` and `sw.js`, using staged/atomic publication when available. Retain
previous hashed JS/CSS and `workbox-*.js` files during rollout; an open old client
may request a chunk after new files are published. A blind `rsync --delete`
during an in-place update can break old clients and worker installation. Keep
old files available until clients no longer need them, rather than deleting
them as part of the upload. This is deployment guidance, not a changed script.

## Verification

Run `pnpm check` and `pnpm build`. Unit tests cover manifest and PNG dimensions,
registration gating, offline/update notices, deferral, activity guards,
confirmation and reload consent, error handling, and Dexie lifecycle observation.
Existing session, rest deadline, catalog and backup tests remain regression
coverage. jsdom cannot validate actual worker installation, offline fetches,
iOS installation, browser suspension or storage partitioning.

Use `pnpm exec vite preview --host 127.0.0.1` (localhost is a secure context) or
the deployed HTTPS origin for the following browser checks:

1. Visit online, wait for offline readiness, and inspect Application/Storage for
   the manifest, `/sw.js`, precache entries, and all four PNG icons. Confirm that
   the worker is controlling the page; reload once online if this is the first
   install. Export a JSON backup before testing on real data.
2. Disable networking. Visit every route directly as well as through router
   links. Close and reopen the app offline. Create/edit exercises, rest presets,
   and templates; start a workout, advance, extend/skip rest, finish, and export
   JSON. Check that every operation completes without server requests.
3. Return during a rest after suspending/closing the app. Verify recovery using
   the original deadline, including an already-expired rest. Do not expect
   background sounds or a running background interval.
4. Keep version A open, publish a changed build B in a test environment, then
   return online/foreground. Verify the update notice, choose Later, and confirm
   no reload or activation occurs. In a second run confirm Update and verify
   build B loads with the same catalog data and feedback preferences.
5. Repeat with a running/restored workout and with navigation away from it.
   Confirm no Update button and no reload; after completion/explicit exit the
   pending update must be offered. Test database failure and failed update
   requests; the app must remain usable with a notice. Check another-tab
   activation does not automatically reload a training tab.
6. On a real iPhone, repeat installation, cold offline launch from Home Screen,
   safe-area/icon appearance, rest recovery after lock/unlock, and updates after
   training. Verify Safari-to-standalone data transfer explicitly with JSON
   export/import. Repeat smoke checks in Android Chrome, desktop Chrome, and
   macOS Safari. Browser installation and offline availability are manual
   acceptance checks, not claims established by jsdom tests.

Registration follows the plugin's [prompt update documentation](https://vite-pwa-org.netlify.app/guide/prompt-for-update).
The installed 2.0.0 types and client source also document `onNeedReload`, which
lets the app replace the default reload callback with its consent guard.

## Local verification performed

The implementation was also exercised in a temporary Chromium profile against
a local production server using the preinstalled Playwright runtime (no browser
test dependency or test runner was added to the project):

- A real worker installed and controlled the app; all five routes opened offline.
- Offline exercise create/edit, rest and template creation, workout execution,
  rest extension/skip, automatic rest expiry and JSON download succeeded.
- Closing the tab and reopening `/workout-session` offline recovered the rest.
- A second local build waited during a restored workout with no Update button
  and no reload. Later hid the prompt. Completion reoffered the update; only
  explicit confirmation loaded the new document. The stored exercise and
  completed session survived.

These checks cover Chromium. Real iPhone and Safari acceptance remains manual.


## Dark Glass acceptance additions

At 375, 390 and 430 CSS px, check the three-item dock, expanded active label,
stationary header, content-only scrolling, and full access to the last card
above the plus button. Check both catalog segments and long workout editors.
With the iOS keyboard open, floating controls should disappear and all form
fields and save/cancel actions should remain reachable. After closing the
keyboard or leaving the field, navigation returns.

Repeat in installed standalone mode with safe areas, landscape, large text,
reduced motion, and unsupported backdrop filtering. Verify weight/repetitions
editing and reload, unequal supersets, rest extension and lock/unlock recovery.
The ring is presentation only; use the original deadline for elapsed rest.
Repeat the existing offline-launch and two-version worker-update checks above.
Chromium emulation cannot establish real iOS keyboard, installation, background
suspension, or worker update behavior on an iPhone.

### Dark Glass local verification performed

A disposable bundled Chromium profile exercised the production build at 375,
390 and 430 CSS px. Checks passed for active-only dock labels, accessible
navigation, no horizontal overflow, stationary header, content scrolling and
last-card clearance above the plus. Focused text fields hide floating controls;
settings checkboxes keep navigation available. A 15-block editor saved through
the reduced-motion scroll-to-save action at a 375×440 keyboard-sized viewport.

A superset session retained edited repetitions after reload, and the rest ring
survived extension/reload/skip with correct working-set progress. A real worker
installed and served direct routes offline; the restored session and JSON v2
export (including repetitions) worked offline. A locally changed worker waited
without offering activation during a session, then activated after explicit
exit and confirmation; the catalog remained available. The generated worker
was restored after the test. No server deployment or real browser data changes
were performed. Physical iPhone acceptance above remains manual.

### Dark Glass polish

The viewport now opts into `viewport-fit=cover`, allowing WebKit to expose the
safe-area insets already consumed by the layout. Catalog headers add 8 px of top
clearance. Inspection found no text shadow, filter, mask, overlay, or backdrop
filter on the brand/header; the physical-iPhone report cannot be reproduced or
attributed conclusively in the desktop browser. Brand typography and color are
unchanged, and the header is outside the content animation and scrolling region.

The dock uses `rgba(20, 32, 53, 0.64)`, 18 px backdrop blur and 130% saturation,
including the WebKit prefix. Unsupported browsers keep the opaque `#142035`
background, border and shadow. Navigation SVGs share a 24 px view box and 1.8 px
stroke; the settings contour has six identical radial teeth. The plus uses a
centered 24 px SVG inside the existing 56 px grid button.

View Transitions were considered but not introduced: the current declarative
`BrowserRouter` needs no new router integration or snapshot lifecycle for this
small change. CSS animates only incoming catalog content for 200 ms, from 0.55
opacity and `translateY(6px)` to its resting state. The dock remains mounted;
there are no artificial delays, animation callbacks, or animation-specific
component keys. Route/state/session lifecycle semantics remain unchanged.
`prefers-reduced-motion: reduce` disables both entrance and dock animations.

Local browser checks covered 375, 390 and 430 CSS px, both Builder segments,
active/inactive settings SVG, exact plus centers, no horizontal overflow,
keyboard-sized 375 x 440 viewport, draft cancellation, and browser history.
Unit regressions check actual dock/link identity across rapid route changes,
a single interactive main region, same-route draft preservation and no session
dock. The available browser cannot emulate reduced motion or remove backdrop
support; those fallbacks were inspected in CSS. Real iPhone safe areas, DPR,
keyboard, standalone installation, and animation frame pacing remain manual
acceptance checks; desktop screenshots do not establish those results.
