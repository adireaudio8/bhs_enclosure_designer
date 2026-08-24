# Website Engine Parity Update Proposal

**Prepared:** 2026-08-24

**Status:** Package parity and customer items 1-2 committed and live; provenance/automation work remains

**Target engine:** `910f804299e006ff0f6ce94d09b1a321fb58970a`

## Required outcome

Bring the customer website designer and the internal calculator onto the same full `enclosure-engine` revision. The internal calculator already uses `910f804`; the website must vendor that exact engine source, pass its checks, deploy through Vercel, and pass live Shopify regression testing.

This is shared-engine parity, not identical UI parity. The customer designer should continue hiding manufacturing-only calculations, costs, cut lists, DXF/ACC/CNC exports, glue tolerance, manual kerf setup, and manual labyrinth controls unless those surfaces are separately approved for customers.

## Verified baseline

- The calculator dependency is pinned to engine `910f804`.
- Before the 2026-08-24 local update, the website tarball exactly matched engine `df2dc9bb28d4425010e28b92cdfa4902584e1d24` from 2026-06-08 and was 48 engine commits behind the calculator.
- The local website tarball now comes from a clean checkout of exact engine commit `910f804299e006ff0f6ce94d09b1a321fb58970a`. Its SHA-256 is `167F8C56FA2C78C7FB19A5E9607CE40DBCA250BA851EB63C4AB0D6F9A5644A9A`.
- The local lockfile now contains the new tarball integrity, `clipper2-ts@2.0.1-18`, and the engine's postprocessing peer metadata. The previously present unrelated lockfile edits were preserved.
- The production Vercel deployment was created 2026-06-09, consistent with the older designer source and tarball.
- A clean isolated package of engine `910f804` was installed into a clean copy of this designer. Engine lint completed with five existing warnings and no errors; engine typecheck passed; all 525 engine tests passed; designer typecheck passed; the production Next.js build passed; the local health and page routes returned HTTP 200.
- No compatibility-driven application source edit was required merely to compile the new engine.
- After the real local tarball and lockfile were updated, `npm run check` passed again: TypeScript completed and the Next.js production build generated all expected routes.
- Production commit `14842b9` contains only the refreshed engine tarball and required lockfile dependency metadata. Vercel deployment `dpl_GG4ktQMiFwxg481pkgx7VMTJxi6B` reached `READY`; the direct health endpoint and live Shopify route returned HTTP `200`; and the loaded designer exposed configuration, pricing, dimensions, and no browser console errors.
- A controlled checkout/draft-order regression was not run because that creates external Shopify state and remains subject to explicit approval.

## Phase 1 — Required package parity

1. Package engine `910f804` from a clean checkout of that exact commit. Do not pack the current dirty engine working tree; it contains unrelated snapshot edits.
2. Replace `vendor/adireaudio-enclosure-engine-0.0.0.tgz`.
3. Refresh the dependency with the explicit file spec:

   ```powershell
   npm install "@adireaudio/enclosure-engine@file:vendor/adireaudio-enclosure-engine-0.0.0.tgz"
   ```

   A plain `npm install` is not sufficient for this operation. Because the file path remains unchanged while its bytes change, npm can retain the old integrity hash and fail with `EINTEGRITY`.
4. Commit the tarball and refreshed `package-lock.json` together. The new lockfile must contain:
   - the new tarball integrity;
   - `clipper2-ts@2.0.1-18` as an engine dependency;
   - the engine's postprocessing peer metadata.
5. Do not retain incidental `package.json` key reordering or generated `next-env.d.ts` path changes from local validation.
6. Run `npm run typecheck` and a normal production `npm run build`.

This phase is complete in production. The website and calculator now use the same engine source, and the website includes all 48 shared-engine commits listed below.

## Phase 2 — Customer behavior alignment recommended with the package update

### 1. Enable MDF flush mount

Before this release, the website UI disabled flush mount whenever the material contained `MDF`, even though the current engine supported MDF flush construction. The required work was to remove the Birch-only gate, use material-aware customer copy, and verify Supabase pricing modifiers for MDF + Flush Mount combinations before enabling checkout.

**Completed 2026-08-24:** commit `f44d9bd` adds the customer Material selector, preserves the selected material while duty changes, removes the Birch-only flush gate, uses the engine's material-specific MDF/Birch cap thickness for top-mounted port-area preservation, and shows material-aware construction copy. Live pricing returned both `mdfDiscount` and `flushMount`; the Single 6.5-inch MDF Regular Duty flush case priced at `$273.49` with an `OK` baffle fit.

Files:

- `src/components/CustomEnclosureDesigner.tsx`
- `src/app/apps/enclosure-designer/api/design-pricing/route.ts`
- `src/app/apps/enclosure-designer/api/checkout/route.ts`

