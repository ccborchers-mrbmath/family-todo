## Kinquest Notifications

Add real push notifications so parents and kids get alerted about important activity — even when the app is closed — plus subtler in-app pings when the app is already open. Uses the device's default notification sound and Kinquest's app icon/badge.

### What you (the human) need to do once, up front

Push on the web is only allowed by browsers if we route it through **Firebase Cloud Messaging (FCM)** — this is Google's rule for Chrome/Android, not ours. FCM is free.

1. Create a free Firebase project at `console.firebase.google.com` (name it "Kinquest").
2. In that project: **Project settings → Cloud Messaging** → generate a **Web Push certificate (VAPID key)**.
3. **Project settings → Service accounts** → generate a **private key** (downloads a JSON file).
4. Paste four values into Kinquest secrets when I ask:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY` (from the JSON)
   - `VITE_FIREBASE_VAPID_KEY` (the Web Push certificate — safe to expose)

I'll walk you through where each value lives when we get there.

### What each user will experience

**First time they open Kinquest after this ships**

- A friendly banner: "Turn on notifications so you don't miss tasks, rewards and messages" with an **Enable** button and a **Not now** link. No auto-prompt — Chrome penalises apps that ask without a user click.
- Tapping **Enable** shows the browser's permission dialog.
- iPhone users see extra help: "To get notifications on iPhone, tap the share icon and **Add to Home Screen** first, then open Kinquest from the icon."

**Once enabled**

- **App closed / phone locked** → notification appears in the tray, plays the device's default sound, shows the Kinquest icon, updates the app-icon badge count. Tapping it opens Kinquest straight to the relevant page (e.g. the task to verify).
- **App open** → no OS notification; instead a small toast slides in with a soft chime and updates a bell icon in the top bar with an unread count.

**Notification wording**

- Kid completes a task → parent gets: *"Siya finished 'Tidy room' — tap to verify"*
- Parent verifies / rewards / sends back → kid gets: *"Dad approved 'Tidy room' 🎉 R10 added"* or *"Dad sent 'Tidy room' back — tap to redo"*
- New encouragement post → kid gets: *"New message from Dad ❤️"*
- Kid asks to spend → parent gets: *"Siya wants to spend R25 — tap to approve"*

### Settings

A new **Notifications** section on the Family page lets each user:
- See which devices are registered (e.g. "iPhone 15 — Safari, added 2 days ago") and remove old ones.
- Toggle each event type on/off per user (so a kid can mute encouragement pings but keep task alerts, etc.).
- A master **Pause all notifications** switch.

### iPhone / Android specifics

- **Android**: works in any Chrome-based browser once the user grants permission. Installing to home screen is optional but recommended.
- **iPhone/iPad**: Apple *requires* the app to be **Added to Home Screen** first — push does not work in a regular Safari tab. We'll detect iOS and show clear one-time instructions with a screenshot.
- **Desktop**: works in Chrome, Edge, Firefox on Windows/Mac/Linux out of the box.

### Sound

Uses the **device's default notification sound** for push (respects Do Not Disturb, per-app volume, silent mode — no surprises). In-app toasts use a short soft chime that can be muted in settings.

### What we won't be able to do (browser/Apple limits)

- Cannot force a notification if the user declined permission.
- Cannot deliver push to iPhone Safari users who haven't Added to Home Screen (Apple's rule).
- Notification sound on Android/iOS push is controlled by the OS — we can't play a custom melody there. Custom sounds only work for in-app toasts.
- Notifications cannot open modals or run code beyond opening a page.

---

## Technical section (for reference)

**Stack additions**
- `firebase` (client, for `getMessaging` / `getToken` / `onMessage`).
- `firebase-admin` (server, called from a TanStack `createServerFn` to send push).
- A dedicated `public/firebase-messaging-sw.js` service worker (allowed by the PWA rules as a messaging worker; separate from any app-shell worker and unaffected by preview guards).

**Database (new tables via migration)**
```
push_devices
  id, user_id, family_id, fcm_token (unique), platform, user_agent,
  last_seen_at, created_at

notification_prefs
  user_id (pk), task_events bool, reward_events bool,
  encouragement_events bool, spend_events bool, paused bool
```
RLS: user can read/write only their own rows. Parents can read `push_devices.user_id` for kids in their family (for the "which devices are registered" view). GRANTs added in the same migration.

**Notification triggers (server side)**
- All events are already state changes in existing tables (`task_instances.status`, `account_transactions` insert, `encouragement_messages` insert, expense-request insert). Add a shared `send_push(user_id, payload)` server helper that:
  1. Reads recipient's `notification_prefs`, bails if paused/disabled for that event type.
  2. Loads all `fcm_token`s for that user.
  3. Sends via `firebase-admin` `messaging().sendEachForMulticast`.
  4. Prunes tokens that come back as `unregistered`/`invalid`.
- Trigger sites:
  - `task_instances` status → `pending_verification`: notify all parents in family.
  - `task_instances` status → `approved` / `rejected`: notify assignee kid (approved message includes reward amount if any).
  - `encouragement_messages` insert: notify the target child.
  - Expense request insert (existing "Ask to spend" path): notify all parents.
- Kept as post-write calls inside the existing server functions (not DB triggers) so we can use the Node `firebase-admin` SDK.

**Client wiring**
- New `src/lib/push.ts`:
  - `initPush()` — registers `firebase-messaging-sw.js`, calls `getToken({ vapidKey })`, upserts into `push_devices`.
  - `onForegroundMessage()` — feeds foreground pushes into an in-app toast + bell/unread store.
- A `<NotificationPrompt />` banner on the authenticated shell that appears only when `Notification.permission === "default"` and the user hasn't dismissed it.
- iOS detection (`/iP(hone|ad|od)/`) + not-standalone → show "Add to Home Screen first" instructions instead of the enable button.
- Bell icon in the top bar with an unread badge, backed by a lightweight `notifications_seen` table or local storage (small design choice, decide during build).

**Service worker**
- `public/firebase-messaging-sw.js` — minimal Firebase Messaging worker; handles `notificationclick` to `clients.openWindow(payload.data.url)` so tapping a push deep-links into the right page. This worker is exempt from Kinquest's PWA preview guards (it's a messaging worker, not an app-shell cache).

**Secrets to add (I'll request when we start)**
- `FIREBASE_PROJECT_ID` (runtime)
- `FIREBASE_CLIENT_EMAIL` (runtime)
- `FIREBASE_PRIVATE_KEY` (runtime)
- `VITE_FIREBASE_VAPID_KEY` (runtime, exposed to client — safe, VAPID public key)
- Firebase web-app config values (`apiKey`, `authDomain`, `messagingSenderId`, `appId`) — also client-safe, either as `VITE_` env or a small JSON constant.

**Rollout order when implementing**
1. Migration for `push_devices` + `notification_prefs` + RLS + GRANTs.
2. Add Firebase config & secrets, install `firebase` + `firebase-admin`.
3. Client: service worker, `initPush`, permission banner, bell/toast.
4. Server: `send_push` helper + wire into the four event sites.
5. Notifications settings UI on Family page.
6. iPhone Add-to-Home-Screen guidance + testing on real Android + iOS PWA + desktop.

### Estimated scope

Around a day of build work end-to-end, with most of it in the server-side push helper, permission UX and cross-device testing.
