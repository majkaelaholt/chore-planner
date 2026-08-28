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

Open **Settings → Supabase sync** and paste:

- Project URL
- Publishable / anon key
- A household sync ID, e.g. `mak-household`

Then use:

- **Push backup** to save the current app state to Supabase
- **Pull backup** to replace the current local state with the saved cloud state

## Security note

This starter schema is deliberately simple for a personal prototype and permits anonymous access to rows if someone knows the project endpoint and row ID. For a public/shared production app, add Supabase Auth and user-scoped RLS policies before storing sensitive data.
