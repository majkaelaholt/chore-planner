# Household — calm chore planner

A desktop + iPhone-friendly PWA for recurring household chores. The main goal is not to maximize productivity; it is to make the stopping point obvious.

## v1.17

- Added **Choose a different date** when marking a chore complete. Normal completion still defaults to today, while forgotten completions can be logged on the day they actually happened.
- Backdated completions appear on their real calendar/history date and drive recurrence from that real completion date when they are the newest completion for the chore.
- Logging an older forgotten completion cannot rewind a newer routine that has already been completed since.
- **Reset Today now treats Mak, Ty, and Either chores equally** when calculating Bare minimum / Light day / Catch-up plans. Assignment remains visible, but no unfinished chore is automatically protected just because it belongs to Ty.
- Today’s remaining count is once again a single household count rather than splitting Mak/Either from Ty.
- Bumped the PWA cache to `household-v1-17`.

## v1.16

- Rebuilt **Reset Today** on phones as a full-width bottom sheet instead of a cramped desktop-style dialog.
- The recovery plan now uses **one vertical scroll**; the plan list no longer has its own nested scroll area on mobile.
- Recovery action controls are full-width on phones. When **Move** is selected, its date field stacks underneath so iOS date inputs cannot overflow the card.
- Hidden Move dates no longer reserve empty space beside Keep/Skip actions.
- The recovery footer stays visible with a sticky, safe-area-aware **Never mind / Apply recovery plan** bar.
- Added mobile overflow guards so Reset Today cannot make the page scroll side-to-side.
- Bumped the PWA cache to `household-v1-16`.

## v1.15

- Added **🪫 Reset today** for the days when the backlog is bigger than your actual capacity.
- Capacity levels: **Bare minimum**, **Light day**, and **Help me catch up**. The app proposes a recovery plan before changing anything.
- Recovery plans split chores into **Keep today / Move / Skip this cycle**, and every suggestion can be changed before applying it.
- Bare-minimum planning deliberately favors a **small win**; v1.17 later changed capacity planning so all unfinished household chores count equally regardless of assignee.
- **Essential chores are never auto-suggested for skipping**; they can still be manually skipped when real life calls for it.
- Added **Skip this occurrence** under a planned chore's ••• menu. Skipping is recorded separately from completion.
- Completion-based skips advance to the next target without pretending the skipped chore was done; fixed/calendar rhythms stay anchored to their normal next occurrence.
- Household Overview understands **Skipped this cycle** as a neutral state: it does not reset freshness, but it also stops demanding that missed cycle until the next target.
- Added a **Date meaning** setting per chore: **Target day — flexible** or **Fixed / calendar-dependent**. This lets routines stay concrete without treating every target date like a hard rule.
- Today now collapses multiple missed occurrences of the same recurring chore into the current occurrence, so missed housework does not become duplicate chore debt. Completing the chore once covers earlier missed cycles up through that day.
- v1.15 briefly separated Today counts by assignee; v1.17 returned this to one household count so assignment does not imply a chore can be ignored when it is still unfinished.
- **Quick win** suggestions now use a lightweight effort heuristic (and optional `quick`/`easy`/`small win` tags) rather than only importance.
- Bumped the PWA cache to `household-v1-15`.

## v1.14

- Removed **Balance planned chores** from the Planner. Planned dates now stay entirely under your direct control unless the normal recurrence/reflow logic changes them.
- Bumped the PWA cache to `household-v1-14`.

## v1.13

- Reworked the planner around three separate dates: **Due** (routine rhythm), **Planned** (your current intention), and **Completed** (what actually happened).
- A chore can now correctly say **Planned tomorrow · Due Sunday** instead of making those dates compete.
- Completion-based routines reflow future **planned** occurrences when an earlier plan is moved or actually completed early/late.
- Unpinned plans preserve their relative adjustment from the due date; **📌 pinned** plans stay on their exact calendar date.
- Missed chores stay attached to their original planned date while still surfacing in Today; the app no longer rewrites the plan date just to carry them forward.
- Manually entered **Last completed** dates now appear as subdued completed items on the calendar, even when there was no prior app history.
- Planner card shading now represents assignment instead of importance: muted pink for Mak, muted blue for Ty, and neutral beige for Either.
- Completed calendar items appear on the date they were actually completed.
- Bumped the PWA cache to `household-v1-13`.

## v1.12

- Forecasted recurring chores now automatically become planned when their due day arrives.
- If the app is first opened after the due day, that forecast is promoted into Today while preserving its original due date for grace/overdue status.
- Manually moving or assigning a forecast still plans it early and continues to anchor later completion-based forecasts.
- Removed the remaining automatic whole-week planning dependency; Week, 2 Weeks, and Month now all rely on the same continuous forecast/plan model.

## v1.11

- Fixed calendar-based routines skipping their first Start-date occurrence when an older completion existed.
- Added a one-time repair for v1.10 forecast moves where the next occurrence was moved backward onto the missing first occurrence.
- Clarified Start date vs Next due override wording in the chore editor.
- Bumped the PWA cache to `household-v1-11`.

## v1.10

- Added **Default person** to Chores → Batch edit, with Mak / Ty / Either options.
- Batch person changes update the chore default and routine-generated upcoming plans, while preserving occurrences that were explicitly moved/planned.
- Bumped the PWA cache to `household-v1-10`.

## v1.9

- Planner weeks now run **Sunday through Saturday** in Week, 2 Weeks, and Month views.
- Planner chore cards are softly shaded by importance: Essential, Regular, and Low stakes.
- Scheduled vs forecast styling is still preserved, so importance color does not hide whether a chore is actually planned.
- Added an importance-color key to the Planner legend.
- Bumped the PWA cache to `household-v1-9`.

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

- **Today view** shows the current occurrence of each chore that needs attention, without stacking duplicate missed cycles. A recovery mode can deliberately make the day lighter.
- **Household Overview** visualizes maintenance freshness for Essential chores by default, with an optional all-chore view and category statuses.
- **Planner** has Week / 2 Weeks / Month views that all show the same continuous schedule. Solid cards are explicit plans; outlined cards are forecasts. Due dates stay tied to the routine while planned dates can move independently, and completion-based plans reflow when reality changes.
- **Grace windows by importance** keep low-stakes chores from becoming fake emergencies.
- **Mak / Ty / Either assignments** with automatic splitting for “Either” chores. If one person did a chore last time, the app prefers the other person next time.
- **Recurring + one-off chores** in the same weekly planner.
- **Flexible recurrence**: every X days/weeks/months, a specific weekday, a specific day of the month, or patterns like the first Sunday of each month.
- **Editable Start date + Next due date** for each recurring chore, including one-cycle next-date overrides.
- **Fixed, completion-based, or ask-each-time recurrence** behavior for interval-based chores.
- **Missed-plan logic** keeps the original planned date intact, treats target days as flexible when appropriate, and lets you move or intentionally skip a cycle without pretending it was completed.
- **Capacity mode** offers Bare minimum / Light day / Catch-up recovery plans, including small wins, rescheduling, and intentional skips.
- **Extra Energy mode** reveals at most three optional suggestions only when you intentionally ask for more.
- **History** records completions and intentional skipped cycles separately.
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
- a **date meaning**: flexible target or truly fixed/calendar-dependent date

The planner shows recurring chores continuously without requiring a generation step. Each occurrence can have a routine target/due date, a planned date, and eventually an actual completion date. Forecasts land on expected routine dates. Planning an occurrence creates a temporary completion assumption; later unpinned plans follow that assumption. When the chore is actually completed, reality takes over and the future chain reflows. Pin an occurrence when a specific calendar date must not move.

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
