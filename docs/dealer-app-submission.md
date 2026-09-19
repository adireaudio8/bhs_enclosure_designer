# BHS dealer app submission preparation

Prepared September 19, 2026. **Not submitted to Shopify.** Resolve the unfinished checks below before submission.

## Release approach

Submit a functional first release, then install it with one approved dealer before broader rollout. Hosted code updates go to the separate dealer Vercel project. Theme-extension/configuration changes are released as new Shopify app versions; installed stores receive those versions. Some extension types or new protected access require additional Shopify review. Preserve the BHS-only application and keep ordering behind per-store activation checks.

Approval does not prove Collective supplier orders and settlement. If the first live Collective pilot happens after approval, provide Shopify a working development-store demonstration and accurate test instructions before submission. Do not describe untested payment or supplier-order linkage as verified.

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

**Pricing:** Pending Andrew's confirmation. No app usage, setup or subscription billing is implemented. Enclosure purchases through Collective are separate from app fees; do not publish a free-app claim until confirmed.

**Required assets and contacts:** A 1200 × 1200 PNG/JPEG app icon; screenshots from finished merchant/customer flows; support, API, review and emergency contacts; a public app-specific privacy policy. Do not fabricate these or substitute a storefront policy without checking coverage.

## Reviewer demonstration

Prepare an accessible development store with a working primary workflow. Describe which services are real versus simulated. Keep test data separate from production activation; do not bypass production Collective checks to present an incomplete integration as complete.

Record an English screencast showing Shopify installation, theme setup using the **BHS Custom Enclosures** block, design/pricing validation, a mixed cart, distinct design references, merchant access to saved selections and notes, the order/supplier handoff the app claims to support, and uninstall/reinstall.

## Remaining submission gates

- Complete an actual development-store installation and primary-workflow demonstration. Unit tests and an OAuth redirect check alone do not establish this.
- Prepare a verified first-release Collective catalog. The read-only manifest has 4,818 candidate prices in 49 groups; none has been approved or published as part of this task.
- Establish authoritative matching of retailer orders/design references to BHS Collective supplier orders. The current inbox requires staff reconciliation; no automatic manufacturing handoff is implemented.
- Complete privacy request fulfillment and retention operations. Authenticated, durable webhook queues do not by themselves fulfill export/deletion requests.
- Publish an app-specific privacy policy matching actual operations; complete listing/contact details and screenshots/screencast.
- Determine required protected customer data access for `read_orders` and finish its access request before submission where needed. The order query omits customer names, emails and addresses, but order metadata and free-text notes still require accurate disclosure.
- Resolve App Bridge applicability for this intentionally non-embedded app during final review preparation.
- Complete the Shopify dashboard's automated checks. Browser control was unavailable during this preparation pass; no submission fields or distribution settings were changed.

## Preflight improvements

Removed manual store-domain entry and directed merchants to Shopify-owned installation/opening surfaces. Added detailed onboarding with the actual theme block name. Added authenticated, shop-scoped saved-design listing, reference lookup and detail pages for customer selections, notes and logos, excluding internal manufacturing geometry and credentials. Removed fixed shipping-time promises from dealer mode. Existing BHS-only behavior remains unchanged.

Validation: 71 tests pass, including seven merchant access/projection tests. Engine parity, TypeScript and the production build pass. The engine remains pinned to `e833104799ca06cb7fc288cc675f1caf47a454f3`.

## Official references

- [Submit your app for review](https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review)
- [Review process](https://shopify.dev/docs/apps/launch/app-store-review/review-process)
- [Deploy and release app versions](https://shopify.dev/docs/apps/launch/deployment/deploy-app-versions)
- [App listing visibility](https://shopify.dev/docs/apps/launch/distribution/visibility)
