# BHS Enclosure Designer App

**October 23, 2026 rear-wall terminal:** engine
`2e22b9a1423b6a43e879cf902e51ca3c9137c1e0` adds **Back — Top panel** for
Subs Up/Port Up. Preview and cutting output share the upright rear-wall location;
the full internal plate clears ports, walls and braces. Unsafe Top placement
blocks checkout in the UI and API. Existing Back values remain underneath,
and Back's preview retains its full width. No saved designs are rewritten.

**October 23, 2026 preview camera:** shared engine
`c6f4c7dbdd53eb0bcf7dec9ff94ea6a10754c293` fixes Reset after view-cube
rotation, fits the viewport and adds measured outside-frame outlines to the
existing Full dimensions mode. The footer retains the customer dark theme.
No manufacturing rules or saved customer designs change; the generic cone and
basket remain illustrative.

**October 23, 2026 brace-clearance follow-up:** engine
`6db1fde16a6f3bc13305efc887e27910840bf76c` matches the calculator's rule:
actual brace stock plus 0.250 inch on each side outside the subwoofer frames.
Moving braces, fit verdicts, preview and manufacturing positions agree. Tight
legacy designs with a brace underneath the frame can now fail fit. Customer
controls remain unchanged. No saved designs are rewritten. Engine parity,
TypeScript, production build and all 21 customer-app tests pass.

**October 23, 2026 independent-position parity:** engine
`446ddce1517d141c50f15e51d3966731fd8a0371` matches the calculator
release for one-through-four saved subwoofer centers on Top and baffle, including
preview, flush parts, custom outlines and manufacturing validation. Customer
controls remain unchanged; internal position controls belong to the calculator.
No saved customer design is rewritten.

**October 21, 2026 trim retirement:** engine
`1bf28556f5a9014d72fbf677e1197218dbf53421` matches the calculator's removal
of Top/Bottom sacrificial trim stock. Nominal calculations, holes, ACC and milling
remain unchanged. Customer controls are unchanged. The calculator owns the
backed-up correction of its stored manufacturing files.

**October 21, 2026 milling and glue-clearance release:** vendored engine
`bd45d2de66482400ee727b147e96cc4df9217b65` matches the calculator's derived
manufacturing geometry. Finished mating thickness and drilling now follow stock
thickness, duty-specific mill-down depth and glue clearance, including dual-port
alignment. Customer controls are unchanged; manufacturing controls stay in the
internal calculator. Owner approved the coordinated release. Clean packaging,
source/lockfile parity, TypeScript and the production build passed.

**October 20, 2026 shared-engine release:** vendored engine
`2c51a558ead33f7da19917c26e19841bdee86915` preserves original custom-cutout
EPS curves and uses the logo curve-to-DXF converter for manufacturing. Legacy
profiles remain readable; generating their cutting files requires an explicit
source EPS/profile update in the internal calculator. Existing customer designs
and controls are preserved. The calculator adds blocking XXL validation.
Andrew approved publishing both consumers with the same engine revision.

**October 19, 2026 shared-engine release:** vendored engine
`8c191e8ecc0c67005949e3288709fec77898c4e4` adds frozen custom subwoofer contours
for area, fit, preview and manufacturing consistency. The internal calculator
owns model/size EPS uploads; this update adds no customer upload or manufacturing
controls. Existing round designs retain their behavior. Parity verification,
TypeScript, all 21 designer tests and production build pass locally. Andrew
approved publishing both apps; the additive calculator database setup is installed.

**October 15, 2026 viewer release:** engine `612a67fab7f7b9cb8b3dc905931dfaea3359f553` matches the calculator's acoustic-specification update. Full dimensions shows net airspace, tuning and total port area. Shared PNG exports include a bottom-right specification box, with Each port only for dual-port enclosures. Export geometry is frozen for each image set. The internal calculator also adds an image-only download control to its pop-out; no manufacturing controls are exposed to customers. Owner approved the paired release; parity, TypeScript, 21 designer tests and both app builds pass.

