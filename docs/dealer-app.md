# BHS dealer enclosure app

## Status — September 19, 2026

The initial app implementation is hosted for setup and review. The database is connected and installation preflight passes. The Shopify version remains unreleased, no dealer is installed, and **customer ordering is disabled**.

Submission materials and remaining gates are tracked in [dealer-app-submission.md](dealer-app-submission.md). The app has **not been submitted**. Preflight improvements remove manual shop-domain entry, add detailed theme onboarding and protected merchant access to saved designs, and remove unverified dealer shipping-time promises. See the [pre-submission review](dealer-app-review.md).

Registered Shopify app: **BHS Dealer Enclosure Designer**, client ID `0683dc0526169d9bd139c17b54f2a20d`, in the Basshead Supply organization. Its configuration and theme extension validate. Separate hosting project: `bhs-dealer-enclosure-designer`, at https://bhs-dealer-enclosure-designer.vercel.app/dealer. The SQL migration is applied to the pricing database. No dealer has been selected for the pilot.

Shopify version `dealer-foundation-20260919` is uploaded **without release**: https://dev.shopify.com/dashboard/221105492/apps/425553231873/versions/1135543746561. The isolated hosting deployment `dpl_276FnNjyDV5mTMFMThvzKqtYiYN2` is READY and live HTML directs merchants to Shopify admin for installation/opening. Vercel labels the new project's default deployment production; this is separate from the existing BHS storefront. No dealer is installed or activated. Live unauthenticated session, proxy, catalog and webhook requests return 401.

The new app's own Shopify credentials and session/encryption/operator keys are configured on its separate hosting project. Its public Supabase URL points to the same pricing project, `ftvfqjqgkrnoxeystorg`. Andrew explicitly approved creating the dedicated revocable Supabase secret key `dealer_enclosure_designer` and storing it in the new Vercel app. It is saved as the protected production setting `SUPABASE_SECRET_KEY`. Supabase secret keys have privileged project access; the separate key provides independent revocation, not table-scoped isolation. Its value was not committed or included in reports. No existing BHS production key was copied.

The additive migration created five private tables and three functions. Live verification confirms RLS is enabled on all five tables, no table/function grants exist for `anon`, `authenticated` or `PUBLIC`, and there are zero installed dealers and zero quotes. The app's authenticated operator catalog request returns 200 from live pricing. It currently produces **4,818 candidate price options across 49 groups** of at most 100 variants; this is a preparation manifest, not an approved or published Collective catalog. Review and narrow the supported first-release options before creating products. Installation preflight reaches the expected Shopify OAuth redirect (307) without following it or granting store access.

Supabase displayed an outstanding-invoices notice warning of possible service disruption. Andrew was notified; no billing action was taken.

The app uses the existing designer and pinned enclosure engine. The BHS-only app configuration and draft checkout remain separate. Dealer code never creates draft orders, retailer products, supplier orders, charges, invoices, or fulfillments.

## Confirmed requirements

- All dealers use Shopify.
- Customers purchase on the dealer's store, in its regular cart alongside subs, amps and other merchandise.
- Custom enclosures must flow through Shopify Collective, including automatic dealer-to-BHS payments.
- Andrew will identify the first pilot dealer. Do not assign or activate existing Collective retailers as part of app development.
- Boxify work remains on hold until Andrew finishes the source weights and dimensions.

## Collective design

Share a catalog of **fixed-price custom enclosure options** from BHS through Collective. Each option has a permanent SKU such as `BHS-CUSTOM-USD-53599` and a matching $535.99 retail price. The actual enclosure design is a separate immutable database record, identified on the cart line by `BHS Design` and `_bhs_design_id`.

1. The customer designs an enclosure in the dealer's theme app block.
2. The server validates measurements, fit and permitted options and quotes retail MAP from the existing pricing matrix and modifiers. It does not use the BHS website's wholesale customer tags.
3. The app selects an exact-price mapping registered for that dealer. It checks the live imported variant's identity, SKU, price, active/publication state, stock and assigned Collective location.
4. The server saves the design, calculated geometry, notes, logo request and engine revision. The dealer's own storefront adds one item to its native Ajax cart. Existing items remain intact. The customer's subwoofer quantity is part of the design; enclosure line quantity starts at one.
5. Shopify checkout collects the customer's payment. Collective owns supplier-order creation, settlement and fulfillment synchronization.
6. Retailer webhooks create an app reconciliation inbox. No design proceeds automatically into manufacturing. BHS staff must match the real Collective supplier order to the saved design first.

