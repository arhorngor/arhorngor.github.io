# Safe rounds V2 — 2026-10-17

Base: `025ed28bdd2ab14624453934521a4cd116620458`.

## Bogey Base update (v21)

New rounds expose Standard / Bogey Base choices and retain `scoringMode: 'standard' | 'bogey'`.
Missing mode on older rounds means Standard. Stored slot `par` and course `pars` always remain official values.
`RoundCore.scoringPar` adds exactly one in Bogey Base; no raw scores, penalties, or source Pars are changed.
Full-course target is the sum of the selected 18 slots: a Par72 course becomes 90, Par70 becomes 88, and missing Pars leave the full target unknown.
Recording, relative scores, and caddie reactions use the round mode. Historical lists identify rounds started in Bogey Base.

Both overviews and both analysis pages have Standard / Beginner view switches. `basis` in the URL changes only the view and carries between overview and analysis; no storage writes occur when comparing.
Beginner approach success uses beginner Par minus two, is explicitly labeled as beginner success rather than official GIR, and appears in the existing approach radar axis.
The legacy driving proxy still uses official Par4/5 holes with an official Par+1 threshold in both modes; actual putt, penalty, short-game, and trouble counts are unchanged.
This does not implement the separately planned five-axis V2 redesign.

Verification now includes 40 tests, covering both mode defaults, 90=E/+18 comparisons, missing/nonstandard Pars, caddie reactions, mode persistence across backups, view-only switching, and original Par3 classification. Real mobile/browser validation remains outstanding.

## Entry points

- `round.html` loads `round-core.js`, `round-store.js`, `round-v2.js`, `round-actions.js`, and `caddies.js` (v21).
- `round-v8.js` and `round.js` are retained for source history, but are not current entry points.
- `report-v2.js` renders both current/history overviews. `analysis-v2.js` renders both analysis pages.
- `data.html` provides export, import preview, conflict copies, and rollback. History includes unfinished rounds.
- `app.js` renders course search; `new-round-v2.js` creates new rounds. Both nine-hole sections are selectable.

## Data contract

`arhorngor-data-v2` is a single JSON envelope with `schemaVersion:2`, `revision`, `entries`, `activeId`, and `viewId`.
Each entry has a distinct ID and a `round`. Legacy entries additionally retain the unchanged parsed `original`.
The immutable `arhorngor-original-v1` snapshot preserves exact original localStorage strings before the first V2 write.
Legacy active/history/view keys are never overwritten or deleted by V2 round code.

Each round has exactly 18 `roundSlots`, identified by unique slot IDs independent of `courseHoleId`.
Slots have `shots`, `par`, and a status: `not_started`, `in_progress`, `completed`, `unconfirmed`, or `legacy_completed`.
Any shot/Par edit reopens a completed slot. Navigation alone preserves completion.
Repeated physical holes have separate shots. Replacing one hole or nine consecutive holes is allowed only for empty, unstarted slots.

Legacy active holes with shots are `unconfirmed`. Legacy finished rounds use `legacy_completed` for recorded holes, with an explicit disclosure that individual completion was not recorded.
Ambiguous extra holes are retained in `unassignedHoles`, shown separately and excluded from 18-slot totals.
Duplicate physical holes in a legacy play order never duplicate the only available shot record.
No missing scores or historical play order are invented.

## Scoring

- `RoundCore.strokes`: OB 前方補球 = 2; other penalty events = 1; other recorded events = 1.
- Trouble does not add strokes. Legacy `teeTrouble` is still read.
- All headline totals include all recorded slot shots, including unfinished holes.
- Relative Par uses only completed slots with known Par. The sample count is displayed.
- GIR is inferred from counted strokes before first PT, in completed slots with known Par and a PT event. No-PT holes are excluded rather than guessed.
- Hole-based analysis uses completed slots; event headline totals use all recorded slots. Both current/history pages share these rules.
- Old meter bands remain meter bands and are excluded from yard-based short-game quality scoring. Their distributions remain visible.
- Radar labels/formulas remain the existing five abilities; this release does not implement five-axis V2.

## Storage, backup and recovery

Before each substantive write, V2 verifies the current state and retains the previous envelope. A single final setItem commits round entries and active/history pointers together. Storage errors never intentionally clear an active round.
The editor checks a saved baseline before overwriting its round. Cross-tab storage events stop further editing and offer an unsaved-round download. This is browser-local storage, not a multi-user transactional database; avoid editing the same round in multiple tabs.

Backups use `format:arhorngor-backup`, `version:1`, and exact localStorage strings in `raw`.
Imports validate supported versions and structures before writes, show a preview, skip identical rounds, and assign a new entry ID to ID/content conflicts. Import never takes over the currently active round.
The incoming full backup is archived unchanged under `arhorngor-import-original-*` before committing additions, retaining settings and source data even when only rounds are imported.
Bag/caddie settings are included in backups but are not automatically applied over the destination settings.
Rollback archives the current full backup first, validates the previous envelope, then switches to it. Even corrupt current strings remain recoverable in the archive.

Local snapshots and previous versions are lost if the user clears site storage. Exported JSON must be saved outside browser site data.
The browser download API starts a download; it cannot prove the user saved the file. UI asks the user to confirm the file exists.

## Verification

Run `node --test tests/rounds.test.cjs` and `node tests/check-source.cjs`.
Tests cover scoring, 18-slot identity/order, 27/36-hole routing, duplicate physical holes, empty-slot replacement, legacy preservation, malformed imports, duplicate/conflicting imports, quotas, stale editors, rollback, and shared page calculations using a simulated DOM/storage.
Real mobile browser layout, downloads, and field use remain to be verified on a device. No browser automation result is claimed.

## Rollback deployment

Keep the V2 source commit and export V2 data before reverting application code. The base version can only read legacy keys; it cannot display new V2 rounds. Source rollback alone does not convert V2 rounds into legacy data.
Future changes must preserve V2 originals/import archives and must not silently clear or rewrite legacy round keys.
