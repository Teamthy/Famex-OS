# Ykay College Mobile — Build Log

_Branch `main`. Brand tokens were **not** modified in any session._

---

## Brand decision (standing)

The design brief specified navy `#071126`. The app's real tokens in
`mobile/src/theme/colors.ts` mirror `app/globals.css` exactly — `#050C14`
(`--bg-primary`), `#0C1824` (`--bg-elevated`) — plus a **third brand colour the
brief omits: orange `#FF6E00`** (`--color-brand-orange`), used for secondary
buttons and the accent/CTA gradients.

Per the instruction to stick to `globals.css`, **no colour, font, radius or
spacing token has been changed.** Every new screen composes existing tokens.
Moving navy to `#071126` remains a one-line change in `colors.ts` if wanted.

Scrim gradients in the new screens intentionally echo the web's
`--hero-overlay` and `--gradient-banner` values rather than inventing new ones.

---

## Note: `npx tsc --noEmit` vs stale expo-router types

If a bare `npx tsc --noEmit` in `mobile/` reports errors like

```
Argument of type '"/settings"' is not assignable to parameter of type Href
```

for routes that demonstrably exist and bundle, the cause is **`.expo/types/router.d.ts`**,
not the code. Expo Router's `typedRoutes` experiment generates that file from the
routes present when it last ran; `tsconfig.json` includes it via
`".expo/types/**/*.ts"`. It is gitignored, so a checkout that has run the dev
server before adding routes keeps a **stale** `Href` union that omits the new
screens. `expo export` regenerates its own map, which is why the export lists
all 54 routes while `tsc` complains.

Reproduced by planting a stale file (48 errors) and confirmed fixed by deleting
it (0 errors).

Use **`npm run typecheck`** in `mobile/` — it clears `.expo/types` first:

```json
"typecheck": "node -e \"require('fs').rmSync('.expo/types',{recursive:true,force:true})\" && tsc --noEmit"
```

`npx expo start` regenerates the file correctly on next launch.

---

# Session 3 · 2026-08-02 — Dashboards rebuilt on shared components

## The duplication

All four role dashboards each declared their own near-identical `StatCard` /
`ActionRow` helpers, with widths that had drifted apart (`48%` vs `47%` vs
`flex: 1`) and different type sizes. A metric tile looked subtly different
depending on which portal you were in.

Consolidated into **`src/components/dashboard/`**: `DashboardGreeting`,
`Metric`/`MetricGrid`, `ActionRow`, `SectionHeading`, `ChildSwitcher`,
`InlineError`, `greetingFor()`.

## Four real bugs found while rebuilding

**Parent — siblings were unreachable.** `/api/parent/dashboard` hardcoded
`children[0]` and ignored `?studentId=`, so the child-switcher chips were
decorative: a parent with more than one ward could never see the others. Now
honours `studentId`, resolved with `.find()` over the parent's **own** links —
that scoping is what stops another family's student being addressable by
guessing an id. This is the pattern `/api/parent/fees` already used. The
switcher is now wired and refetches on tap.

**Student — two dead fields.** The screen read `stats.classPosition`, which the
API doesn't return (it lives on `latestReport`), so that tile always showed a
dash. It also rendered a "Today's Schedule" block from `data.timetable` — a
field the dashboard API never returns, and whose own endpoint still returns an
empty schedule by design. Replaced with a real "Latest result" card.

**Teacher — fetched data never shown.** The screen ignored the API's `stats`
object entirely and re-derived a student count in JS. So `pendingCorrections`,
`openGradebooks`, `liveExams` and `todayRegisterDone` were all being fetched and
thrown away. Register status now leads the screen as the one time-boxed task a
teacher owes the school daily.

**All four — silent failures.** Every dashboard used `catch {}`, so a failed
fetch rendered an empty screen indistinguishable from "you have no data". Now an
`InlineError` with retry, plus skeletons on first load.

## Polish

Attendance now reads as a `ProgressRing` on student and parent, colour-thresholded
at the 75% benchmark. Fees lead the parent and admin views as the item with a
deadline. Removed a stray Sign Out button from the student dashboard — it belongs
on Profile, which already has one.

---

# Session 2 · 2026-08-02 — Onboarding wizard + entry-screen redesign

## Reconciled with upstream first

`origin/main` had moved to `d1771bf` ("fix(mobile): push notifications"), which
independently landed **the same four bug fixes** from session 1 (biometric
boolean, `Column` import, `BackHandler`, style-spread) plus new push-tap
routing. Rather than force my copies over it, I reset to upstream, kept only my
genuinely-new files, and re-applied the small edits on top. Upstream's push work
is fully preserved.