The designer's dark viewer shell explicitly sizes the canvas as its second child and reserves space for the optional specification footer. A last-child selector no longer fits the viewer structure once the footer is present. The correction was checked in the built application: the footer stays within the viewer bounds and uses matching dark-theme colors.

**October 15, 2026 engine parity:** vendored engine `b56e71cc470cfc7069567eed5621035be6f81128` matches the calculator's automatic triple/quad Subs Up / Port Back layout update. Valid existing rows are preserved; layouts that need more room try aligned grids and staggered rows with shared brace and cutout geometry. Invalid automatic layouts display a reason instead of overlapping preview drivers. No saved designs, dimensions, acoustic settings or customer controls are migrated. The paired release requires parity verification, both builds and live deployment checks below.

**October 5, 2026 engine parity:** vendored engine `228f02b0ba48712b41bdda7dcb317a474b831db1` matches the calculator's independent dual SUPB placement release. The shared automatic solver now searches circular cutout clearance around the PP2 corner after preserving established safe layouts. The internal calculator exposes independent centers; customer controls remain unchanged. The tarball, lockfile, installed source and calculator pin pass parity verification, TypeScript, 21 tests and production build. No saved customer or production design is migrated.

Vercel-hosted custom Shopify app for the interactive Basshead Supply custom enclosure designer.

For the full Shopify migration handoff, see:

```text
https://github.com/adireaudio8/bhs_shopify_theme/blob/main/docs/HANDOFF.md
```

Standalone app repo:

```text
https://github.com/adireaudio8/bhs_enclosure_designer
```

Use that repo root for the Vercel project. This folder remains in the Shopify theme repo as the migration snapshot, but app deployment work should happen from the standalone app repo.

Shared engine dependency:

```text
https://github.com/adireaudio8/enclosure-engine
```

Treat the engine repo as read-only unless a dedicated engine change is requested. This app currently installs a vendored package snapshot from:

```text
vendor/adireaudio-enclosure-engine-0.0.0.tgz
```

That avoids Vercel needing SSH/GitHub access to the private `enclosure-engine` repo during `npm install`.

## Mandatory engine parity

**September 11 series identity and shipping policy:** the vendored engine now matches calculator
revision `45e2b796f364035b696aeb81ab39cfad772bbfa3`. Enclosure names now carry their series prefix throughout model generation and saved-design identity matching. Packaged shipping/billable
weights round up to whole pounds after packaging; raw enclosure mass and
fractional-inch dimensions retain precision. This does not add flat-pack choices
to the customer UI or change customer checkout/invoice scope.

This app and `enclosure-calculator-web` are parallel consumers of `enclosure-engine`. Whenever either consumer adopts a new engine revision, both must be updated to the **same full engine commit** in the same release work. The engine change is not complete until both consumers pass their checks, are pushed and deployed, and the live Shopify route `/apps/enclosure-designer` is verified.

The website UI intentionally exposes a customer-safe subset of the internal Design tab. It does not render internal calculations, cut lists, costs, or DXF/CNC downloads. That UI distinction is intentional; it does not permit the underlying shared engine to remain on an older revision.

Current coordinated engine revision:

```text
612a67fab7f7b9cb8b3dc905931dfaea3359f553
```

To refresh the vendored engine:

1. Update the calculator to the intended exact engine SHA first.
2. Run the coordinated sync command with the engine repository, exact SHA, and calculator `package.json`:

   ```powershell
   npm run sync:engine -- --engine-repo "C:\path\to\enclosure-engine" --sha <40-character-sha> --calculator-package "C:\path\to\enclosure-calculator\package.json"
   ```

   The command fetches the engine remote, packages from a clean detached worktree, replaces the tarball, writes `vendor/enclosure-engine.commit` and `vendor/enclosure-engine.sha256`, performs the explicit file-spec install, verifies the calculator pin, and runs typecheck plus the production build.
3. Review and commit the tarball, lockfile, revision marker, and tarball hash together.
4. Push `main`, deploy production Vercel, verify the health endpoint reports the new revision, and complete the customer regression checklist below.

`npm run verify:engine-parity` is also part of `npm run check`. It fails when the recorded revision, tarball hash, package dependency, lockfile integrity, or installed package differs. Pass `--calculator-package <path>` when performing a coordinated cross-app release so it also verifies the calculator's exact Git pin.

**Carton-clearance parity deployed 2026-08-31:** designer commit `5c7edea37d91458f32cf943470b852b91ff6f8b3` vendors exact engine `1832cc78eef94cdb558a4dae5668e2a735780b7e`, matching calculator commit `86dd8a0f00cb2e801642bac0f90d3cb34459a05e` and including the standard-carton 3.3 mm-per-side clearance rule. The clean sync workflow verified the package, lockfile, tarball hash, installed source, calculator pin, TypeScript, tests, and production build. Engine CI run `33417535608`, calculator CI run `33417539586`, and designer CI run `33417541777` passed. Vercel deployments `dpl_7fMh44RT7PRHP3Gx6jjkwhFyqkaw` (designer) and `dpl_6R61Q1BUYFCfMUsuwRrDTdZrKt2a` (calculator) reached `READY`; the direct designer route, live Shopify route, and calculator route returned HTTP `200`; and the designer health endpoint reported the exact engine revision above.

**Engine parity rollout completed 2026-08-24:** production commit `14842b9` vendors engine `910f804299e006ff0f6ce94d09b1a321fb58970a`, matching the calculator. Clean install, typecheck, and production build passed; Vercel deployment `dpl_GG4ktQMiFwxg481pkgx7VMTJxi6B` reached `READY`; the direct health endpoint and live Shopify designer route returned `200`; and the loaded designer showed configuration, pricing, dimensions, and no browser console errors.

**Customer option alignment completed 2026-08-24:** production commit `f44d9bd` exposes the engine's 6.5-inch support, adds an explicit Birch/MDF material selector, and enables material-aware flush mounting for both materials. Vercel deployment `dpl_4QWvQMW6opX2KLPTZJfj5bmHtP2E` reached `READY`. Live 6.5-inch MAP/dealer rows were verified for SD/RD/HD, and the storefront returned a valid `$273.49` guest price for a Single 6.5-inch MDF Regular Duty flush design with an `OK` baffle fit. A controlled checkout/draft-order regression remains separate and requires explicit approval. Remaining work is documented in `docs/ENGINE_PARITY_UPDATE_PROPOSAL.md`.

**Customer UI parity release deployed 2026-08-24:** production commit `50abb89` and Vercel deployment `dpl_5b5b2CmHf73JDMR8jSee3HVNbqU2` put the shared Supabase brand/model directory, authoritative model-and-size measurement application, customer-safe Subs Up / Port Back X/Y positioning, and customer build notes live. The server boundary forces Press Together construction, rejects customer control of manual kerf/labyrinth behavior, and limits acrylic windows to the standard 12x12 and 24x12 choices. Flat Pack is not offered. Custom acrylic dimensions remain deferred. The shared measurement rows are intentionally treated as sparse: missing model dimensions use clearly labeled, editable size defaults rather than being represented as model-specific data. The live health endpoint reported engine `60c7242b3ca728de48566741019d7ee3713e3e23`, and controlled pricing checks returned Birch `$661.99`, derived MDF `$463.39`, flush `+$50.00`, and standard 12x12 acrylic `+$75.00` without creating a Shopify draft order.

**Single-scroll Shopify embed deployed 2026-08-24:** designer commits `2adcc13` and `ccad39b`, theme commit `83e4c12`, and Vercel deployment `dpl_9NtxwyMTEZdSwCvJc6UvZuDYmRW4` replace the two fixed-height iframe viewports with a content-height relay. Both iframe layers disable their own scrollbar while the Shopify page remains the single scroll surface. Live expansion testing resized both layers from 1,227 px to 1,458 px and back to 1,227 px.

## Shopify app proxy

