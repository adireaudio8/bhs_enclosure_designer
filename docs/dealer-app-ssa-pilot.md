# Sound Solutions Audio pilot

Prepared September 19, 2026. Registration created; no installation link, deployment, dealer installation or order activation yet.

## Dealer identity

- Business: Sound Solutions Audio (SSA).
- Public storefront: https://store.soundsolutionsaudio.com/.
- Shopify store: `soundsolutionsaudio.myshopify.com`, verified from the public homepage's `Shopify.shop` assignment.
- Andrew selected SSA and confirmed it is already a BHS Collective member. This is user confirmation, not a new live audit of its relationship, eligibility or payment settings.

## Separate pilot registration

- Organization: Basshead Supply, ID `221105492`.
- App: BHS Dealer SSA Pilot.
- Client ID: `800856ca5643603ede0a8834c3de780f`.
- Local configuration: `dealer-app/shopify.app.bhs-dealer-ssa-pilot.toml`.
- Registration created successfully through the authenticated Shopify CLI. The generated configuration is an unfinished scaffold with Shopify's default app-home URLs. Do not deploy it as-is or present it as ready to install.
- The interactive name prompt inserted a leading control character into the remote app name. The local name is corrected; synchronize and verify the remote display name during configuration/deployment.
- No pilot credentials were exported, no pilot hosting/database access was created, and no app version was uploaded or released for this registration.
- The shared public registration, client ID `0683dc0526169d9bd139c17b54f2a20d`, remains separate. Its configuration remains the local default.
- Browser access to the Dev Dashboard currently requires BHS account sign-in in Codex's in-app browser. The Chrome connection timed out. The dashboard's custom-distribution selection and store-specific link generation remain pending.

## Remaining setup

1. Open the SSA registration in the authenticated Dev Dashboard. Confirm the organization and client ID, correct the display name, and select custom distribution restricted to `soundsolutionsaudio.myshopify.com`. Do not change the shared public app's distribution.
2. Prepare isolated pilot hosting with its own app credentials, sessions and encryption settings; finish a reviewed database-access setup. The existing dedicated Supabase key belongs to the shared dealer hosting. Do not export unrelated production settings.
3. Resolve installation ownership before sharing database tables between app registrations. Current dealer records are keyed by shop, not app client ID. Never let two registrations overwrite the same shop's encrypted credentials or process each other's uninstall/privacy events. Plan migration to the approved public app and preservation of historic designs/orders explicitly.
4. Replace the default pilot app URLs, configure callbacks/webhooks/proxy and the theme extension, validate, deploy, and verify hosted behavior before generating an installation-ready handoff.
5. Generate the restricted link for Andrew to pass to SSA. The dealer owner or authorized administrator installs it. Installation must leave ordering pending.
6. Verify Collective automatic payments on both sides and agree the custom-enclosure margin and shipping policy. The historic 20% shipping-included plan is not automatically confirmed for this pilot.
7. Share/import a small approved set of exact-price options; verify their prices, supplier costs, publication and Collective locations. Keep unrelated price lists and retailer assignments unchanged.
8. Test in a duplicate/unpublished theme preview. Confirm mixed carts, distinct design references, retry behavior and merchant design access before a specifically agreed live purchase.
9. Prove supplier order creation and design matching; verify payment timing on legitimate fulfillment and cancellation/refund behavior. Keep production handling manual until authoritative matching is established.

## Evidence and limits

The public storefront confirms only store identity. Existing Collective membership does not establish automatic-payment activation, permission to edit SSA's store or an installed app. No dealer passwords, customer data, product updates, price-list changes, messages, orders or payments were used for this preparation.

Shopify's [distribution documentation](https://shopify.dev/docs/apps/launch/distribution/select-distribution-method) requires choosing custom distribution and generating an install link in the Dev Dashboard. Single-store pilot registration does not replace review of the shared public app.
