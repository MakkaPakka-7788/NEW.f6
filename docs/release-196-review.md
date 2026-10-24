# Release 196 Review

Client revision: 181. Snapshot generation: 57.

## Implemented
- Measure the actual root/container and visual viewport after resize, rotation, visibility and fullscreen changes. Observe late root size changes and notify UI overlays only when geometry changes.
- Reposition the existing compact rankings layout and snapshot information after those measurements settle. Hidden home credits no longer override the native hidden state.
- Scale snapshot weight/player text and the preferred card width with the text-size setting, bounded by available room. Native leaderboard geometry, physics, canvas and input scaling remain unchanged.
- Render readable event ordinals. Preserve submitted/received dates separately from verification dates, without inventing missing timestamps.
- Keep the daily preview contained and pixel-sharp; leave the weekly preview unchanged.
- Remove the obsolete unauthenticated Firebase event-totals fallback. Retain saved totals on failure.
- Export valid event dates and refresh date metadata within the existing bounded replay budget. Do not refresh immutable archived events routinely.
- Add bounded exact-period verification planning and identity-bound event similarity review metadata.
- Fail closed when the required public Worker rate limiter is missing. Retain successful public responses in bounded per-isolate memory if edge caching fails, without extending their original freshness.

## Browser Evidence
All browser checks below are emulation on a desktop computer, not physical-device performance certification.

| Coverage | Browser/Input | Result |
| --- | --- | --- |
| 76 live viewport transitions, including portrait/landscape phones, tablets, short Chromebook areas, breakpoint neighbors and ultrawide | Chromium, native track-selection UI | Pass |
| Same 76 transitions | Firefox, native track-selection UI | Pass |
| 684 snapshot-card combinations: 76 viewports, three text scales, three states | Chromium, keyboard/mouse | Pass |
| Overall rankings, More drawer, fullscreen-help fallback, all 17 official tracks, search and rotation | Chromium, emulated touch | Pass |
| Extra Tracks filters/direction/local-review changes, archives and event footer controls | Chromium, keyboard/mouse and touch-size layouts | Pass |
| Daily/weekly preview bounds and ordinals/dates | Chromium fixtures and unit tests | Pass |
| WebKit | Host runtime | Unavailable: crashes on a blank page before loading the game |
| Actual iPhone Safari, physical Chromebook/iPad | Real devices | Not tested here; user follow-up required |

The compact Overall footer measured 106 CSS pixels in portrait and 58 in short landscape. Screenshots were inspected for official tracks at 440x956 and 1366x600, and Overall rankings at 440x780 and 956x360.

## Backend and Data Status
- All 558 Worker tests passed. Approved Worker version 16318e8d-91ed-4934-8fcb-7d3204bf2244 deployed at 100%; official GitHub Pages and configured Apps Script status/CORS probes returned 200.
- Existing owner-only Firebase read restrictions remain deployed. No new service, challenge, App Check or login requirement was added.
- Bounded verification published 11 event runs and one normal Spite PB. Event pass stopped on its reserved budget with 96 pending runs remaining. Pending does not imply cheating.
- Malcolm's normal 48.466-second replay passed exact native finish verification and is included in snapshot 57. Its recording and all three selected current-event boards were read successfully through the actual packed snapshot client.
- Targeted snapshot refresh used 28 public Worker requests and one canonical document export, not a broad Firebase scan or Overall rebuild. Public HTTP counts are not billed Firestore operation counts. Existing unrelated source timestamps were preserved.
- Snapshot 57 and the client source require publishing before players receive them. A local CDN boot gate validated 153 assets. Individual CDN files must remain strictly below 20 MB.

## Honest Limits
- No claim of perfect behavior on every device or all gameplay states. The legacy full event integration harness also fails its module-loading setup on the baseline; the targeted event tests do not replace every end-to-end event scenario.
- The bounded verification pass did not clear every queue. General snapshot coverage remains incomplete; not every historical user, board or replay is guaranteed present.
- Worker limits do not govern direct authenticated owner requests to Firebase. Public snapshots remain copyable. These fixes reduce amplification and close public Firestore queries, but cannot guarantee the project will never exhaust quota.
- Username classification is inferred from naming patterns because snapshots do not retain a definitive generated/manual origin flag. The private report is based on snapshot 56 and does not claim a current live census.
- No engine/main.bundle.js byte changes, no physics changes, no production frontend publication performed as part of these local checks.
