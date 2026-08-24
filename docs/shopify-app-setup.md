# Shopify App Setup

This repo is the Vercel-hosted storefront app for the Basshead Supply custom
enclosure designer. The Shopify app exists to expose the Vercel app through an
app proxy and grant the server enough Admin API access to create draft orders.

## Create Or Link The App

From this repo root:

```powershell
npm install
npm run shopify:link
```

Choose or create the Shopify Dev Dashboard app named:

```text
BHS Enclosure Designer
```

The CLI should populate `client_id` in `shopify.app.toml`. If you create the app
manually in the Dev Dashboard, copy the client ID into that field before
deploying.

## Deploy App Configuration

```powershell
npm run shopify:deploy
```

Confirm the deployed config includes:

```text
App URL: https://bhsenclosuredesigner.vercel.app
Embedded app: false
Scopes: read_customers, read_draft_orders, write_draft_orders, write_app_proxy
App proxy prefix: apps
App proxy subpath: enclosure-designer
App proxy URL: https://bhsenclosuredesigner.vercel.app/shopify/enclosure-designer
```

Shopify should serve the app at:

```text
https://basshead-supply.myshopify.com/apps/enclosure-designer
```

## Vercel Environment Variables

Keep the Supabase variables already configured and add the Shopify credentials
from the Dev Dashboard:

```text
SHOPIFY_CLIENT_ID=
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
```

If Shopify gives you a long-lived Admin API access token, you can also set:

```text
SHOPIFY_ADMIN_ACCESS_TOKEN=
```

When `SHOPIFY_ADMIN_ACCESS_TOKEN` is present, the app uses it directly. When it
is absent, the app uses `SHOPIFY_CLIENT_ID` or `SHOPIFY_API_KEY` plus
`SHOPIFY_API_SECRET` to request and cache an Admin API token server-side.

After changing Vercel env vars, redeploy the Vercel project.

## Engine Parity Deployment Gate

Before any deployment that changes `@adireaudio/enclosure-engine`:

1. Confirm the calculator and this designer are targeting the same full `enclosure-engine` commit.
2. Build the vendored tarball from that exact engine checkout, replace `vendor/adireaudio-enclosure-engine-0.0.0.tgz`, and run `npm install "@adireaudio/enclosure-engine@file:vendor/adireaudio-enclosure-engine-0.0.0.tgz"` to refresh the stale tarball integrity and dependencies in `package-lock.json`. Do not use a plain install for this refresh.
3. Run `npm run typecheck` and `npm run build` in this repo and the required calculator checks in `enclosure-calculator-web`.
4. Deploy both consumers as one coordinated engine release.
5. Verify the calculator and the live Shopify route `https://bassheadsupply.com/apps/enclosure-designer`.

Do not close a calculator-only or designer-only engine bump. The customer UI may intentionally omit manufacturing controls, but the underlying shared engine revision must remain parallel.
