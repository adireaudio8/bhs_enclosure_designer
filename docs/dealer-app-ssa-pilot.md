# Sound Solutions Audio pilot

Updated September 19, 2026. External installation remains blocked on Partner organization setup. No dealer installation or order activation has occurred.

## Dealer identity

- Business: Sound Solutions Audio (SSA).
- Public storefront: https://store.soundsolutionsaudio.com/.
- Shopify store: `soundsolutionsaudio.myshopify.com`, verified from the public homepage's `Shopify.shop` assignment.
- Andrew selected SSA and confirmed existing BHS Collective membership. Automatic payments and custom-enclosure terms still require live verification.

## Registration correction

Live authenticated inspection confirmed that BHS organization `221105492` is a merchant organization. Its app pages provide organization-only installation and no Distribution card. A Shopify employee's [explanation of merchant versus Partner organizations](https://community.shopify.dev/t/failing-to-create-webhooks-with-apps-created-in-the-dev-dashboard/27109/8) matches the observed behavior. The planned external dealer distribution needs Partner-owned registrations.

Existing registrations, retained without deletion:

| Registration | Client ID | Dashboard | Status |
| --- | --- | --- | --- |
| BHS Dealer SSA Pilot | `800856ca5643603ede0a8834c3de780f` | [SSA setup registration](https://dev.shopify.com/dashboard/221105492/apps/425577447425) | Merchant-owned scaffold; unsuitable for SSA distribution; zero installs |
| BHS Dealer Enclosure Designer | `0683dc0526169d9bd139c17b54f2a20d` | [Initial dealer registration](https://dev.shopify.com/dashboard/221105492/apps/425553231873) | Merchant-owned; not a public-app registration; zero installs |

The SSA registration was created by the CLI with a default active version, `bhs-dealer-ssa-pilot-1`, version ID `1135599353857`. The earlier note saying no version existed was incorrect: the CLI created and released this default scaffold automatically. It does not contain the finished dealer configuration. Its remote name has a leading control character from the interactive prompt; the local name is corrected. Do not use this registration for a dealer installation.

No pilot credentials were exported, no pilot hosting/database access was created, and no functional pilot version was deployed. The hosted implementation, SQL tables, tests and theme extension can be reused with new Partner-owned registration credentials. The original BHS-only app is separate and unchanged.

## Partner account setup

The `info@bassheadsupply.com` login now successfully accesses BHS. Shopify Partners shows only Create a new partner organization / Join an existing partner organization, so no existing Partner organization is attached to this login.

Prepared at https://partners.shopify.com/signup/create-organization:

- Main focus: Build apps.
- Location: United States, California.
- Business: Basshead Supply.
- Address: 2635 Lavery Ct, Suite 13, Thousand Oaks, CA 91320.
- Email: info@bassheadsupply.com.

Location/address come from BHS's public [contact page](https://bassheadsupply.com/pages/contact-us) and [dealer agreement](https://bassheadsupply.com/dealer-application). The final form was visually checked. The [Partner Program Agreement](https://www.shopify.com/partners/terms) checkbox remains unchecked and Create partner organization has not been submitted. Explicit approval to accept these binding terms is needed before that final action. The [Partner Program is free to join](https://help.shopify.com/en/partners/partner-program/about); this does not establish later App Store registration fees or authorize any paid action.

## Remaining setup

1. Obtain Andrew's approval for the prepared Partner signup and agreement acceptance, or use an existing authorized Partner organization he identifies. Create/verify the Partner organization before creating more app registrations.
2. Register a separate SSA pilot under that Partner organization. Confirm the actual external custom-distribution control, restrict it to `soundsolutionsaudio.myshopify.com`, and preserve a separate Partner-owned public app for eventual review. Do not create another merchant-owned replacement.
3. Prepare isolated pilot hosting with its own app credentials, sessions and encryption settings; finish the reviewed database-access setup. Never export unrelated production settings.
4. Resolve installation ownership before sharing database tables between app registrations. Current dealer records are keyed by shop, not app client ID. Prevent different registrations overwriting credentials or processing each other's uninstall/privacy events. Plan public-app migration and historic design/order retention explicitly.
5. Configure callbacks/webhooks/proxy/theme extension, validate, deploy, and verify hosted behavior before delivering an installation-ready link.
6. Generate the restricted link for Andrew to give SSA. Its owner or authorized administrator installs it. Installation must leave ordering pending.
7. Verify Collective automatic payments on both sides and agree margin/shipping. The historic 20% shipping-included plan is not automatically confirmed for this pilot.
8. Share/import a small approved set of exact-price options; verify prices, supplier costs, publication and Collective locations. Preserve unrelated lists and retailer assignments.
9. Test in an unpublished theme preview, then use a specifically agreed live purchase to prove supplier order creation, design matching, fulfillment/payment and cancellation/refund behavior. Keep production handling manual until authoritative matching is established.

## Evidence and limits

Existing Collective membership does not establish automatic-payment activation, permission to edit SSA's store or an installed app. No dealer passwords, customer data, product changes, price-list changes, messages, orders or payments were used for this preparation. No installation-ready link exists yet.
