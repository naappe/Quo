# Quo refactor: foundation review

Starting commit: `2d05ba2f16ac0f53e0886c60b5a670acdf336cc0`.
Rollback: remote `backup-before-refactor` branch. A local tag with the same name was also created; the GitHub connector used to publish this work supports branch creation, not tag creation. No changes were made to main, live records, database schema, numbering, or the payment RPC.

## Implemented

- Step 0: pure integer-minor-unit payment summary, validation tests, and one integration in the inline payment view. A compatibility adapter retains the existing half-laari tolerance for fractional legacy totals; this is not a currency-rounding migration.
- Step 1: GST field declared directly in the document editor and blank document; serialized in both document payload builders; rendered directly in the canonical PDF identity; included in preview invalidation. Removed the GST patch and script tag.
- Step 2: initially unknown connection state; verified query success, returned errors, network exceptions, offline/reconnect states and stale logout requests. Login footer recreation preserves the current state.

GST remains a document-level customer identifier, matching the existing `quo_documents.customer_gst_number` column. It is not a new column on the customer master. The existing source-copy trigger is unchanged. Its live deployment was not verified.

## Verification

Run from repository root:

```sh
node --test tests/*.test.mjs
node tests/quo-static-check.mjs
```

11 behavioral tests and existing static checks passed locally. Unit tests execute actual application functions against isolated state/DOM substitutes; JSON round-trip tests are not proof of a live database save. GitHub Actions runs both sets on pull requests.

For isolated browser integration checks:

```sh
node tests/quo-test-server.mjs
```

Open `http://localhost:4173/Quo/index.html` in a local browser. The test-only server substitutes a fake Supabase client and adds a test runner. Its CSP blocks outbound connections. It performs one reload and displays PASS/FAIL at the bottom. Fixture records are prefixed with `fixture-` in local/session storage. PDF libraries are test doubles: checks compare document DOM passed to export, not generated PDF pixels. The server is a development fixture only; do not publish it as the application.

Browser checks were NOT executed successfully in this session: the available remote browser rejected localhost and local Chromium could not be downloaded. Therefore this change is a draft and is not asserted deployable. Visual desktop/mobile inspection, actual PDF export, authenticated save/reload, and database-policy checks remain gates before merging.

## Findings and next stages

- Preview and export already call the final `renderPrint` pipeline. `quo-preview-v44.js` snapshots it, and `quo-runtime.js` exports clones of its pages. Exporting a scaled on-screen preview directly would risk changing dimensions. Preserve full-size A4 pages and test parity before consolidation.
- The payment migration includes `SELECT ... FOR UPDATE` and receipt insertion within a PostgreSQL function call; this is evidence of intended atomic behavior, not confirmation of the deployed function/triggers. `SECURITY DEFINER` concerns privileges, not transaction safety. The RPC remains unchanged.
- Step 1's broader runtime-override cleanup, Step 3 (shared document totals), Step 4 (renderer consolidation), and Step 5 (ES modules) remain pending. Do not begin the wholesale module conversion until the browser gate passes. Shared mutable globals and wrapper order make it more than renaming files.

Next review: run the isolated browser fixture, verify real PDF pagination and GST on an authorized staging document, then migrate calculations with legacy-output parity tests before moving modules.
