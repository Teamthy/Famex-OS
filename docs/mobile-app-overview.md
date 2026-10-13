# Mobile App Overview

## 1. Purpose of the mobile app

The mobile app is intended to extend the Ykay College platform into a native, on-the-go experience for students, parents, teachers, and administrators. It is designed to make core school activities easier from a phone while staying aligned with the web platform and the existing Ykay brand.

The current implementation is an Expo-based React Native app built around Expo Router, role-based navigation, secure sign-in, offline-aware data access, and mobile-first experiences for school activity, payments, attendance, exams, and communication.

---

## 2. What has been implemented

The mobile app is already much more than a scaffold. It includes:

- an Expo Router app structure with role-based entry points,
- a branded landing experience and login flow,
- role-based routing for students, parents, teachers, and admins,
- dedicated dashboard screens for each role,
- exam and practice modules,
- a fee payment flow using a secure checkout experience,
- offline persistence via SQLite with a read cache and queued writes,
- biometric and notification-related utilities,
- and a reusable design system for theming, buttons, cards, typography, and navigation.

### Current architecture highlights
- The app root uses Expo Router with role-specific route groups such as (student), (parent), (teacher), and (admin).
- The shared theme system is centralized under the mobile src/theme layer and is already used across screens.
- Authentication is handled through a shared API layer that connects to the same backend as the web app.
- Offline support is built in through a local cache and write queue, which makes the app more resilient for intermittent connectivity.
- Navigation uses tab-based layouts for the main role-based experiences.

---

## 3. Current product coverage by role

### Students
The student experience already covers:
- dashboard summary,
- attendance viewing,
- report card access,
- exam entry,
- practice tests,
- announcements,
- school teacher contact flow,
- and ID card access.

### Parents
The parent experience already includes:
- dashboard overview,
- attendance monitoring,
- fees and payment flow,
- report card access,
- messages and events,
- and account/profile experience.

### Teachers
The teacher experience already includes:
- dashboard,
- attendance workflows,
- gradebook access,
- student views,
- announcements,
- messages,
- and analytics-related screens.

### Administrators
The admin experience already includes:
- dashboard,
- admissions management,
- students and staff areas,
- fees and finance management,
- reports,
- notifications,
- and news publishing flows.

---

## 4. Design and brand consistency

The mobile app already has a recognizable product identity rooted in the Ykay brand. The current implementation uses:

- a dark, premium visual style with strong green accents,
- consistent typography through Anton for display and DM Sans for body text,
- a shared color palette that mirrors the broader brand direction,
- reusable components for buttons, cards, inputs, headers, and layouts,
- and a role-based visual system that keeps the app feeling connected rather than fragmented.

### Brand direction to preserve
The app should continue to feel:
- premium,
- trustworthy,
- modern,
- calm,
- and educational rather than overly playful or corporate.

The current visual system is already moving in the right direction, but consistency should remain a priority as more screens are added.

---

## 5. What is still left to do

### A. Complete the remaining core workflows
Some flows are present but still need deeper completion and validation. The main gaps are:

- fully wiring every screen to live backend data,
- closing the loop for the remaining role-based workflows,
- and ensuring the app behaves consistently in real school use.

### B. Finish the last data-driven experiences
The exam and practice experience is present, but some areas still need stronger live-data linkage. The backlog also points to the student practice experience as one of the last areas still tied to mock-style data rather than fully live integration.

### C. Push notifications and mobile delivery
The app has notification infrastructure, but push delivery via device tokens is not yet fully wired. This is an important next step because it makes the app feel like a true mobile companion rather than a mobile portal shell.

### D. Reliability, resilience, and release readiness
The next phase should focus on:

- stronger offline sync reliability,
- more robust error handling and retry flows,
- consistent loading, empty, and error states across screens,
- better session recovery and authentication handling,
- build validation for iOS and Android,
- and app-store readiness.

---

## 6. Recommended priorities

### Priority 1 — Complete the student and parent experience
Focus on the most-used journeys first:
- login,
- dashboard,
- attendance,
- report cards,
- fees,
- announcements,
- and exam access.

### Priority 2 — Tighten live data integration
Ensure that screens are consistently backed by the real API layer rather than partial or fallback content.

### Priority 3 — Deliver push notifications and stronger offline flows
These two areas will make the app feel much more complete and useful in everyday use.

### Priority 4 — Preserve product polish and brand consistency
As more screens are built, keep the app visually consistent through shared components, spacing, typography, and interaction patterns.

---

## 7. Executive summary

The mobile app has already progressed well beyond a prototype. It now has a real Expo-based structure, role-based navigation, shared theming, offline support, and a broad set of role-specific screens for students, parents, teachers, and admins. The next phase should focus less on creating the app skeleton and more on completing the experience so it is fully data-driven, robust, and production-ready while staying visually consistent with the Ykay College brand.
