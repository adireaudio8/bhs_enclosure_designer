# Sound Solutions Audio pilot

Updated September 19, 2026. **The private installation link is ready. SSA has not installed the app, and customer ordering remains disabled.** No real checkout or Collective payment has been tested.

## Dealer identity

- Business: Sound Solutions Audio (SSA).
- Public storefront: https://store.soundsolutionsaudio.com/.
- Shopify store: `soundsolutionsaudio.myshopify.com`, verified from the public homepage's `Shopify.shop` assignment.
- Andrew selected SSA and confirmed existing BHS Collective membership. Automatic payments and custom-enclosure terms still require live verification.

## Active Partner organization and registration

Andrew explicitly approved accepting the Partner Program Agreement. The agreement was accepted and the free **Basshead Supply** Partner organization was created using the BHS login on September 19, 2026. No paid registration or subscription was purchased.

- Partner organization: `5196649`, https://partners.shopify.com/5196649.
- Dev Dashboard organization: `236496624`.
- App: **BHS Dealer SSA Pilot**.
- Client ID: `e819030eaa28f090db1c2a659c5b9f62`.
- App ID: `425584328705`.
- Dashboard: https://dev.shopify.com/dashboard/236496624/apps/425584328705.
- Distribution: https://partners.shopify.com/5196649/apps/425584328705/distribution.
- Custom distribution is selected and restricted to `soundsolutionsaudio.myshopify.com`. Multi-store installation for a Plus organization is unchecked.
- Released Shopify version: [`ssa-pilot-20260919`](https://dev.shopify.com/dashboard/236496624/apps/425584328705/versions/1135622160385).
- Active configuration: `dealer-app/shopify.app.bhs-dealer-ssa-pilot.toml`.

The distribution page visibly confirmed the generated single-store installation link. Its signed expiry is September 26, 2026 at 18:44:22 UTC (11:44:22 a.m. Pacific). The exact link was delivered in the task and retained in the ignored local `.dealer-setup/ssa-install-handoff.md`; do not commit the signed link. Retrieve it from the distribution page while valid, or regenerate it there when necessary. This is a custom pilot, not a public App Store listing. The eventual shared public app still needs its own Partner-owned registration and review.

## Dealer handoff

1. Andrew gives the restricted installation link to SSA's store owner or an authorized administrator. No dealer message has been sent on Andrew's behalf.
2. SSA signs in to its Shopify admin, opens the link and installs **BHS Dealer SSA Pilot**.
3. SSA opens the app and tells Andrew when the connection/setup page appears. Installation creates a pending store record; it does not activate customer ordering.
4. After the approved pilot catalog and settings are ready, duplicate SSA's current theme and add the **BHS Custom Enclosures** block to a page in the unpublished copy. Keep the preview private until the controlled pilot passes.

## Hosting and access

The existing isolated dealer hosting project was rebound to the correct Partner-owned SSA registration. Both legacy registrations had zero installs, so a second hosting/database stack was unnecessary. The original BHS storefront/designer deployment was not changed.

- Hosting project: `bhs-dealer-enclosure-designer` under `adireaudio8s-projects`.
- Live app: https://bhs-dealer-enclosure-designer.vercel.app/dealer.
- READY deployment: `dpl_7wfAMbwy6hQqixGWdKYy9eNAwKwm`, code commit `d20e907`.
- Production Shopify key/secret now belong to the Partner-owned SSA pilot. The secret is protected; values were passed privately, never printed or committed.
- `DEALER_ALLOWED_SHOPS=soundsolutionsaudio.myshopify.com` enforces an exact store restriction across install, callback, proxy, session and database store lookup.
- The previously approved dedicated Supabase key and existing session/encryption/operator settings remain in the isolated hosting project. No unrelated production settings were exported. The existing SQL migration was not rerun.
- Local CLI credentials are ignored in `dealer-app/.env.ssa-partner`; the entire directory and `.dealer-setup` are excluded from Vercel uploads.

The database currently identifies installations by shop, not app client ID. This deployment has one active app identity. Before migrating SSA to a public app or running another registration against these tables, explicitly plan credential ownership, webhook/uninstall/privacy isolation, and retention of historic designs/orders. Do not let two registrations overwrite the same installation record.

## Validation

- All **74 tests** across five files pass, including exact-domain admission, similar-name rejection, rejection of previously signed sessions after store removal, and rejection of signed nonpilot proxy requests.
- Engine parity, TypeScript, the production build and `git diff --check` pass.
- Named Shopify configuration validates; theme extension check/bundling and release succeed.
- Live `/dealer` returns 200 with SSA pilot onboarding.
- SSA's installation endpoint returns 307 to the exact SSA OAuth host and correct client ID. The redirect was not followed and no store permissions were granted.
- Another store's installation request returns 403.
- Private designs redirect unauthenticated requests; unsigned session, proxy, operator catalog and webhook requests return 401.
- Ignored evidence: `.dealer-setup/ssa-live-checks.json`.

These checks establish deployment and installation readiness, not completed installation or working Collective checkout. No dealer was activated, and no product, price list, order, payment or fulfillment was changed.

## Remaining pilot work

1. Have SSA install; verify its authenticated app connection and pending database record.
2. Verify Collective automatic payments on both sides and agree the custom-enclosure margin and shipping policy. The historic 20% shipping-included plan is not automatically confirmed for this pilot.
3. Share/import a small approved set of exact-price options; verify retail prices, supplier costs, publication and Collective locations. The read-only 4,818-price manifest is not an approved catalog. Preserve unrelated lists and retailer assignments.
4. Register verified imported variant mappings and required store settings. Enable the pilot only for the agreed controlled test.
5. Test an unpublished theme preview, then use a specifically agreed live purchase to prove the mixed regular cart, supplier-order creation, saved-design matching, fulfillment/payment and cancellation/refund behavior. Do not place a live order or fulfill it without concrete authorization.
6. Keep production handling manual until authoritative supplier-order/design matching is established. Finish privacy request handling, retention and operational alerts before customer launch.

Existing Collective membership does not establish automatic-payment activation or permission to operate SSA's admin. Installation and pilot acceptance require SSA's participation.

## Legacy registrations retained

Live dashboard inspection showed that BHS organization `221105492` is a merchant organization. Its registrations have organization-only installation and cannot provide the planned external dealer distribution. A Shopify employee's [explanation of merchant versus Partner organizations](https://community.shopify.dev/t/failing-to-create-webhooks-with-apps-created-in-the-dev-dashboard/27109/8) matches the observed behavior.

| Legacy registration | Client ID | Dashboard | Status |
| --- | --- | --- | --- |
| BHS Dealer SSA Pilot | `800856ca5643603ede0a8834c3de780f` | [Merchant-owned SSA scaffold](https://dev.shopify.com/dashboard/221105492/apps/425577447425) | Unsuitable for SSA distribution; zero installs at correction |
| BHS Dealer Enclosure Designer | `0683dc0526169d9bd139c17b54f2a20d` | [Initial merchant registration](https://dev.shopify.com/dashboard/221105492/apps/425553231873) | Not a public-app registration; zero installs at correction |

Both were retained without deletion. The old SSA CLI scaffold automatically released version `1135599353857`; its remote name also contains a leading control character from the interactive prompt. Do not deploy or install that legacy registration. The initial dealer foundation version `1135543746561` remains historical and unreleased. A future public app must be created under the new Partner organization, not repurposed from either merchant-owned registration.
