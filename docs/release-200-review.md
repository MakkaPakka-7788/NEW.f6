# Release 200: Names And Verification

Client revision: 182. Snapshot generation remains 57; no new snapshot was captured after Firebase returned HTTP 429.

## Client Changes
- New public names can be atomically claimed in Firebase. A collision keeps an allowed already-owned current name, or chooses a bounded deterministic account suffix. Name changes release the old claim atomically.
- Unchanged profile/PB identities do not read the name registry. Candidate checks are bounded to at most eight registry reads.
- The claim key matches tested Firestore behavior: SHA-256 of UTF-8 with ASCII A-Z folded to a-z. Other scripts are preserved, not rejected; non-ASCII case variants remain distinct.
- Identity ownership is checked before the unchanged-name fast path. Moderator exceptions apply only to the specifically authorized reserved request.
- A dismissible accessible notice reports an automatically adjusted name after a successful save.
- New cloud profiles record a server registration timestamp once the strict backend rules are enabled. Existing timestamps are immutable; old profiles are not silently assigned a fictional registration date.
- Exact Remlover/porp name-policy additions apply to browser/server projections, including the existing separator/leet handling, without a broad substring ban.
- The client-only rollout bridge preserves compatibility with currently deployed owner-read rules. It only handles a tagged denied registry GET, before any writes, and omits the new registration field in that legacy transaction. Quota, network, ownership, conflicts and commit failures never become a successful fallback. Strict backend rules still enforce claims.
- The CDN boot gate includes the new module, and release stamping versions its URL.

## Activation Status
The strict rules and migration are private, prepared and emulator-tested, not activated. Names have not been changed in production. Activation needs the client to be published, Firebase quota recovery, fresh complete registry coverage and a controlled identity-write transition. Current public-read restrictions remain unchanged.

The approved migration preserves the oldest server cloud-profile creation time in each duplicate group, then uses public ID as a deterministic tie-break. This is an account-age policy, not proof of first historical use of a name. The reviewed census has 791 profiles, 37 duplicate groups, 52 newer duplicate renames and two requested exact-name moderation changes. The existing Static display name remains unchanged. Stale ownership/name records stop migration rather than overwriting another change.

## Counts
- Generator: 25,600 distinct lowercase base names, 160 x 160. Legacy fallback: 8,742, already included in that set. Different accounts can choose the same base output; suffixes are a separate uniqueness mechanism.
- October 23, 2026, America/Los_Angeles: 67 currently surviving cloud-profile documents were created that day, based on server document metadata in the bounded complete census. This is not unique people, Firebase Auth signups or deleted historical profiles.

## Verification And Input Review
Cloud processing was stopped immediately on HTTP 429. Therefore this release does not claim that every queued run has been verified, that every verdict reached the server, or that snapshots contain all live replay files. The ledgers confirm 22 event-verdict publications; eight additional native-checked event runs have publication status unconfirmed after interruption. Nine normal runs passed native/input review offline and have saved, unpublished proof receipts. Private per-wave ledgers and those receipts preserve progress for a future fresh-state/CAS resume.

A no-network input audit examined all 4,208 available snapshot57 replay records. Its completed pair cache covers all 312,587 strict-decoder-eligible full-run pairs and all 317,717 analysis-decoded segment pairs. No cross-account clone matches were found under those unchanged detectors. All reported pair matches were same-account normal/event aliases. Sixteen replay records have rapid-input evidence for manual review, not a cheating or TAS verdict.

Limits remain explicit: 87 strict-decoder exclusions, 5,130 excluded full-run pairs, absent replay assets/bindings, and detector-specific blind spots. An input comparison is not native finish verification or proof of human input. No bans or cheating penalties were applied from this advisory audit.

## Validation
- Full Worker suite: 559 passed, no failures. The new exact-name policy has not been deployed to the Worker during the quota stop.
- Client transaction/identity/quota and name-generation regression group: 122 passed, no failures.
- Name-notice browser bounds, touch pass-through and keyboard dismissal: passed at four representative viewports.
- Strict private Firestore emulator suite: 34 passed, no failures.
- Actual client bridge against old and strict rules: five passed, no failures.
- Workflow/CDN/name-generation/public-export group: 62 passed, no failures.
- Local CDN boot gate: 154 assets validated. Individual CDN assets remain strictly below 20 MB.
- No main.bundle.js, physics, simulation or engine-pin changes.

All replay audit evidence, profile census data, migration code/rules and credential paths remain outside the public repository. The release preserves unrelated local work.