Configure the custom app proxy in Shopify Dev Dashboard after the app is deployed to Vercel:

```toml
[app_proxy]
url = "/apps/enclosure-designer"
prefix = "apps"
subpath = "enclosure-designer"
```

The customer-facing storefront URL will be:

```text
https://bassheadsupply.com/apps/enclosure-designer
```

The current Shopify page can link or redirect to that app proxy URL.

Do not change the theme navigation to this URL until the Vercel deployment is live and the proxy test passes.

## Required Vercel environment variables

Copy `.env.example` and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (server-only, independently revocable)
- `SHOPIFY_SHOP_DOMAIN`
- `SHOPIFY_ADMIN_ACCESS_TOKEN`
- `SHOPIFY_API_SECRET`

Production credential status (2026-08-31): the designer uses the dedicated
Supabase key named `customer_designer`. Both legacy JWT-based key types are
disabled. Do not reuse the Calculator, Production API, or Nest Runner key.

The app needs Shopify Admin API access to create draft orders. If customer tier pricing is used, the token also needs customer read access so logged-in customer tags can be checked.

Vercel project setup:

- Framework preset: Next.js
- Root directory: repository root
- Build command: default `next build`
- Install command: default `npm install`

Recommended Admin API scopes:

- `read_customers`
- `read_draft_orders`
- `write_draft_orders`

## Checkout behavior

The browser never controls price. The checkout endpoint revalidates the design through `/apps/enclosure-designer/api/design-pricing`, creates a Shopify draft order with a custom-priced line item, then redirects the customer to the draft order invoice URL.

Customer build notes are normalized and length-limited, then written to the draft-order note and private `bhs_build` production fields. The Top logo control can follow the subwoofer brand, use another brand from the shared directory, omit the logo, or collect a required custom-logo description. Stored EPS artwork renders in the preview when available; a selected brand name is still included with the order when artwork is not available to preview. Custom artwork is not fabricated in the browser preview; its normalized request is carried into the Shopify line attributes, draft note, and private production snapshot for follow-up before production. Subwoofer placement and baffle fit are recalculated server-side before a draft order can be created. Crafted requests cannot enable Flat Pack, manual kerf/labyrinth controls, custom acrylic dimensions, or an empty custom-logo request.

Before switching storefront navigation to this app, test:

- The vendored engine source matches the calculator's full engine commit.
- Vercel deployment installs the vendored `@adireaudio/enclosure-engine` package without GitHub SSH access.
- App proxy requests pass Shopify signature verification.
- Supabase pricing returns the expected MAP/dealer values.
- Logged-in customer tags resolve customer/dealer/distributor tier correctly.
- Brand logo EPS lookup works or fails gracefully.
- Top logo supports matching the subwoofer brand, another brand from the shared directory, no logo, and a required custom request that reaches Shopify production data.
- Shared brand/model catalog loads from Supabase; missing model measurements are disclosed as editable size fallbacks.
- Model selection applies any stored model-and-size cutout, outside-diameter, displacement, and mounting-depth values.
- Subs Up / Port Back positioning can recenter and snap to a safe build area; unsafe placement blocks checkout.
- Customer notes reach the private production snapshot and draft-order note.
- Flat Pack and custom acrylic dimensions remain unavailable.
- Draft order checkout URL is created and opens Shopify checkout.

## Local checks

```powershell
npm ci
npm test
npm run check
```

GitHub Actions runs that same clean-install, regression, engine-parity, typecheck, and production-build sequence for every push to `main` and every pull request.

An engine release also requires live verification of both the calculator and `https://bassheadsupply.com/apps/enclosure-designer`; a successful local build alone does not satisfy the parity rule.

September 27, 2026 shared-engine update: `10d6631541c2a1bf304143f0a0c9d06b86126c22`
matches the calculator's approved Bottom dowel-channel layout and retains the
Top/Bottom trim allowance. Manufacturing controls remain internal to the
calculator. Vendored/installed source parity, 21 regression tests, TypeScript
and the production build passed for this update.