### 2. Add the 6.5-inch customer option

The engine and calculator support `6.5"`, and the calculator documentation records live 6.5-inch pricing rows. Before this release, the website's local `SUPPORTED_SIZES` still began at 8 inches.

Required work:

- add `6.5"` to `SUPPORTED_SIZES`;
- add authoritative 6.5-inch OD, cutout, displacement, starting volume, tuning, and port-width defaults;
- verify the live Supabase MAP/dealer lookup for Single through Quad and SD/RD/HD;
- remove or update the unused local placeholder `PRICE_MATRIX`, which currently forces every local size to carry obsolete hard-coded prices even though production pricing comes from Supabase;
- test baffle fit, suggested dimensions, checkout attributes, and analytics labels.

Do not automatically expose 21-inch support merely because the engine type includes it; that remains a separate catalog/business decision.

**Completed 2026-08-24:** commit `f44d9bd` adds `6.5"` with storefront starting defaults of `6.75"` OD, `5.75"` cutout, `0.03 cu ft` displacement, `0.4 cu ft` net volume per sub, `36 Hz`, and a `0.75"` port. The unused placeholder price matrix was removed; Supabase remains the only online price source. Live verification covered Single through Quad across SD/RD/HD for Birch and MDF flush designs, with every case returning an `OK` baffle fit. The internal Pricing Matrix showed 18 populated 6.5-inch tiers per duty, with MAP and dealer values present in every row. Analytics and checkout already carry `inputs.size`, so the new value flows through without a separate whitelist. The customer checkout button became enabled in the live signed proxy test, but it was not clicked and no draft order was created.

### 3. Preserve automatic labyrinth behavior without exposing manufacturing controls

The updated engine can automatically activate labyrinth geometry when the legacy solve produces a negative remaining chamber. The customer app should accept that derived behavior and render it correctly, but the internal manual `forceLabyrinthPort` override should remain hidden unless separately approved.

Recommended website changes:

- show a simple customer-safe note when a derived multi-fold port is active;
- include labyrinth active state and fold count in the internal production snapshot/metafields;
- retain the full input snapshot so production can deterministically recalculate the design;
- verify pricing and checkout still fail closed if no valid price exists.

### 4. Record engine provenance on every custom order

Add a committed designer provenance file, for example `vendor/enclosure-engine.commit`, containing the full engine SHA. The engine-sync command should update it automatically. Include that revision in the private production snapshot/metafield so every custom order can be traced to the exact geometry engine that priced and rendered it.

### 5. Keep internal-only features internal

The package update includes CNC, ACC, DXF, kerf, logo-toolpath, glue-tolerance, and manufacturing-review improvements. They must be present in the shared package for parity, but the website should not add customer controls or downloads for them as part of this update.

## Phase 3 — Prevent another parity gap

1. Add a checked-in engine-sync script in this repo that:
   - requires an exact 40-character engine SHA;
   - packages only from a clean checkout of that SHA;
   - replaces the tarball;
   - writes `vendor/enclosure-engine.commit`;
   - runs the explicit file-spec install;
   - verifies the lockfile and installed package;
   - runs typecheck and build.
2. Add an npm `verify:engine-parity` command that fails when the recorded SHA, tarball source, installed package, or calculator target disagree.
3. Add a `files` allowlist or `.npmignore` in `enclosure-engine`. The current clean `npm pack` includes CI configuration and all engine tests, growing the tarball from about 187 KB to about 291 KB. Runtime source, package metadata, and essential documentation are sufficient.
4. Add designer CI for engine provenance, typecheck, build, and a small regression suite. The designer currently has no automated tests.
5. Treat calculator and designer deployment verification as one release checklist item. Neither consumer should report the engine bump complete independently.

## Required regression matrix

- Viewer: normal, X-Ray, dimensions, parts, natural/stained material, subwoofer visibility, popout, and texture-load failure fallback.
- Geometry: all three enclosure orientations; Single through Quad; SD/RD/HD; Birch and MDF.
- Options: Birch flush, MDF flush, acrylic window, terminal default/custom/none, and safe-position snapping.
- New size: 6.5-inch fit, dimensions, pricing, analytics, and checkout metadata.
- Derived porting: at least one normal two-leg design and one automatically activated labyrinth design.
- Pricing: guest/customer MAP and dealer/distributor dealer price; modifier deltas; unavailable-price fail-closed path.
- Checkout: controlled test draft order only after approval; confirm customer-visible text excludes internal manufacturing details and private metafields contain full inputs, derived production summary, and engine revision.
- Live routes: Vercel direct route, health endpoint, Shopify `/apps/enclosure-designer`, Shopify header/footer wrapper, and checkout redirect.

