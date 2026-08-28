# Household — calm chore planner

A desktop + iPhone-friendly PWA for recurring household chores. The main goal is not to maximize productivity; it is to make the stopping point obvious.

## v1.8

- Reworked Planner into one **continuous schedule** shared by Week / 2 Weeks / Month.
- Week view now shows outlined forecast occurrences too; you no longer have to press Auto-plan just to see what is coming.
- Removed the **Auto-plan week** button.
- Moving a forecast turns only that occurrence into a solid plan. For completion-based chores, the planned date becomes the temporary anchor for later forecasts.
- If the chore is actually completed early or late, later forecasts — and any future planned occurrences for that chore — shift by the same difference.
- Forecast cards can be dragged on desktop or opened with ••• to pick a date/person.
- Upgrading from v1.7 drops untouched future-week rows created by the old Auto-plan button so they do not override the new forecast; manually moved/snoozed plans are preserved.
- Bumped the PWA cache to `household-v1-8`.

## v1.7

- 2-week and month forecasts now project the **full future rhythm** for completion-based chores, not just the next known due date.
- Forecast chains assume each projected occurrence is completed on its due date.
- Completing a completion-based chore early or late automatically shifts all later forecast occurrences from the real completion date.
- Fixed/calendar-based routines remain anchored to their schedule.
- One-cycle Next due overrides are respected while future fixed-interval forecasts return to the underlying anchor.
- Updated the planner explanation so forecast cards are clearly predictions, not commitments.
- Bumped the PWA cache to `household-v1-7`.

## v1.6

- Replaced the odd outline-house Overview glyph with a normal 🏡 icon.
- Planner now has **Week / 2 Weeks / Month** view switching on the same page.
- Week remains the detailed drag-and-drop planning view.
- 2-week and month views provide a compact calendar forecast for seeing how occasional chores line up ahead of time.
- Zoomed-out views distinguish **solid planned chores** from **outlined due-date forecasts**.
- Tapping a day in 2-week/month view jumps directly into that week for detailed planning.
- Zoomed-out forecasts project later completion-based occurrences by assuming each projected chore is completed on its due date; real completion dates automatically re-anchor later forecasts.
- Bumped the PWA cache to `household-v1-6`.

## v1.5

- Added a calm **Household Overview** with freshness/deterioration bars.
- Essential chores are shown by default; all chores are available only when intentionally expanded.
- Added category-level maintenance status summaries and expandable chore details.
- Overview status follows each chore's actual due date and grace window, with no visible percentages, scores, or streaks.

## What it does

- **Today view** only shows chores that belong to today and celebrates when the day is handled.
- **Household Overview** visualizes maintenance freshness for Essential chores by default, with an optional all-chore view and category statuses.
- **Planner** has Week / 2 Weeks / Month views that all show the same continuous schedule. Solid cards are explicit plans; outlined cards are forecasts. Moving a forecast makes that occurrence a plan and re-anchors later completion-based forecasts.
- **Grace windows by importance** keep low-stakes chores from becoming fake emergencies.
- **Mak / Ty / Either assignments** with automatic splitting for “Either” chores. If one person did a chore last time, the app prefers the other person next time.
- **Recurring + one-off chores** in the same weekly planner.
- **Flexible recurrence**: every X days/weeks/months, a specific weekday, a specific day of the month, or patterns like the first Sunday of each month.
- **Editable Start date + Next due date** for each recurring chore, including one-cycle next-date overrides.
- **Fixed, completion-based, or ask-each-time recurrence** behavior for interval-based chores.
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

- a recurrence rule (for example every 7 days, every Sunday, monthly on the 1st, or the 1st Sunday of the month)
- an editable start date / schedule anchor
- an editable next due date
- an importance level
- a grace window based on importance
- a default assignee
- a schedule behavior

The planner shows recurring chores continuously without requiring a generation step. Forecasts land on their expected due dates. You can drag/tap a forecast to intentionally move it within your week; that planned date becomes the temporary assumption for later completion-based occurrences. When you actually complete the chore, reality takes over and the future chain re-anchors again.

## Default chore library

The built-in defaults are Mak + Ty's household chore list. All recurring chores default to **Either** so the weekly planner can distribute them between Mak and Ty.

In **Settings → Backup & reset**, **Set current setup as default** saves the current chore configuration as the new reset baseline. It saves chore names, categories, recurrence rules, start/next dates, importance, assignments, tags, and notes; it intentionally does not save completion history or the current weekly plan. Resetting preserves app settings and Supabase credentials.

The starter schedule does **not** fabricate completion history. It seeds first due dates across sensible upcoming days; once a chore is completed, its normal recurrence takes over.

## v1.4
- Added editable **Start date** and **Next due** fields to recurring chores.
- Added calendar recurrence rules: specific weekday, day-of-month, and nth/last weekday of the month.
- Calendar rules support intervals too, such as every 2 weeks on Sunday or every 2 months on the 1st.
- Editing a recurrence/date removes the stale open instance for that chore and replans it from the new schedule.
- Added **Set current setup as default** so Reset can restore the user's customized chore configuration instead of only the built-in list.
- Custom defaults are included in JSON/Supabase state backups and survive Reset.
- Bumped the PWA cache to `household-v1-4`.

## v1.3
- Upgraded the Chores library into a sortable, filterable management view.
- Added filters for category, importance, default person, tag, due status, and search.
- Added sortable table headers plus a Sort dropdown for mobile/tablet-friendly control.
- Added multi-select with Select all shown / Clear selection.
- Added batch editing for category, importance, and tags (add, replace, remove, or clear).
- Added batch delete while preserving completion history.
- Added optional comma-separated tags to individual chores and tag filtering/search.
- Bumped the PWA cache to `household-v1-3`.

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
