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
