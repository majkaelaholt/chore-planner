# Optional Supabase backup setup

The app works without Supabase. Local storage is the primary store. Supabase is used as a simple manual cloud backup/restore so the static GitHub Pages app stays easy to maintain.

## 1. Create a table

In Supabase SQL Editor, run:

```sql
create table if not exists public.household_state (
  id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.household_state enable row level security;

create policy "allow household state read"
on public.household_state
for select
to anon
using (true);

create policy "allow household state insert"
on public.household_state
for insert
to anon
with check (true);

create policy "allow household state update"
on public.household_state
for update
to anon
using (true)
with check (true);
```

## 2. Add your credentials in the app

Open **Settings → Supabase auto-save** and paste:

- Project URL
- Publishable / anon key
- A household sync ID, e.g. `mak-household`

For an existing install, use **Push now** once on the device whose current data you want to keep, then **Pull now** once on the other device. After that, leave **Automatically sync changes** enabled and normal edits will sync without manual backup steps.

## Security note

This starter schema is deliberately simple for a personal prototype and permits anonymous access to rows if someone knows the project endpoint and row ID. For a public/shared production app, add Supabase Auth and user-scoped RLS policies before storing sensitive data.


## Automatic sync (v1.27+)

Once the Project URL, publishable/anon key, and Household Sync ID are saved, **Automatically sync changes** can stay enabled. Household always saves locally first, then sends a debounced cloud save to the same `household_state` row. It also checks for newer cloud data on launch/focus/online.

On the first v1.27 launch of an existing device, if its local data does not match the cloud and the app has no previous sync marker, choose **Push now** on the device whose current data you want to keep, then **Pull now** on the other device. After that, automatic sync tracks the common baseline. If both devices later change independently before seeing each other's updates, auto-sync pauses rather than overwriting either copy.

### Reliability improvements in v1.28+

Automatic sync now keeps a pending local change queued if another cloud request is already running, retries transient failures automatically, checks the cloud periodically while the app is visible, and makes a best-effort keepalive save when the PWA is backgrounded. This is intended to make manual **Push now / Pull now** exceptional rather than part of normal use.

A manual choice is still intentionally required if two devices genuinely edit different copies before either device has seen the other's update. That is a real conflict, so Household will not guess which copy should win.

### Multi-device revision safety (v1.29+)

Household can use the same sync ID from a work PC, home PC, iPhone, or additional devices. No database migration is needed: the app stores a small `__sync` envelope inside the existing `state` JSON containing a revision number and the device that last wrote it.

Each device also keeps its own local device ID and optional friendly name. In **Settings → Supabase auto-save**, name devices something recognizable such as **Work PC**, **Home PC**, and **iPhone**. This name stays local as a setting and is only copied into that device's cloud write metadata.

Normal automatic writes are conditional on the exact cloud `updated_at` value the device just read. That acts as an optimistic lock: if another device updates the row first, the stale write affects zero rows and Household re-checks the newer cloud revision instead of overwriting it. Foreground devices re-check roughly every 12 seconds in addition to launch, focus, visibility, and online events.

The mobile app shows a compact sync pill at the top with the latest successful sync time. Settings also shows the current cloud revision and which named device last wrote it.

If two different devices genuinely make independent changes before either sees the other, Household still pauses rather than guessing how to merge those edits. Use **Push now** to keep the current device's copy or **Pull now** to accept the cloud copy once; automatic revision tracking resumes afterward.
