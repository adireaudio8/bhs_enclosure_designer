# BHS dealer app submission preparation

Prepared September 19, 2026. **Not submitted to Shopify.** Resolve the unfinished checks below before submission.

**Organization correction resolved for the pilot:** With Andrew's explicit approval, the free Basshead Supply Partner organization was created (`5196649`; Dev Dashboard `236496624`). The new Partner-owned **BHS Dealer SSA Pilot** (`425584328705`) is released with custom distribution restricted to SSA, and its installation link is ready. Legacy merchant-owned registrations under `221105492` remain unused. The future shared public app still needs a separate Partner-owned registration and Shopify review; no public listing has been submitted.

## Release approach

Run the controlled pilot with Sound Solutions Audio using a separate single-store custom app, then submit a functional shared public release before broader rollout. Hosted code updates go to the appropriate separate dealer hosting project. Theme-extension/configuration changes are released as new Shopify app versions; installed stores receive those versions. Some extension types or new protected access require additional Shopify review. Preserve the BHS-only application and keep ordering behind per-store activation checks.

Approval does not prove Collective supplier orders and settlement. Shopify explicitly states that Collective is unavailable on development, partner and client-transfer stores. A development store alone cannot prove this app's core supplier-order/payment integration. Use an eligible retailer store with an active Shopify plan and fully activated Shopify Payments for the real Collective pilot; agree the review setup with Shopify if the reviewer cannot access that flow. Do not describe simulations or untested supplier-order linkage as verified.

## Draft listing copy

**App name:** BHS Custom Enclosures

**Introduction:** Let customers design custom enclosures and add them to your store's regular cart.

**Description:** Offer made-to-order Basshead Supply enclosures in your Shopify store. Customers choose their subwoofers, enclosure measurements, material and supported options, then add a priced design to their cart with other products. View saved design details, customer notes and logo requests from the app. Available to approved BHS dealers using Shopify Collective; BHS onboarding and compatible shared products are required before ordering is enabled. USD storefronts are supported in the first release.

**Features:**

- Add a custom enclosure designer with a theme app block.
- Keep custom enclosures and other products in the same Shopify cart.
- Give each saved design a reference linked to its cart and order line.
- View customer measurements, selections, notes and logo requests.
- Use verified products imported through Shopify Collective.

**Availability:** Recommend limited listing visibility and BHS-controlled activation. Limited visibility does not make the installation link private.

**Pricing: Free.** Andrew explicitly confirmed on September 19, 2026 that dealers do not pay to use this app. No app usage, setup or subscription billing is required. Dealers still pay for the physical enclosure orders through Collective under their agreed supplier terms. This is a listing preparation update; the live Shopify listing has not been submitted or changed.

**Required assets and contacts:** A 1200 × 1200 PNG/JPEG app icon; screenshots from finished merchant/customer flows; support, API, review and emergency contacts; a public app-specific privacy policy. Do not fabricate these or substitute a storefront policy without checking coverage.

## Reviewer demonstration

Use two test environments:

1. **Development store:** Install/open/uninstall/reinstall the app, add its theme block, and check merchant authentication and onboarding. A separate, clearly labeled test setup using ordinary test products can exercise the designer, native mixed cart, test checkout and saved-design UI. That test setup is not yet implemented. Its fixtures must remain isolated from production; it must never claim Collective eligibility or automatic settlement.
2. **Eligible retailer store:** Verify a small real catalog shared from BHS through Collective, exact retail and supplier pricing, shipping, design-reference transfer, supplier-order creation, automatic payment eligibility/settlement, and cancellation/refund behavior. Use a separately registered single-store custom pilot app with the same source if testing before public-app approval. Do not change the shared app's distribution to custom, since Shopify distribution selection is permanent.

Andrew selected Sound Solutions Audio, `soundsolutionsaudio.myshopify.com`, and confirmed its existing Collective membership on September 19, 2026. The corrected Partner-owned SSA app now has a released version and a restricted installation link. The existing isolated dealer hosting was rebound to its credentials and restricts access to SSA; deployment and installation preflight checks pass. Actual installation and Collective payment settings remain unverified. See [SSA pilot setup](dealer-app-ssa-pilot.md). No new paid store is needed or has been purchased. The real Collective test remains pending.

The public-app reviewer must have a usable path through the features claimed in the listing. Supply an English screencast, accurate test instructions and appropriate reviewer access. Explain the Collective restriction explicitly and confirm any special review arrangement with Shopify before relying on a simulated development-store flow for approval. A staging store alone does not make an unreleased public app installable on a live store.

Record an English screencast showing Shopify installation, theme setup using the **BHS Custom Enclosures** block, design/pricing validation, a mixed cart, distinct design references, merchant access to saved selections and notes, the order/supplier handoff the app claims to support, and uninstall/reinstall.

## Remaining submission gates

- Create and verify the separate Partner-owned public-app registration. The Partner organization and SSA custom-pilot registration are complete; the pilot's custom distribution does not make it a public app.
- Complete an actual development-store installation and primary-workflow demonstration. Unit tests and an OAuth redirect check alone do not establish this.
- Complete the real Collective pilot on an eligible live/staging retailer, or obtain an explicit review/testing arrangement from Shopify. Collective cannot be installed on ordinary development stores.
- Prepare a verified first-release Collective catalog. The read-only manifest has 4,818 candidate prices in 49 groups; none has been approved or published as part of this task.
- Establish authoritative matching of retailer orders/design references to BHS Collective supplier orders. The current inbox requires staff reconciliation; no automatic manufacturing handoff is implemented.
- Complete privacy request fulfillment and retention operations. Authenticated, durable webhook queues do not by themselves fulfill export/deletion requests.
- Publish an app-specific privacy policy matching actual operations; complete listing/contact details and screenshots/screencast.
- Determine required protected customer data access for `read_orders` and finish its access request before submission where needed. The order query omits customer names, emails and addresses, but order metadata and free-text notes still require accurate disclosure.
- Resolve App Bridge applicability for this intentionally non-embedded app during final review preparation.
- Complete the Shopify dashboard's automated checks after the Partner-owned public-app registration exists. SSA custom distribution has been saved, but no App Store submission has been made.

## Preflight improvements

Removed manual store-domain entry and directed merchants to Shopify-owned installation/opening surfaces. Added detailed onboarding with the actual theme block name. Added authenticated, shop-scoped saved-design listing, reference lookup and detail pages for customer selections, notes and logos, excluding internal manufacturing geometry and credentials. Removed fixed shipping-time promises from dealer mode. Existing BHS-only behavior remains unchanged.

Validation: 74 tests pass, including seven merchant access/projection tests and three pilot store-restriction tests. Engine parity, TypeScript and the production build pass. Shopify released `ssa-pilot-20260919`; live checks confirm SSA's correct OAuth target, 403 for another store and 401 for unsigned protected endpoints. The engine remains pinned to `e833104799ca06cb7fc288cc675f1caf47a454f3`.

## Official references

- [Submit your app for review](https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review)
- [Review process](https://shopify.dev/docs/apps/launch/app-store-review/review-process)
- [Deploy and release app versions](https://shopify.dev/docs/apps/launch/deployment/deploy-app-versions)
- [App listing visibility](https://shopify.dev/docs/apps/launch/distribution/visibility)
- [Collective installation and development-store restriction](https://help.shopify.com/en/manual/online-sales-channels/shopify-collective/retailers/installation)
- [Development-store creation and limitations](https://shopify.dev/docs/apps/build/stores/development-stores)