Two different designs at the same price share a price option but have different design references, keeping their cart/order lines distinct. Retrying the same add request reuses its saved design and does not add it twice to the same cart.

**Never reprice an existing option for the next customer.** Old carts must retain the same meaning. Add new fixed-price SKUs when the pricing matrix changes. Disable obsolete mappings for new quotes; handle already ordered designs using their saved snapshot.

If no exact price is available and verified, ordering stops with an explanatory message. There is no rounded price, artificial quantity, add-on fee or draft-order fallback. Above-maximum volume tiers also stop instead of extrapolating the last tier.

`GET /dealer/operator/catalog` prepares candidate retail prices from the pricing matrix and supported modifier combinations, grouped into at most 100 variants per product. It requires `Authorization: Bearer <DEALER_OPERATOR_KEY>` and only reads data. Treat its output as a preparation manifest: unusual catalog/name-based modifier rules still need verification, and unsupported price combinations remain unavailable. It neither creates nor shares products.

## What Shopify documents, and what needs a pilot

- Price-list creation/sharing and retailer invitations require the Collective UI; there is no supported API for those steps. Import policies can automate retailer imports after sharing. [Developer guide](https://shopify.dev/docs/apps/build/collective/products)
- Collective supports at most 100 variants per product. Imported products must keep their Collective fulfillment location; duplicating them breaks the supplier connection. Retail price synchronization is off by default. [Product management](https://help.shopify.com/en/manual/online-sales-channels/shopify-collective/retailers/importing-products)
- Automatic payment requires eligibility and activation on both sides. The customer pays the dealer; Collective deducts the supplier cost and transfers the payment according to its fulfillment rules. [Automatic payments](https://help.shopify.com/en/manual/online-sales-channels/shopify-collective/retailers/payments)
- A public app distribution route is required for unrelated dealers. Limited listing visibility does not bypass Shopify review. Do not choose single-store custom distribution for the permanent dealer app. [Distribution](https://shopify.dev/docs/apps/launch/distribution)
- These sources do **not** establish that arbitrary design properties reach the supplier order unchanged, or that new variants synchronize instantly. The implementation avoids creating/repricing variants during customer checkout. Verify order-property transfer with the pilot. If properties do not transfer, implement an authoritative retailer-to-supplier order link before launch; do not infer a design from price/SKU alone.

The historic 20% shipping-included Collective plan is not hard-coded into this app. Confirm the actual custom-enclosure price list, retailer cost and shipping terms in Collective. Supabase `dealer_price` is not evidence of the Collective amount payable.

## Installation and hosting

1. Separate HTTPS hosting has been created from this repository. Do not overwrite the existing BHS designer deployment. Keep the dealer deployment's `NEXT_PUBLIC_GA_MEASUREMENT_ID` and `NEXT_PUBLIC_FB_PIXEL_ID` empty; dealers' cart/checkout analytics run on their own stores.
2. Populate the private environment settings in `.env.example`: shared pricing Supabase URL/server key, the new dealer app key/secret, `DEALER_APP_URL`, random session/operator secrets and a 32-byte random base64 encryption key. Do not copy BHS-only Shopify credentials into the dealer deployment. Never commit secrets.
3. `sql/20260919_dealer_designer.sql` was applied on September 19, 2026 to `ftvfqjqgkrnoxeystorg`. Do not rerun this new-installation migration there. It creates private `bhs_dealer_*` tables and service-role-only functions without editing products, existing pricing or Collective settings. Verification was run in a separate SQL Editor query, `15f08ddb-6e88-4836-9adf-84f7d9625d4f`.
4. The dedicated hosting URL is configured in `dealer-app/shopify.app.bhs-dealer-enclosure-designer.toml`. Validate from the repo root with `shopify app config validate --path ./dealer-app --config bhs-dealer-enclosure-designer --json`. Deploy that named app configuration from `dealer-app`; never deploy the root BHS app as a substitute.
5. Finish public-app distribution, privacy policy, support/contact information, protected order-data access requirements and Shopify review. A valid local config is not an approved app listing.
6. Install on the selected dealer through the new app's authorization flow. Installation creates a pending store record and stores encrypted, expiring offline credentials. A pending store cannot accept customer orders.
7. In Collective's UI, connect the dealer, enable and verify automatic payments on both sides, agree to the custom-enclosure shipping policy and share the approved fixed-price products. Import and publish them on the dealer's Online Store. Keep the actual Collective fulfillment location.
8. Register verified supplier/retailer variant pairs in `bhs_dealer_price_options`, including SKU, retail price, USD currency and `verified_at`. Enable only mappings checked against the real Collective import. Never register ordinary retailer-created products.
9. Set the dealer's Online Store publication ID and Collective location ID in `bhs_dealer_shops`. Confirm the shipping and automatic-payment flags only after inspecting the live settings. Set the store active and the pilot flag temporarily only for the controlled pilot; do not expose the designer page to the public until the pilot passes. Disable it immediately if a check fails.
10. The dealer adds the BHS Custom Enclosures block to a page with its theme editor. This release supports the primary storefront domain or myshopify domain, USD and normal locale paths; secondary market domains/currencies need separate support.

## Controlled pilot acceptance

Use an agreed test transaction; no test orders have been placed during development.

- Add a sub/amp first, then an enclosure. Confirm both remain in one cart and one dealer checkout.
- Add two different enclosure designs at the same price. Confirm two distinct line properties and stored snapshots.
- Retry after an interrupted cart request. Confirm no duplicate enclosure.
- Check the exact retail total, discount behavior, Collective supplier cost and shipping in both stores. Dealer-funded discounts must not be mistaken for a reduced supplier payment.
- Confirm the BHS Collective order is created once, automatic payment is active, and fulfillment/tracking sync as expected.
- Match the dealer order, line, design snapshot and BHS supplier order. Verify notes, placement, acrylic and logo choices. Prove the production system holds custom price SKUs for design review rather than treating them as an existing stock design.
- Edit/cancel/refund the test order and verify the reconciliation inbox. It records a hold/review state; it does not itself hold a Shopify fulfillment order or cancel a production job.
- Test an unshared product, changed price, sold-out variant, expired session, uninstall and disconnected Collective relationship. Ordering must stop.
- Turn off the pilot flag until all failures are resolved. Record test order IDs and evidence before opening the public dealer page.

## Operations and remaining launch work

`bhs_dealer_order_lines` is a reconciliation inbox, not a manufacturing queue. It records paid lines as `awaiting_collective` and mismatches/unpaid/refund cases as `needs_review`. Match and store `supplier_order_id` before creating a manufacturing job. This initial implementation does not automate that final supplier-order linkage.

Shopify notifications are authenticated, re-read the current retailer order, paginate line items and save an atomic versioned snapshot. Replays upsert the same order lines. Older concurrent snapshots cannot overwrite newer cancellations/refunds. Add an operational alert for failed webhooks, `needs_review` records and pending privacy requests before launch; no alert service is configured yet.

Privacy webhooks are authenticated and stored in an encrypted durable inbox for operator handling. Uninstall removes stored access tokens and disables the store. A staffed data-access/redaction workflow and documented retention policy are still required before Shopify review or production use. The app does not collect customer addresses or emails, but free-text design notes may contain personal data. Do not mark queued privacy requests completed until the requested export/deletion has actually been handled.

The browser never receives wholesale costs, Supabase credentials, Shopify access tokens, manufacturing cut lists or full production snapshots. Anonymous shopper tokens last two hours and only work for the signed store; ordering also checks the store's current activation state. Administrative credentials and privacy payloads use authenticated encryption with shop-specific context.

## Validation

Run `npm test` and `npm run check` from the repository root. Tests cover signed access, tenant separation, input validation, exact imported-product pricing, native mixed carts, retry deduplication and order/design matching. Engine parity remains pinned; this work does not upgrade the shared geometry engine.

The 71 automated tests pass, including real PostgreSQL migration execution in an in-memory PGlite database, quote idempotency, tenant checks, private table/function permissions, and versioned order reconciliation. Shopify config validation and the theme-extension Liquid check pass. Engine parity, TypeScript and the production build pass. Next.js is patched to 16.3.5 and Shopify CLI to 4.8.0; the updated lockfile's dependency audit reports zero vulnerabilities. Real Shopify installation, supplier-side property transfer, automatic payments, production reconciliation and live checkout remain pilot/launch checks.
