# Household — calm chore planner

A desktop + iPhone-friendly PWA for recurring household chores. The main goal is not to maximize productivity; it is to make the stopping point obvious.

## What it does

- **Today view** only shows chores that belong to today and celebrates when the day is handled.
- **Weekly planner** auto-distributes due chores across their due date + grace window, then supports drag-and-drop rearranging.
- **Grace windows by importance** keep low-stakes chores from becoming fake emergencies.
- **Mak / Ty / Either assignments** with automatic splitting for “Either” chores. If one person did a chore last time, the app prefers the other person next time.
- **Recurring + one-off chores** in the same weekly planner.
- **Fixed, completion-based, or ask-each-time recurrence** behavior.
- **Carry-forward logic** moves missed chores to today while preserving the original due date.
- **Extra Energy mode** reveals at most three optional suggestions only when you intentionally ask for more.
- **History** records who completed each chore and when.
- **Local-first storage** plus JSON export/import.
- **Optional Supabase backup** using a single JSON row.
- Installable as a **PWA** on iPhone/desktop.

## GitHub Pages

This project has no build step.

1. Create a GitHub repository.
2. Upload the contents of this folder to the repo root.
3. In GitHub: **Settings → Pages**.
4. Set source to **Deploy from a branch** and choose `main` / root.
5. Open the Pages URL in Safari on iPhone and use **Share → Add to Home Screen**.

## Files

- `index.html` — app layout and dialogs
- `styles.css` — responsive desktop/mobile styling
- `app.js` — scheduling, recurrence, history, local storage, and Supabase sync
- `manifest.webmanifest` — PWA metadata
- `service-worker.js` — basic offline cache
- `icons/` — app icons
- `SUPABASE_SETUP.md` — optional cloud backup instructions

## Scheduling model

Every recurring chore has:

- a target recurrence (for example every 7 days)
- an importance level
- a grace window based on importance
- a default assignee
- a schedule behavior

The weekly planner will **never pull a future chore earlier than its due date just to fill an empty day**. It chooses the least-busy day between the due date and the end of its grace window. If the chore is already overdue when the week begins, it lands on the first available day while retaining its original due date.

## Default chore library

The built-in defaults are Mak + Ty's household chore list. All recurring chores default to **Either** so the weekly planner can distribute them between Mak and Ty. Resetting to defaults restores this library while preserving app settings and Supabase credentials.

The starter schedule does **not** fabricate completion history. It seeds first due dates across sensible upcoming days; once a chore is completed, its normal recurrence takes over.

## v1.2
- Replaced all sample chores with Mak + Ty's 23 household chores.
- Added estimated recurrence, category, importance, and schedule behavior defaults.
- All default recurring chores are assigned to **Either**.
- Reset now restores the household default chore library while preserving app/Supabase settings.
- Removed fabricated starter completion dates; default chores begin with `Never` as their last completion.
- Bumped the PWA cache to `household-v1-2`.

## v1.1
- Hardened Supabase push/pull backup handling.
- Push now verifies the backup row before reporting success.
- Pull handles a missing sync ID gracefully instead of using a strict single-row coercion.
- Bumped the PWA cache so GitHub Pages/mobile installs receive the updated JavaScript.
