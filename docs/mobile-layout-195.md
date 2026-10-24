# Mobile Layout Review

Client revision: 180. Source commit title: 195-Mobile Layout Fixes.

## Changes

- Compact Overall Rankings keeps pagination and ranking selection in the footer. More opens snapshot status, quick rankings, challenges and track scope without permanently reducing the racer list. Existing nodes and handlers are restored on desktop resize.
- Portrait footer: 106 CSS pixels. Short-landscape footer: 58 CSS pixels. Controls use 44-pixel targets. Desktop layout remains unchanged.
- Portrait track groups stack vertically. Cards use equal grid widths and contained previews. Winter was positioned outside the viewport beside Summer, not absent from track data.
- Home branding, attribution and social links have readable effective sizes despite the native menu scale. Short landscape uses a contained single row. The six main buttons use a three-by-two portrait grid and one landscape row to prevent overflow after rotation.
- Fullscreen is capability-driven. Available native APIs are used. Refusal or missing support gets explicit viewport-only controls or fullscreen help when the game already fills the viewport. Browser chrome and cross-origin parent frames cannot be hidden by this fallback.
- Available space is bounded by root client dimensions, preventing mobile overflow from inflating innerWidth and overlay sizes.
- No engine, canvas backing size, physics, timing, ranking calculation, replay or Firebase configuration changes.

## Automated Coverage

Chromium, native game DOM, touch/mobile emulation. External requests blocked and Firebase writes rejected by the existing audit fixture. Live resize without reloading:

| CSS Viewport | Layout | Footer Height |
| --- | --- | --- |
| 440x780 | Portrait | 106 |
| 440x680 | Portrait | 106 |
| 390x720 | Portrait | 106 |
| 375x600 | Portrait | 106 |
| 320x500 | Portrait | 106 |
| 956x360 | Landscape | 58 |
| 844x320 | Landscape | 58 |
| 667x300 | Landscape | 58 |
| 1366x600 | Desktop | Existing layout |
| 1920x1080 | Desktop | Existing layout |

Additional checks: footer bounds, useful list height, More/Escape, desktop restoration, all 17 official cards within horizontal bounds, equal card widths, Winter scrolling, native fullscreen refusal, track search, community card containment. Unit tests cover breakpoint boundaries and fullscreen lifecycle/error handling.

## Limits

The original failures were reported on a real iPhone 17 Pro Max in Safari. Updated code was checked locally using Chromium emulation, not on that physical phone. Safari/WebKit, real browser-bar animation, OS fullscreen, actual touch hardware and school-device performance still need a post-publication device check. DPR 3 screenshots were also inspected; changing DPR is not browser zoom testing. No claim of universal device compatibility is made.
