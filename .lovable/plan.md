
# Family Chore & Task Manager — v1

A custom family management app starting with chores & tasks. You sign in as parent, your two kids sign in with Google, and you assign tasks/chores with flexible recurrence. Kids check off completions (with a celebration animation), and you verify or reject them.

## Scope (v1)

In: Google sign-in, parent-pre-registers kids by email, create/assign tasks, recurrence (daily / weekly-by-weekday / monthly / custom interval), kid checkoff with celebration, parent verification (approve/reject with note), separate parent vs kid dashboards.

Out (future tiers): rewards/points, calendar/notifications, multiple parents, messaging, photo proof.

## Visual direction

Bold, game-inspired (Candy Crush / Fortnite energy) but mature enough for 15–16 year-olds — no childish cartoons. Dark base with vivid neon/candy accent gradients (electric purple, hot pink, cyan, lime), chunky rounded cards, glossy buttons, satisfying micro-interactions. Celebration on completion = burst of confetti + scaling check + short upbeat message ("Nice!", "Crushed it!", "+1 streak"), via framer-motion. No emoji-only smiley; styled icon + animated badge.

## Backend (Lovable Cloud)

Enable Lovable Cloud. Use Google auth provider.

Tables:
- `profiles` (id → auth.users, display_name, avatar_url, role: 'parent'|'kid', family_id, created_at)
- `families` (id, name, created_by)
- `family_invites` (id, family_id, email, role, claimed_at) — parent pre-registers kids' Google emails; on first sign-in a trigger links the new auth user to the family with role 'kid'
- `tasks` (id, family_id, assignee_id, created_by, title, description, recurrence_type: 'once'|'daily'|'weekly'|'monthly'|'custom', recurrence_config jsonb {weekdays?, day_of_month?, interval_days?}, start_date, end_date, active)
- `task_instances` (id, task_id, assignee_id, family_id, due_date, status: 'pending'|'submitted'|'approved'|'rejected', completed_at, verified_at, verifier_id, reject_note) — one row per occurrence; generated lazily for the visible window
- `user_roles` (separate table; `app_role` enum 'parent'|'kid'; `has_role()` security-definer fn) — used by all RLS policies

RLS: members can read rows where `family_id` matches their profile's family; kids can update only their own `task_instances` from pending→submitted; parents can update verification fields and CRUD tasks. Grants for `authenticated` + `service_role` per public-schema rule.

Server functions (TanStack `createServerFn`, all behind `requireSupabaseAuth`):
- `inviteKid({email, displayName})` — parent only
- `createTask(...)`, `updateTask`, `deactivateTask` — parent only
- `listMyInstances({from, to})` — returns instances for the signed-in kid; lazily materializes upcoming occurrences from recurrence config
- `listFamilyInstances({from, to, status?})` — parent dashboard
- `submitInstance({instanceId})` — kid marks complete
- `verifyInstance({instanceId, decision, note?})` — parent approve/reject

## Routes

Public: `/`, `/auth`
Protected (`_authenticated/`):
- `/dashboard` — role-aware: parent sees family overview + pending verifications; kid sees today + upcoming
- `/tasks` — parent: list/create/edit tasks & recurrence; kid: read-only assigned list
- `/tasks/new`, `/tasks/$taskId/edit` — parent
- `/verify` — parent queue of submitted instances
- `/family` — parent: invite kids by email, see linked accounts

## Key UX details

- Kid card: large checkbox, title, due chip. On check → optimistic update, confetti + scale/spring animation, toast "Sent to Dad for review".
- Parent verify card: kid avatar, task title, completed time, Approve / Reject (+ note dialog) buttons.
- Recurrence editor: segmented control (Once / Daily / Weekly / Monthly / Custom) with conditional inputs (weekday picker, day-of-month, interval N days).

## Technical notes

- Stack: TanStack Start + Lovable Cloud (Supabase under the hood), Tailwind v4 design tokens in `src/styles.css`, shadcn/ui, framer-motion, canvas-confetti.
- Auth: Google via `lovable.auth.signInWithOAuth("google", ...)`; enable Google provider on Cloud. Managed `_authenticated/route.tsx` gate.
- Recurrence: store as structured jsonb; expand on read in server fn for the requested date window (no cron needed v1).
- Validation: Zod on every server fn input (title length, valid recurrence config, etc.).
- Realtime (optional polish): subscribe parent dashboard to `task_instances` inserts/updates so kid checkoffs appear instantly.

## Build order

1. Enable Cloud + Google auth, design tokens & base layout
2. Schema + RLS + roles + invite-on-signup trigger
3. Family/invite UI (parent)
4. Task CRUD + recurrence editor
5. Kid dashboard + checkoff + celebration animation
6. Parent verify queue + approve/reject
7. Polish: realtime, empty states, streak chip

Ready to build on approval.