## Complete 48-commit engine update inventory

### Viewer safety, kerf rendering, and kerf CNC geometry

1. `73e6bcf` — fix the X-Ray Rules-of-Hooks crash.
2. `dd8ac8b` — render the first kerf-bent Baffle + Port 1 geometry.
3. `85beec9` — correct kerf ACC horizontal drilling and file allocation.
4. `690afd0` — place subs on the kerf baffle leg and make fit checks kerf-aware.
5. `e941f10` — prevent kerf sub cutouts from overflowing the bend.
6. `b14db63` — align the driver model with kerf baffle-leg cutouts.
7. `e88c24c` — derive kerf groove count from bend radius.
8. `58b4add` — add React Hooks linting and repair issues it found.
9. `fee7b01` — make black port paint follow the kerf bend.
10. `3997de4` — add satin-black 3D port paint and mouth floor/ceiling treatment.
11. `8f6804f` — replace kerf mouth patches with texture-based treatment.
12. `c00e893` — use curve-following mouth slivers and improved low-light paint.
13. `92f7269` — correct the kerf DXF groove layer name.

### CI, containment, tests, and calculation guards

14. `19f744f` — add GitHub Actions lint/typecheck gates and postprocessing types.
15. `f97b93b` — add viewer error boundaries around both canvases.
16. `8eb98d7` — add the first 401-test engine characterization suite, later expanded to 525 tests.
17. `f7664e5` — guard NaN costs, support OD-less baffle checks, and document window custom dimensions.
18. `89f9991` — normalize pricing delta cents and legacy negative-zero handling.

### MDF geometry and rendering

19. `a5962c2` — add true-dimension MDF layer families.
20. `0d6eaad` — complete MDF Top/Bottom drill and guide placement.
21. `20e6e47` — use full-stock panel mates because MDF is never milled.
22. `7fa68e6` — correct MDF baffle width for true D1/D2 PP2 mating.
23. `de8d147` — prevent MDF panels rendering white after switching from Birch.

### Export performance, physical construction, and ACC identity

24. `a899171` — add faster exports and compact logo programs.
25. `c19c347` — use exact logo-panel thickness.
26. `1ab9aa5` — support MDF flush mount.
27. `12ef36f` — honor glue tolerance across CNC outputs.
28. `6ce88d7` — add compact ACC machine identifiers.
29. `733862d` — separate ACC identity from export prefix.
30. `627666d` — disambiguate legacy ACC design codes.
31. `50219d3` — separate legacy flat-pack ACC codes.

### Placement and viewer resilience

32. `3b6786d` — support staggered dual-sub SUPB layouts.
33. `7696b5f` — keep the viewer usable when texture loading fails.
34. `d5fb995` — make ACC identifiers human-readable.
35. `877b1af` — preserve full ACC identifiers.

### Pocket-logo toolpaths

36. `fae4762` — make pocket-logo toolpaths robust.
37. `1f65574` — emit arcs in pocket-logo toolpaths.
38. `5738ce4` — use 50 percent pocket-logo step-over.
39. `31c1610` — reduce pocket-logo entries safely.
40. `4985ac7` — optimize pocket-chain travel.

### New geometry capabilities

41. `18e7464` — add first-class 6.5-inch subwoofer support.
42. `e22a1ba` — add automatic labyrinth-port layout.
43. `8a36ec5` — support labyrinth ports in every enclosure orientation.
44. `69b3bdc` — document automatic labyrinth boundaries in engine source/docs.
45. `ca5a606` — enable labyrinth manufacturing-review exports.
46. `5945f9a` — add the saved manual labyrinth override used by the internal Design tab.
47. `f0127db` — recognize tightly and implicitly closed EPS contours.
48. `910f804` — ramp curved logo entries along valid arcs for controller-safe output.

## Recommended release sequence

1. Complete: Phase 1 package parity was committed as `14842b9` and deployed to production as `dpl_GG4ktQMiFwxg481pkgx7VMTJxi6B`.
2. Complete: MDF flush plus 6.5-inch customer support was committed as `f44d9bd` and deployed to production as `dpl_4QWvQMW6opX2KLPTZJfj5bmHtP2E`.
3. Add engine provenance and automated parity verification.
4. Complete for items 1-2: review the full diff and test evidence.
5. Complete for Phase 1: commit and push the designer update to `main`.
6. Complete for Phase 1: deploy production Vercel.
7. Partially complete: the health, direct app, live Shopify page, 6.5-inch pricing, and MDF flush regressions passed. Only with explicit approval, create one controlled Shopify test draft order.
8. Complete for the engine package: the deployed designer and calculator use engine `910f804299e006ff0f6ce94d09b1a321fb58970a`. Per-order engine provenance remains a Phase 2/3 improvement.
