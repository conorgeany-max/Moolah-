# Forge

A private, offline-first training app for calisthenics, running and outdoor conditioning. It needs no equipment and no account, and everything stays on your phone.

Built with React, TypeScript, Vite and Tailwind CSS. Data is stored in IndexedDB. A small hand-written service worker makes the app work offline once installed.

## What it does

- **Onboarding** (every question can be skipped or edited later) builds an 8 to 12 week programme from your schedule, experience, running level, goals, training spaces and injuries.
- **Today**: a "what should I do today?" dashboard. It has a one-tap start, a duration estimate and the week's plan. It also offers 10, 20 or 30-minute versions, lighter, no-equipment and swap options, a readiness check-in, catching up a missed session, and suggesting a deload.
- **Workout player**:
  - set logging with large controls, plus a rest timer you can pause, skip, reset and extend
  - hold timers, effort and technique prompts, substitutions and an "it hurts" path
  - notes, pause and resume, and end early
  - survives refreshes and app restarts, and finishes with a summary that shows genuine personal records
- **Progression engine**: rule-based double progression. Reps and holds rise inside a range, and harder variations are suggested only after enough sessions with good effort. Variations step back when you struggle, deload weeks reduce volume, and hard days are never put back to back when you rearrange.
- **Running**:
  - run/walk stages, then easy, long, interval, tempo and hill sessions
  - running volume and intensity never increase in the same week
  - GPS tracking while the screen is on, or a timer-only mode, plus manual logging
  - splits, pace trends, weekly distance and records
- **Progress**: consistency, frequency and working sets, a strength level history per movement, running charts and milestones. There are no streaks.
- **Library**: about 100 exercises with animated diagrams, steps, cues, breathing, mistakes, safety notes and progression pathways, plus eight mobility routines.
- **Other features**:
  - a workout generator
  - a calendar and history with filters and repeat
  - optional body measurements, and private progress photos that are never exported
  - Calendar-app reminders
  - JSON and CSV export, JSON import, and full delete
  - dark and light themes, larger text, reduced motion, and an outdoor high-contrast mode

## Run it locally

You need Node.js 20 or newer.

```bash
cd fitness
npm install
npm run dev          # development server at http://localhost:5173
```

Other scripts:

```bash
npm run typecheck    # TypeScript, strict mode
npm run lint         # ESLint
npm test             # engine unit tests (Vitest)
npm run build        # production build into dist/
npm run preview      # serve the production build (service worker enabled)
npm run icons        # re-render PNG icons (needs the playwright package; output is committed)
```

The service worker is only registered in production builds (`build` then `preview`, or any static host), not in `npm run dev`.

## Put it on your iPhone

iOS only allows a service worker (offline mode) and GPS on **HTTPS** pages, or on `localhost`. A plain `http://192.168.x.x` address from your computer will open and work while connected, but it won't work offline and the GPS run tracker will be blocked. There are two routes.

### Option A: host it on HTTPS (recommended, about 2 minutes)

The build is a static folder with relative paths, so it works on any static host and in any sub-folder.

1. Run `npm run build`.
2. Upload the `fitness/dist` folder to a static host. For example, drag it onto [Netlify Drop](https://app.netlify.com/drop), or use Cloudflare Pages, GitHub Pages or Vercel.
3. On your iPhone, open the HTTPS address in **Safari**.
4. Tap **Share**, then **Add to Home Screen**, then **Add**.
5. Open Forge from the Home Screen icon once while online. After that it works offline.

Your data lives on the phone, not on the host. The host only serves the app's files.

### Option B: test over your Wi-Fi

```bash
npm run build
npm run preview -- --host
```

Vite prints a `Network:` address such as `http://192.168.1.20:4173`. Open it in Safari on an iPhone on the same Wi-Fi. Everything except offline mode and GPS works this way. For GPS on the local network you need HTTPS, for example a tunnelling tool or a local certificate.

### Updating

When a new version is deployed, Forge shows "A new version is ready" with an **Update** button. Updates are never applied in the middle of a workout or run.

## Honest limitations

- **GPS on iPhone:** web apps only receive location while the app is on screen. If the phone locks or you switch apps, tracking pauses and that gap is not counted. Forge never invents distance. Keep the screen on (Forge requests a screen wake lock), or log the run manually afterwards.
- **Pulling without a bar:** floor exercises train the upper back but can't replace pull-ups. Bar movements are only programmed if you say you have a secure outdoor bar. Forge never suggests pulling on doors or furniture.
- **Notifications:** web push needs a server, and Forge has none by design. Reminders are exported as a repeating `.ics` calendar file instead (Settings, then Reminders).
- **Vibration:** Safari doesn't support the Vibration API, so timers use sound and visual cues.
- **Calories:** none are shown, because estimates without heart-rate data are too inaccurate to be honest.
- **Storage:** data is kept in Safari's storage for this app. Deleting website data, or removing the Home Screen app, deletes it. Export a backup now and then (Profile, then Your data).

## Data and privacy

- No account, analytics, ads, third-party scripts or fonts. The only network requests are for the app's own files.
- Location is used only during a run you start, and is stored only on the device.
- **Export format:** one JSON document, `{"format": "forge-export", "version": 1, ...}`. It contains `profile`, `settings`, `programme`, `workouts` (every set), `runs` (with GPS points), `checkIns`, `measurements`, `recommendations` and `customExercises`. Values are always metric: kg, cm, metres and milliseconds. Progress photos are never exported. See `src/lib/portability.ts`.
- CSV exports give one row per logged set (workouts) or one row per run.

## Project layout

```
src/
  data/        exercise library, progression tracks, mobility routines, running stages
  engine/      programme builder, scheduling, progression, running, records, stats (pure, unit-tested)
  lib/         storage (IndexedDB), store, actions, routing, units, import/export, service worker
  components/  design system (ui.tsx), charts, exercise diagrams, layout
  screens/     one file per screen
  sw-template.js  service worker; the build injects the precache list and version
```

## Safety

Forge provides general fitness information, not medical advice. Check with a health professional before starting if you have a medical condition, an injury, or are pregnant. Training effort (breathing hard, muscle burn) is expected. Sharp, joint or worsening pain is a signal to stop.
