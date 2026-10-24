# CDN Release Publishing

## What Changes

Apps Script can discover releases through jsDelivr without a browser request to
GitHub, raw GitHub, GitHub Pages, Firebase, or the Worker for discovery.

The one mutable URL is:

`https://cdn.jsdelivr.net/gh/StaticQuasar931/PolyTrack-0.6.3-Ranked@cdn-release/release.json`

Its dedicated `cdn-release` branch contains only a public release.json, with the
source commit, snapshot directory, entry HTML SHA-256, schema version and date.
No credentials, reports, server configuration or private player data are copied.

Game files use `@<full commit SHA>/...`. Each Git commit is a full tree. A file
unchanged since an earlier commit still exists at the later commit URL. No purge
of immutable files or all historical paths is necessary. Old active games retain
their coherent old tree; new visits discover the newer one.

## Order And Coverage

1. A source or snapshot commit reaches main.
2. The publisher checks out current main after acquiring its shared release lock.
3. It checks local snapshot pointers, initial rankings payload bindings and asset
   paths. It then compares CDN bytes against the committed entry point, its
   directly referenced files, required module dependencies, native startup images,
   physics worker/WASM, snapshot bootstrap, and initial rankings payloads. This
   warms a bounded boot path, not every replay. Hashes use Git blobs, not Windows
   checkout line endings. The initial 149-asset CDN check passed.
4. Only then does it fast-forward the dedicated pointer branch. No force push or
   source working-tree edit is used. A non-ancestor publication fails safely.
5. It purges only the mutable pointer and verifies the resulting public content.
   Purge acknowledgments alone do not count as success. Retries are bounded.

Manual pushes to main trigger `Publish CDN release`. The three file-writing
workflows explicitly call it after their capture/push job: sync-event-catalog,
sync-kodub-weekly, and publish-verified-snapshots. verify-runs reaches it through
its existing publish-verified-snapshots call. This explicit chain matters because
GITHUB_TOKEN pushes normally do not trigger another push workflow.

No GitHub Pages deployment is needed: jsDelivr resolves the committed repository
tree directly. No Firebase reads or writes are added. Only the built-in Actions
token with contents:write is needed; no new secret or access token is required.

## Setup

Commit and push the workflow, tool, tests, and this document to canonical main.
Check that `Publish CDN release` completes successfully. If repository rules
prevent creating or updating `cdn-release`, fix that narrowly; do not disable
main protections or broaden token permissions.

Then replace Apps Script's index HTML with the separately generated private
automatic index.html and update the existing web-app deployment. Keep its normal
Code.gs doGet. Do not upload the private build/audit folders to GitHub.

Until the first successful pointer publication, the loader uses its embedded
baseline. Existing deployed HTML is not changed by adding this workflow.

## Failure And Maintenance

The browser caches a successfully discovered pointer for five minutes; reloads
do not extend that discovery timestamp. It checks the entry HTML digest before
executing it and falls back to a saved release or the embedded baseline on error.
Rollback-like CDN responses older than its saved publication date are ignored.

CDN propagation is not instantaneous and one runner cannot certify every CDN
edge or school network. If propagation verification fails after pointer push,
rerun `Publish CDN release`: it retries the purge without adding a duplicate
pointer commit. Asset readiness failure leaves the old pointer untouched.

If main advances during checkout, rerun publication. Newer capture/push jobs also
request publication. Superseded pending Actions jobs may be coalesced by GitHub;
the next admitted job reads current main rather than the caller's old SHA.

The loader requires reachable jsDelivr assets. It is not offline mode, and it
does not update or interrupt an already-open race. Current game code may still
make optional GitHub-hosted update checks; those are distinct from this loader's
CDN-only discovery path.

Readiness probes cover initial critical files, not full UI correctness, every
replay or every dynamic import. Run normal release tests before pushing game-code
changes to main. This channel treats main as the approved publishing branch.

## References

- https://www.jsdelivr.com/tools/purge
- https://github.com/jsdelivr/jsdelivr#usage-documentation
- https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow
