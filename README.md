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

Treat the engine repo as read-only unless a dedicated engine change is requested. If it is private, Vercel must have GitHub access to it or `npm install` will fail.

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

- Vercel deployment installs `@adireaudio/enclosure-engine`.
- App proxy requests pass Shopify signature verification.
- Supabase pricing returns the expected MAP/dealer values.
- Logged-in customer tags resolve customer/dealer/distributor tier correctly.
- Brand logo EPS lookup works or fails gracefully.
- Draft order checkout URL is created and opens Shopify checkout.

## Local checks

```powershell
npm install --cache .npm-cache
npm run typecheck
$env:NEXT_DIST_DIR='.next-codex'; npm run build
```

The alternate local build folder avoids Windows/OneDrive locks in the default `.next` directory. Vercel can use the normal default output.
