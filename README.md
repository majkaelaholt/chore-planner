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

## Important note about auto-planning

The supplied starter data is only sample household data. Edit/delete it and build your real chore library from the Chores page.


## v1.1
- Hardened Supabase push/pull backup handling.
- Push now verifies the backup row before reporting success.
- Pull handles a missing sync ID gracefully instead of using a strict single-row coercion.
- Bumped the PWA cache so GitHub Pages/mobile installs receive the updated JavaScript.
