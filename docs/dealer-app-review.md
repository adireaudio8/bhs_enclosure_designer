# Dealer app pre-submission review

Reviewed September 19, 2026 after the preparation fixes. **Not submitted and not approved.**

**Live distribution correction:** The original merchant-owned registrations could not supply external dealer installation. Andrew approved the Partner agreement, and the Basshead Supply Partner organization and replacement SSA custom app are now created. The pilot is released with its restricted installation link ready. The future shared public app still needs a separate Partner-owned registration and Shopify review. These operational checks are separate from the local checklist below; see [SSA pilot setup](dealer-app-ssa-pilot.md).

## Summary

✅ **Likely passing:** 33

❌ **Likely failing:** 0

⚠️ **Needs review:** 1

⏭️ **Groups skipped:** 9

**Note:** This reviews Shopify’s selected locally checkable subset. These and additional requirements will still be reviewed by Shopify upon submission. Zero known failures in this subset does not mean submission readiness. The primary-workflow test store, privacy operations, protected order-data access and listing materials remain unfinished; see [submission preparation](dealer-app-submission.md).

## ⚠️ Requirements that need review

⚠️ **2.2.3 Use the latest version of Shopify App Bridge**

**Why this needs attention:** Confirm Shopify review applicability to this intentionally standalone admin app. The canonical excerpt says 'all apps', while the adjacent authentication rule explicitly describes embedded apps; do not fail it by assuming an embedded architecture. If embedding is required/selected, implement current App Bridge and compatible auth together.

**What was detected:** The active dealer-app/shopify.app.bhs-dealer-ssa-pilot.toml explicitly sets embedded=false, preserving the reviewed standalone architecture. package.json and src/app/layout.tsx include neither legacy App Bridge nor the current CDN app-bridge.js script.

## ❌ Requirements that are likely failing

No remaining definite failures in the reviewed local subset after correcting installation entry, merchant data visibility and theme onboarding. This is not a completed Shopify submission audit.

## Skipped groups

These groups were not evaluated because their applicability signal was absent or they require explicit opt-in.

- **5.2 Payment** — Conditional signal absent: no payment extension or gateway scope.
- **5.3 Payment facilitator** — Opt-in not requested.
- **5.4 Purchase option** — Conditional signal absent: no subscription/customer-payment-method/payment-mandate scopes.
- **5.5 Product sourcing** — Opt-in not requested; business relevance to Collective does not override explicit gate.
- **5.6 Checkout customization** — Conditional signal absent: no checkout UI extension/target; native Ajax cart is not the defined signal.
- **5.7 Sales channel** — Conditional signal absent: no channel_config extension.
- **5.8 Post purchase** — Conditional signal absent: no checkout_post_purchase extension.
- **5.9 Mobile app builders** — Opt-in not requested.
- **5.10 Donation** — Opt-in not requested.

Andrew confirmed the app is free on September 19, 2026, resolving the app-billing question. Physical enclosure orders remain payable through Collective. Shopify documentation also confirms Collective cannot run on development stores; the corrected test plan requires an eligible live/staging retailer for the actual order/payment integration.

## Validation and coverage

All 100 IDs in the retrieved checklist are accounted for: 34 evaluated and 66 inside the nine skipped groups. The live canonical checklist currently contains no Section 4. Per-requirement evidence is saved in [dealer-app-review-evidence.json](dealer-app-review-evidence.json).

74 tests pass; engine parity, TypeScript and the production build pass. Live hosting serves SSA pilot instructions, private design pages redirect unauthenticated requests, and protected session/proxy/catalog/webhook endpoints return 401. SSA's installation preflight targets the correct app/store; another store returns 403. Shopify configuration/extension validation and the pilot release pass. Actual SSA installation remains pending; no dealer was activated and no order was placed. This deployment follow-up does not change the local checklist tally or establish public submission readiness.

## Resources

- [App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements)
- [Best practices](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices)
- [App billing](https://shopify.dev/docs/apps/launch/billing)
- [Submitting for review](https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review)
