# BHS Enclosure Designer App

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

This app and `enclosure-calculator-web` are parallel consumers of `enclosure-engine`. Whenever either consumer adopts a new engine revision, both must be updated to the **same full engine commit** in the same release work. The engine change is not complete until both consumers pass their checks, are pushed and deployed, and the live Shopify route `/apps/enclosure-designer` is verified.

The website UI intentionally exposes a customer-safe subset of the internal Design tab. It does not render internal calculations, cut lists, costs, or DXF/CNC downloads. That UI distinction is intentional; it does not permit the underlying shared engine to remain on an older revision.

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

**Engine parity rollout completed 2026-08-24:** production commit `14842b9` vendors engine `910f804299e006ff0f6ce94d09b1a321fb58970a`, matching the calculator. Clean install, typecheck, and production build passed; Vercel deployment `dpl_GG4ktQMiFwxg481pkgx7VMTJxi6B` reached `READY`; the direct health endpoint and live Shopify designer route returned `200`; and the loaded designer showed configuration, pricing, dimensions, and no browser console errors.

**Customer option alignment completed 2026-08-24:** production commit `f44d9bd` exposes the engine's 6.5-inch support, adds an explicit Birch/MDF material selector, and enables material-aware flush mounting for both materials. Vercel deployment `dpl_4QWvQMW6opX2KLPTZJfj5bmHtP2E` reached `READY`. Live 6.5-inch MAP/dealer rows were verified for SD/RD/HD, and the storefront returned a valid `$273.49` guest price for a Single 6.5-inch MDF Regular Duty flush design with an `OK` baffle fit. A controlled checkout/draft-order regression remains separate and requires explicit approval. Remaining work is documented in `docs/ENGINE_PARITY_UPDATE_PROPOSAL.md`.

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
- `SUPABASE_SERVICE_ROLE_KEY`
- `SHOPIFY_SHOP_DOMAIN`
- `SHOPIFY_ADMIN_ACCESS_TOKEN`
- `SHOPIFY_API_SECRET`

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

Before switching storefront navigation to this app, test:

- The vendored engine source matches the calculator's full engine commit.
- Vercel deployment installs the vendored `@adireaudio/enclosure-engine` package without GitHub SSH access.
- App proxy requests pass Shopify signature verification.
- Supabase pricing returns the expected MAP/dealer values.
- Logged-in customer tags resolve customer/dealer/distributor tier correctly.
- Brand logo EPS lookup works or fails gracefully.
- Draft order checkout URL is created and opens Shopify checkout.

## Local checks

```powershell
npm ci
npm test
npm run check
```

GitHub Actions runs that same clean-install, regression, engine-parity, typecheck, and production-build sequence for every push to `main` and every pull request.

An engine release also requires live verification of both the calculator and `https://bassheadsupply.com/apps/enclosure-designer`; a successful local build alone does not satisfy the parity rule.