## 1. Three-page welcome wizard — `app/onboarding.tsx`

Shown to first-run users, replacing a straight drop onto the login form.

- **Real photography**, not illustration — the same `assets/carousel/` set the
  login screen uses, so first impression and sign-in feel like one product.
  Students → Results, staff → Exams/Attendance, parents → Fees; each photo is
  matched to the promise it illustrates.
- Horizontal paging with a **scroll-linked crossfade** between photos
  (`Animated.event` on `scrollX`), four-stop scrim so text stays legible over
  any frame, tappable dot indicators, haptics on page change.
- **Shown once.** Gated on a persisted `seenOnboarding` flag, so a returning
  user who merely logged out isn't made to swipe through it again. All three
  exits (Continue-on-last, Skip, "Sign in") funnel through one `finish()`
  so the flag can never be missed.

## 2. Login redesign — `app/login.tsx`

- Rebuilt from a centred glass card to a **bottom-anchored form** — thumb-reachable,
  and it lets the photograph breathe at the top where faces are.
- Anton display type for "Welcome back" establishes real hierarchy.
- **Fixed a double-dismissal bug:** a failed login fired a toast *and* an OS
  `Alert` for the same error. Now one inline error slot; auto-clears on edit.
- Added Forgot-password link, password visibility toggle with a11y label,
  `returnKeyType="go"`, autocomplete hints, success/error haptics.

## 3. Landing redesign — `app/landing.tsx`

Was a flat gradient with a 3-slide mini-carousel that duplicated the new wizard.
Now the lighter "returning visitor" surface: one photo carousel, one headline,
three quiet proof-point tiles (Results / Attendance / Fees), one primary action —
plus a "Take the tour" link that re-arms the wizard on demand.

## 4. Entry routing — `app/index.tsx`

Three explicit outcomes: signed in → role dashboard; signed out first run →
wizard; signed out returning → login.

---

# Session 1 — Foundation

## Fixed 26 → 0 TypeScript errors

Four were genuine runtime defects:

| Bug | Impact |
|---|---|
| `Column` used but never imported in `(student)/exams.tsx` | **Student Exams tab crashed on render.** |
| `hasHardwareAsync()`/`isEnrolledAsync()` destructured as objects | Both return **booleans** — **biometric unlock never engaged on any device.** |
| `Card` accepted `onPress` but ignored it | Every "interactive" card was **dead to the touch**. |
| `BackHandler.removeEventListener` | Removed in RN 0.81 — exam-runner cleanup **would throw**. |

Plus: `typography.body` → `typography.fontFamily.body`; object-spread `style`
(which silently dropped array styles) → array composition; `TextArea`'s `style`
typed away by `Omit`; SDK 54 notification-handler keys; `api<T = unknown>` →
`T = any`, fixing 7 call-site errors without touching those screens.

## Design-system components

`StatCard`/`StatGrid`, `ProgressBar`/`ProgressRing` (SVG), `Avatar` (initials
fallback + image-error recovery), `Chip`/`ChipRow`/`SegmentedControl`,
`NotificationRow`, and a barrel `index.ts`. Existing deep imports still work.

## Screens

- **`SplashBrand`** — branded launch on the hero gradient. Also gates on
  `fontsLoaded`, fixing a first-paint fallback-font flash.
- **`forgot-password.tsx`** — backend endpoints existed all along but **mobile
  had no route to them**; a locked-out user was stuck. Mirrors the backend's
  anti-enumeration design (same success state either way).
- **`settings.tsx`** + **`lib/prefs.ts`** — biometric toggle, four notification
  categories, support links, confirmed sign-out. Linked from all four profiles.

---

## Verification (current)

| Check | Result |
|---|---|
| `npx tsc --noEmit` (mobile) | ✅ **0 errors** |
| `npx expo export --platform web` | ✅ **49 routes** bundle |
| `npx tsc --noEmit` (web) | ✅ 0 |
| `npx vitest run` (web) | ✅ **247/247 pass** |
| `npx next build` (web) | ✅ green |
| `npx prettier --check .` | ✅ clean |

## Next up

1. **`reset-password.tsx`** — deep link from the reset email closes the loop
   (`/api/auth/password-reset/confirm` is ready and unused by mobile).
2. **Wire notification preferences to delivery** — `lib/prefs.ts` stores the four
   categories; nothing reads them when dispatching yet.
3. **Empty/error-state audit** on the remaining list screens — the dashboards now
   have skeletons + retry, but `announcements`, `practice` and the admin lists
   still fail quietly.
4. **A student timetable** — the endpoint returns an empty schedule pending a
   `Timetable` model. Either build it or drop the route.
